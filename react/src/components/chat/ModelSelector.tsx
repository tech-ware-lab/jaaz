import { listModels } from '@/api/model'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'

type Model = {
  provider: string
  model: string
  url: string
}

type ModelSelectorProps = {
  imageModel?: Model
  textModel?: Model
  setImageModel: (model?: Model) => void
  setTextModel: (model?: Model) => void
}

const ModelSelector: React.FC<ModelSelectorProps> = ({
  imageModel,
  textModel,
  setImageModel,
  setTextModel,
}) => {
  const { data: modelList } = useQuery({
    queryKey: ['list_models'],
    queryFn: () => listModels(),
  })

  const textModels = modelList?.filter((m) => m.type == 'text')
  const imageModels = modelList?.filter((m) => m.type == 'image')

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
    }
  }, [modelList, setImageModel, setTextModel])

  return (
    <>
      <Select
        value={textModel?.provider + ':' + textModel?.model}
        onValueChange={(value) => {
          localStorage.setItem('text_model', value)
          setTextModel(
            modelList?.find((m) => m.provider + ':' + m.model == value)
          )
        }}
      >
        <SelectTrigger className="w-fit max-w-[40%] bg-background">
          <SelectValue placeholder="Theme" />
        </SelectTrigger>
        <SelectContent>
          {textModels?.map((model) => (
            <SelectItem
              key={model.provider + ':' + model.model}
              value={model.provider + ':' + model.model}
            >
              {model.model}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={imageModel?.provider + ':' + imageModel?.model}
        onValueChange={(value) => {
          localStorage.setItem('image_model', value)
          setImageModel(
            modelList?.find((m) => m.provider + ':' + m.model == value)
          )
        }}
      >
        <SelectTrigger className="w-fit max-w-[40%] bg-background">
          <span>🎨</span>
          <SelectValue placeholder="Theme" />
        </SelectTrigger>
        <SelectContent>
          {imageModels?.map((model) => (
            <SelectItem
              key={model.provider + ':' + model.model}
              value={model.provider + ':' + model.model}
            >
              {model.model}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  )
}

export default ModelSelector
