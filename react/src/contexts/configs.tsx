import { listModels, ModelInfo } from '@/api/model'
import useConfigsStore from '@/stores/configs'
import { useQuery } from '@tanstack/react-query'
import { createContext, useContext, useEffect } from 'react'

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
  const { setTextModels, setTextModel, setSelectedTools, setAllTools } =
    configsStore

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

    if (modelList.length > 0) {
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
      if (selectedToolsJson) {
        const savedSelectedTools: ModelInfo[] = JSON.parse(selectedToolsJson)

        // 如果选中的工具在 allTools 中, 则设置选中的工具
        const selectedTools = savedSelectedTools.filter((t) =>
          allTools.find((a) => a.provider + ':' + a.model === t.provider + ':' + t.model)
        )
        setSelectedTools(selectedTools)
        localStorage.setItem('selected_tools', JSON.stringify(selectedTools)) // 更新 localStorage
      }
    }
  }, [
    modelList,
    setSelectedTools,
    setTextModel,
    setTextModels,
    setAllTools,
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
