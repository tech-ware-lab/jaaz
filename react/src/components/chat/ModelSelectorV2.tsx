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
import { listModels, ModelInfo } from '@/api/model'
import { useQuery } from '@tanstack/react-query'

const ModelSelector: React.FC = () => {
  const { textModel, setTextModel, textModels, selectedTools, setSelectedTools } = useConfigs()
  const selectedToolKeys = selectedTools.map((tool) => tool.provider + ':' + tool.model)

  const { data: modelList = [], refetch: refreshModels } = useQuery({
    queryKey: ['list_models'],
    queryFn: () => listModels(),
    staleTime: 1 * 60 * 1000, // 5分钟内数据被认为是新鲜的
    placeholderData: (previousData) => previousData, // 关键：显示旧数据同时获取新数据
    refetchOnWindowFocus: true, // 窗口获得焦点时重新获取
    refetchOnReconnect: true, // 网络重连时重新获取
  })
  const toolsList = modelList.filter(
    (m) => m.type == 'tool' || m.type == 'image' || m.type == 'video'
  )

  // 从localStorage加载已选择的图像模型
  useEffect(() => {
    const saved = localStorage.getItem('selected_tools')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        // setSelectedTools(parsed)
      } catch (e) {
        console.error('Failed to parse selected image models:', e)
      }
    } else if (selectedTools) {
      // 如果没有保存的多选数据，但有当前选中的模型，则初始化为该模型
      const toolKeys = selectedTools.map((tool) => tool.provider + ':' + tool.model)
      // setSelectedTools(toolKeys)
    }
  }, [selectedTools])

  // 处理图像模型多选
  const handleImageModelToggle = (modelKey: string, checked: boolean) => {
    let newSelected: ModelInfo[] = []
    const tool = toolsList.find((m) => m.provider + ':' + m.model === modelKey)
    if (checked) {
      if (tool) {
        newSelected = [...selectedTools, tool]
      }
    } else {
      newSelected = selectedTools.filter((t) => t.provider + ':' + t.model !== modelKey)
    }

    setSelectedTools(newSelected)
    localStorage.setItem('selected_tools', JSON.stringify(newSelected))
  }

  // 获取显示文本
  const getSelectedImageModelsText = () => {
    if (selectedTools.length === 0) return '‼️'
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
  const groupedTools = groupModelsByProvider(toolsList)

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
                  const modelKey = model.provider + ':' + model.model
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
