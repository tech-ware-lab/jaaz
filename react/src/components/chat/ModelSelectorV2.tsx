import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { useConfigs } from '@/contexts/configs'
import { ChevronDown } from 'lucide-react'
import { PROVIDER_NAME_MAPPING } from '@/constants'
import { ModelInfo, ToolInfo } from '@/api/model'

const ModelSelector: React.FC = () => {
  const {
    textModel,
    setTextModel,
    textModels,
    selectedTools,
    setSelectedTools,
    allTools,
  } = useConfigs()
  const selectedToolKeys = selectedTools.map(
    (tool) => tool.provider + ':' + tool.id
  )

  // 处理图像模型多选
  const handleImageModelToggle = (modelKey: string, checked: boolean) => {
    let newSelected: ToolInfo[] = []
    const tool = allTools.find((m) => m.provider + ':' + m.id === modelKey)
    if (checked) {
      if (tool) {
        newSelected = [...selectedTools, tool]
      }
    } else {
      newSelected = selectedTools.filter(
        (t) => t.provider + ':' + t.id !== modelKey
      )
    }

    setSelectedTools(newSelected)
    localStorage.setItem(
      'disabled_tool_ids',
      JSON.stringify(
        allTools.filter((t) => !newSelected.includes(t)).map((t) => t.id)
      )
    )
  }

  // 获取显示文本
  const getSelectedImageModelsText = () => {
    if (selectedTools.length === 0) return '‼️'
    return `${selectedTools.length}`
  }

  // Group models by provider
  const groupModelsByProvider = (models: typeof allTools) => {
    const grouped: { [provider: string]: typeof allTools } = {}
    models?.forEach((model) => {
      if (!grouped[model.provider]) {
        grouped[model.provider] = []
      }
      grouped[model.provider].push(model)
    })
    return grouped
  }

  const groupLLMsByProvider = (models: typeof textModels) => {
    const grouped: { [provider: string]: typeof textModels } = {}
    models?.forEach((model) => {
      if (!grouped[model.provider]) {
        grouped[model.provider] = []
      }
      grouped[model.provider].push(model)
    })
    return grouped
  }
  const groupedLLMs = groupLLMsByProvider(textModels)
  const groupedTools = groupModelsByProvider(allTools)

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
          {Object.entries(groupedLLMs).map(([provider, models]) => {
            return (
              <SelectGroup key={provider}>
                <SelectLabel>{provider}</SelectLabel>
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
          })}
        </SelectContent>
      </Select>

      {/* 多选图像模型下拉菜单 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="w-fit max-w-[40%] bg-background justify-between overflow-hidden"
          >
            <span>🎨</span>
            <span className="bg-primary text-primary-foreground rounded-full text-[0.7rem] w-[1.5rem]">
              {getSelectedImageModelsText()}
            </span>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-100">
          {Object.entries(groupedTools).map(([provider, models]) => {
            const getProviderDisplayName = (provider: string) => {
              const providerInfo = PROVIDER_NAME_MAPPING[provider]
              return {
                name: providerInfo?.name || provider,
                icon: providerInfo?.icon,
              }
            }
            return (
              <DropdownMenuGroup key={provider}>
                <DropdownMenuLabel>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <img
                      src={getProviderDisplayName(provider).icon}
                      alt={getProviderDisplayName(provider).name}
                      className="w-4 h-4 rounded-full"
                    />
                    {getProviderDisplayName(provider).name}
                  </div>
                </DropdownMenuLabel>
                {models.map((model) => {
                  const modelKey = model.provider + ':' + model.id
                  return (
                    <DropdownMenuCheckboxItem
                      key={modelKey}
                      checked={selectedToolKeys.includes(modelKey)}
                      onCheckedChange={(checked) =>
                        handleImageModelToggle(modelKey, checked)
                      }
                      onSelect={(e) => {
                        e.preventDefault()
                      }}
                    >
                      {model.display_name || model.id}
                    </DropdownMenuCheckboxItem>
                  )
                })}
                <DropdownMenuSeparator />
              </DropdownMenuGroup>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}

export default ModelSelector
