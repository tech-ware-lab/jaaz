import { listModels, ModelInfo } from '@/api/model'
import useConfigsStore from '@/stores/configs'
import { useQuery } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useRef } from 'react'

export const ConfigsContext = createContext<{
  configsStore: typeof useConfigsStore
  refreshModels: () => void
} | null>(null)

export const ConfigsProvider = ({
  children,
}: {
  children: React.ReactNode
}) => {
  const configsStore = useConfigsStore()
  const { setTextModels, setTextModel, setSelectedTools, setAllTools, setShowLoginDialog } =
    configsStore

  // 存储上一次的 allTools 值，用于检测新添加的工具，并自动选中
  const previousAllToolsRef = useRef<ModelInfo[]>([])

  const { data: modelList, refetch: refreshModels } = useQuery({
    queryKey: ['list_models'],
    queryFn: () => listModels(),
    staleTime: 1 * 60 * 1000, // 5分钟内数据被认为是新鲜的
    placeholderData: (previousData) => previousData, // 关键：显示旧数据同时获取新数据
    refetchOnWindowFocus: true, // 窗口获得焦点时重新获取
    refetchOnReconnect: true, // 网络重连时重新获取
  })

  useEffect(() => {
    if (!modelList) return
    if (modelList.length === 0) {
      setShowLoginDialog(true)
      return
    }

    // 设置所有的文本模型
    const textModels = modelList.filter((m) => m.type === 'text')
    setTextModels(textModels || [])

    // 设置所有的工具模型
    const allTools = modelList.filter(
      (m) => m.type === 'tool' || m.type === 'image' || m.type === 'video'
    )
    setAllTools(allTools || [])

    // 设置选择的文本模型
    const textModel = localStorage.getItem('text_model')
    if (
      textModel &&
      modelList.find((m) => m.provider + ':' + m.model === textModel)
    ) {
      setTextModel(
        modelList.find((m) => m.provider + ':' + m.model === textModel)
      )
    } else {
      setTextModel(modelList.find((m) => m.type === 'text'))
    }

    // 设置选中的工具模型
    const selectedToolsJson = localStorage.getItem('selected_tools')
    let currentSelectedTools: ModelInfo[] = []

    if (selectedToolsJson) {
      const savedSelectedTools: ModelInfo[] = JSON.parse(selectedToolsJson)

      // 如果选中的工具在 allTools 中, 则设置选中的工具
      currentSelectedTools = allTools.filter((t) =>
        savedSelectedTools.find((a) => a.provider + ':' + a.model === t.provider + ':' + t.model)
      )
    }

    // 检测新添加的工具并自动选中
    const previousAllTools = previousAllToolsRef.current
    if (previousAllTools) {
      const newTools = allTools.filter((tool) => {
        const toolKey = tool.provider + ':' + tool.model
        // 检查是否不在上一次的工具列表中，且不在当前已选中的工具中
        return !previousAllTools.find((prevTool) =>
          prevTool.provider + ':' + prevTool.model === toolKey
        ) && !currentSelectedTools.find((selectedTool) =>
          selectedTool.provider + ':' + selectedTool.model === toolKey
        )
      })

      // 将新工具添加到已选中的工具中
      if (newTools.length > 0) {
        currentSelectedTools = [...currentSelectedTools, ...newTools]
      }
    }

    setSelectedTools(currentSelectedTools)
    localStorage.setItem('selected_tools', JSON.stringify(currentSelectedTools)) // 更新 localStorage

    // 更新 previousAllToolsRef 为当前的 allTools
    previousAllToolsRef.current = allTools

    // 如果文本模型或工具模型为空，则显示登录对话框
    if (textModels.length === 0 || allTools.length === 0) {
      setShowLoginDialog(true)
    }
  }, [
    modelList,
    setSelectedTools,
    setTextModel,
    setTextModels,
    setAllTools,
    setShowLoginDialog,
  ])

  return (
    <ConfigsContext.Provider
      value={{ configsStore: useConfigsStore, refreshModels }}
    >
      {children}
    </ConfigsContext.Provider>
  )
}

export const useConfigs = () => {
  const context = useContext(ConfigsContext)
  if (!context) {
    throw new Error('useConfigs must be used within a ConfigsProvider')
  }
  return context.configsStore()
}

export const useRefreshModels = () => {
  const context = useContext(ConfigsContext)
  if (!context) {
    throw new Error('useRefreshModels must be used within a ConfigsProvider')
  }
  return context.refreshModels
}
