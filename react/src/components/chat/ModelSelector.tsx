import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useConfigs } from '@/contexts/configs'

const ModelSelector: React.FC = () => {
  const { configsStore } = useConfigs()
  const {
    textModel,
    imageModel,
    setTextModel,
    setImageModel,
    textModels,
    imageModels,
  } = configsStore.getState()

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
            imageModels?.find((m) => m.provider + ':' + m.model == value)
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
