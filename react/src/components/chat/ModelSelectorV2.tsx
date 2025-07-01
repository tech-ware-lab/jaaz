import {
  Select,
  SelectContent,
  SelectItem,
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
import { useState, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { Badge } from '../ui/badge'
import { useTranslation } from 'react-i18next'
import { PROVIDER_NAME_MAPPING } from '@/constants'
import { LLMConfig, Model } from '@/types/types'

const ModelSelector: React.FC = () => {
  const { textModel, setTextModel, textModels, tools, setTools } = useConfigs()

  // 多选图像模型状态
  const [selectedTools, setSelectedTools] = useState<string[]>([])

  const { t } = useTranslation()

  // 从localStorage加载已选择的图像模型
  useEffect(() => {
    const saved = localStorage.getItem('selected_multi_tools')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setSelectedTools(parsed)
      } catch (e) {
        console.error('Failed to parse selected image models:', e)
      }
    } else if (tools) {
      // 如果没有保存的多选数据，但有当前选中的模型，则初始化为该模型
      const toolKeys = tools.map((tool) => tool.provider + ':' + tool.model)
      setSelectedTools(toolKeys)
    }
  }, [tools])

  // 处理图像模型多选
  const handleImageModelToggle = (modelKey: string, checked: boolean) => {
    let newSelected: string[]
    if (checked) {
      newSelected = [...selectedTools, modelKey]
    } else {
      newSelected = selectedTools.filter((key) => key !== modelKey)
    }

    setSelectedTools(newSelected)
    localStorage.setItem('selected_multi_tools', JSON.stringify(newSelected))

    // 如果有选中的模型，将第一个设为当前imageModel（保持向后兼容）
    if (newSelected.length > 0) {
      const firstModel = tools?.find(
        (m) => m.provider + ':' + m.model === newSelected[0]
      )
      if (firstModel) {
        setTools([firstModel])
        localStorage.setItem('tools', JSON.stringify([firstModel]))
      }
    }
  }

  // 获取显示文本
  const getSelectedImageModelsText = () => {
    if (selectedTools.length === 0) return '‼️'
    // if (selectedImageModels.length === 1) {
    //   const model = imageModels?.find(
    //     (m) => m.provider + ':' + m.model === selectedImageModels[0]
    //   )
    //   return model?.model || selectedImageModels[0]
    // }
    return `${selectedTools.length}`
  }

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
  const groupedTools = groupModelsByProvider(tools)

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
                  <div className="flex items-center gap-2">
                    <img
                      src={getProviderDisplayName(provider).icon}
                      alt={getProviderDisplayName(provider).name}
                      className="w-6 h-6 rounded-full"
                    />
                    {getProviderDisplayName(provider).name}
                  </div>
                </DropdownMenuLabel>
                {models.map((model) => {
                  const modelKey = model.provider + ':' + model.model
                  return (
                    <DropdownMenuCheckboxItem
                      key={modelKey}
                      checked={selectedTools.includes(modelKey)}
                      onCheckedChange={(checked) =>
                        handleImageModelToggle(modelKey, checked)
                      }
                      onSelect={(e) => {
                        e.preventDefault()
                      }}
                    >
                      {model.model}
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
