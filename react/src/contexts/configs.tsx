import { getConfig } from '@/api/config'
import { listModels, ModelInfo, ToolInfo } from '@/api/model'
import { configs } from '@/constants'
import useConfigsStore from '@/stores/configs'
import { LLMConfig } from '@/types/types'
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
  const {
    providers,
    setProviders,
    setTextModels,
    setTextModel,
    setSelectedTools,
    setAllTools,
    setShowLoginDialog,
  } = configsStore

  // load global jaaz base api url from server
  configs.jaaz_base_api_url =
    providers['jaaz']?.url?.replace('/api/v1', '')?.replace(/\/$/, '') ||
    'https://jaaz.app'

  console.log('configs.jaaz_base_api_url', configs.jaaz_base_api_url)

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config: { [key: string]: LLMConfig } = await getConfig()
        setProviders(config)
      } catch (error) {}
    }
    loadConfig()
  }, [])

  const { data: modelList, refetch: refreshModels } = useQuery({
    queryKey: ['list_models_2'],
    queryFn: () => listModels(),
    staleTime: 1000, // 5分钟内数据被认为是新鲜的
    placeholderData: (previousData) => previousData, // 关键：显示旧数据同时获取新数据
    refetchOnWindowFocus: true, // 窗口获得焦点时重新获取
    refetchOnReconnect: true, // 网络重连时重新获取
    refetchOnMount: true, // 挂载时重新获取
  })

  useEffect(() => {
    if (!modelList) return
    const { llm: llmModels = [], tools: toolList = [] } = modelList

    setTextModels(llmModels || [])
    setAllTools(toolList || [])

    // 设置选择的文本模型
    const textModel = localStorage.getItem('text_model')
    if (
      textModel &&
      llmModels.find((m) => m.provider + ':' + m.model === textModel)
    ) {
      setTextModel(
        llmModels.find((m) => m.provider + ':' + m.model === textModel)
      )
    } else {
      setTextModel(llmModels.find((m) => m.type === 'text'))
    }

    // 设置选中的工具模型
    const disabledToolsJson = localStorage.getItem('disabled_tool_ids')
    let currentSelectedTools: ToolInfo[] = []
    // by default, all tools are selected
    currentSelectedTools = toolList
    if (disabledToolsJson) {
      try {
        const disabledToolIds: string[] = JSON.parse(disabledToolsJson)
        // filter out disabled tools
        currentSelectedTools = toolList.filter(
          (t) => !disabledToolIds.includes(t.id)
        )
      } catch (error) {
        console.error(error)
      }
    }

    setSelectedTools(currentSelectedTools)

    // 如果文本模型或工具模型为空，则显示登录对话框
    if (llmModels.length === 0 || toolList.length === 0) {
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
