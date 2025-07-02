import { listModels } from '@/api/model'
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
  const { setTextModels, setImageModels, setTextModel, setImageModel } =
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
      const textModel = localStorage.getItem('text_model')
      if (
        textModel &&
        modelList.find((m) => m.provider + ':' + m.model == textModel)
      ) {
        setTextModel(
          modelList.find((m) => m.provider + ':' + m.model == textModel)
        )
      } else {
        setTextModel(modelList.find((m) => m.type == 'text'))
      }
      const imageModel = localStorage.getItem('image_model')
      if (
        imageModel &&
        modelList.find((m) => m.provider + ':' + m.model == imageModel)
      ) {
        setImageModel(
          modelList.find((m) => m.provider + ':' + m.model == imageModel)
        )
      } else {
        setImageModel(modelList.find((m) => m.type == 'image'))
      }

      const textModels = modelList?.filter((m) => m.type == 'text')
      const imageModels = modelList?.filter(
        (m) => m.type == 'image' || m.type == 'tool'
      )

      setTextModels(textModels || [])
      setImageModels(imageModels || [])
    }
  }, [
    modelList,
    setImageModel,
    setTextModel,
    setTextModels,
    setImageModels,
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
