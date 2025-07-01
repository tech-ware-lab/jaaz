import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from '@/components/ui/select'
import { useConfigs } from '@/contexts/configs'
import { PROVIDER_NAME_MAPPING } from '@/constants'

const ModelSelector: React.FC = () => {
  const {
    textModel,
    imageModel,
    videoModel,
    setTextModel,
    setImageModel,
    setVideoModel,
    textModels,
    imageModels,
    videoModels,
  } = useConfigs()

  // Group models by provider
  const groupModelsByProvider = (models: typeof textModels) => {
    const grouped: { [provider: string]: typeof textModels } = {}
    models?.forEach((model) => {
      if (!grouped[model.provider]) {
        grouped[model.provider] = []
      }
      grouped[model.provider].push(model)
    })
    return grouped
  }

  const groupedTextModels = groupModelsByProvider(textModels)
  // Combine image and video models for unified multimedia selector
  // For video models with multiple types, create a single entry with type info
  const expandedVideoModels = (videoModels || []).map((model) => {
    if (Array.isArray(model.type)) {
      return {
        ...model,
        model: `${model.model} `,
        originalModel: model.model,
        supportedTypes: model.type,
      }
    }
    return model
  })

  const multimediaModels = [...(imageModels || []), ...expandedVideoModels]
  const groupedMultimediaModels = groupModelsByProvider(multimediaModels)

  // Sort providers to put Jaaz first
  const sortProviders = (providers: [string, typeof textModels][]) => {
    return providers.sort(([providerA], [providerB]) => {
      if (providerA === 'jaaz') return -1
      if (providerB === 'jaaz') return 1
      return 0
    })
  }

  const getProviderDisplayName = (provider: string) => {
    const providerInfo = PROVIDER_NAME_MAPPING[provider]
    return {
      name: providerInfo?.name || provider,
      icon: providerInfo?.icon,
    }
  }

  return (
    <>
      <Select
        value={textModel?.provider + ':' + textModel?.model}
        onValueChange={(value) => {
          localStorage.setItem('text_model', value)
          setTextModel(
            textModels?.find((m) => m.provider + ':' + m.model == value)
          )
        }}
      >
        <SelectTrigger className="w-fit max-w-[40%] bg-background">
          <SelectValue placeholder="Theme" />
        </SelectTrigger>
        <SelectContent>
          {sortProviders(Object.entries(groupedTextModels)).map(
            ([provider, models]) => {
              const providerInfo = getProviderDisplayName(provider)
              return (
                <SelectGroup key={provider}>
                  <SelectLabel className="flex items-center gap-2 select-none">
                    {providerInfo.icon && (
                      <img
                        src={providerInfo.icon}
                        alt={providerInfo.name}
                        className="w-4 h-4 rounded-sm"
                      />
                    )}
                    {providerInfo.name}
                  </SelectLabel>
                  {models.map((model) => (
                    <SelectItem
                      key={model.provider + ':' + model.model}
                      value={model.provider + ':' + model.model}
                    >
                      {model.model}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )
            }
          )}
        </SelectContent>
      </Select>
      <Select
        value={
          (imageModel && `${imageModel.provider}:${imageModel.model}`) ||
          (videoModel &&
            multimediaModels?.find(
              (m) =>
                m.provider === videoModel.provider &&
                ((m.originalModel && m.originalModel === videoModel.model) ||
                  m.model === videoModel.model)
            )?.provider +
              ':' +
              multimediaModels?.find(
                (m) =>
                  m.provider === videoModel.provider &&
                  ((m.originalModel && m.originalModel === videoModel.model) ||
                    m.model === videoModel.model)
              )?.model) ||
          ''
        }
        onValueChange={(value) => {
          const selectedModel = multimediaModels?.find(
            (m) => m.provider + ':' + m.model == value
          )
          if (
            selectedModel?.type === 'image' ||
            selectedModel?.type === 'tool'
          ) {
            // For image models, also use original model name if available
            const originalModel = {
              ...selectedModel,
              model: selectedModel.originalModel || selectedModel.model,
            }
            const originalValue = `${originalModel.provider}:${originalModel.model}`
            localStorage.setItem('image_model', originalValue)
            setImageModel(originalModel)
            setVideoModel(undefined)
            localStorage.removeItem('video_model')
          } else if (
            selectedModel?.type === 'video' ||
            selectedModel?.supportedTypes ||
            (Array.isArray(selectedModel?.type) &&
              selectedModel?.type.includes('video'))
          ) {
            // For video models, save the original model info
            const originalModel = {
              ...selectedModel,
              model: selectedModel.originalModel || selectedModel.model,
              type: selectedModel.supportedTypes || selectedModel.type,
            }
            const originalValue = `${originalModel.provider}:${originalModel.model}`
            localStorage.setItem('video_model', originalValue)
            setVideoModel(originalModel)
            setImageModel(undefined)
            localStorage.removeItem('image_model')
          }
        }}
      >
        <SelectTrigger className="w-fit max-w-[40%] bg-background">
          <SelectValue placeholder="Multimedia Model" />
        </SelectTrigger>
        <SelectContent>
          {sortProviders(Object.entries(groupedMultimediaModels)).map(
            ([provider, models]) => {
              const providerInfo = getProviderDisplayName(provider)
              return (
                <SelectGroup key={provider}>
                  <SelectLabel className="flex items-center gap-2 select-none">
                    {providerInfo.icon && (
                      <img
                        src={providerInfo.icon}
                        alt={providerInfo.name}
                        className="w-4 h-4 rounded-sm"
                      />
                    )}
                    {providerInfo.name}
                  </SelectLabel>
                  {models.map((model) => {
                    const isVideo =
                      model.type === 'video' ||
                      model.supportedTypes ||
                      (Array.isArray(model.type) &&
                        model.type.includes('video'))
                    return (
                      <SelectItem
                        key={model.provider + ':' + model.model}
                        value={model.provider + ':' + model.model}
                      >
                        <span className="flex items-center gap-2">
                          {isVideo ? '🎬' : '🎨'}
                          {model.model}
                        </span>
                      </SelectItem>
                    )
                  })}
                </SelectGroup>
              )
            }
          )}
        </SelectContent>
      </Select>
    </>
  )
}

export default ModelSelector
