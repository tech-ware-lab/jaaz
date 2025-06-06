import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export type ModelItem = {
  name: string
  type: 'text' | 'image' | 'video'
}

interface ModelsListProps {
  models: Record<string, { type?: 'text' | 'image' | 'video' }>
  onChange: (models: Record<string, { type?: 'text' | 'image' | 'video' }>) => void
  label?: string
}

export default function AddModelsList({ models, onChange, label }: ModelsListProps) {
  const { t } = useTranslation('settings')
  const [modelItems, setModelItems] = useState<ModelItem[]>([])
  const [isInitialized, setIsInitialized] = useState(false)

  // Initialize state only once when models prop changes from outside
  useEffect(() => {
    if (!isInitialized) {
      const items = Object.entries(models).map(([name, config]) => ({
        name,
        type: (config.type || 'text') as 'text' | 'image' | 'video'
      }))
      setModelItems(items.length > 0 ? items : [{ name: '', type: 'text' }])
      setIsInitialized(true)
    }
  }, [models, isInitialized])

  const notifyChange = useCallback((items: ModelItem[]) => {
    // Filter out empty model names and convert back to object format
    const validModels = items.filter(model => model.name.trim())
    const modelsConfig: Record<string, { type?: 'text' | 'image' | 'video' }> = {}

    validModels.forEach(model => {
      modelsConfig[model.name] = { type: model.type }
    })

    onChange(modelsConfig)
  }, [onChange])

  const handleAddModel = () => {
    const newItems = [...modelItems, { name: '', type: 'text' as const }]
    setModelItems(newItems)
  }

  const handleRemoveModel = (index: number) => {
    if (modelItems.length > 1) {
      const newItems = modelItems.filter((_, i) => i !== index)
      setModelItems(newItems)
      notifyChange(newItems)
    }
  }

  const handleModelChange = (index: number, field: keyof ModelItem, value: string) => {
    const newItems = [...modelItems]
    if (field === 'type') {
      newItems[index][field] = value as 'text' | 'image' | 'video'
    } else {
      newItems[index][field] = value
    }
    setModelItems(newItems)
    notifyChange(newItems)
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>

      <div className="space-y-2">
        {modelItems.map((model, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              placeholder={t('models.placeholder')}
              value={model.name}
              onChange={(e) => handleModelChange(index, 'name', e.target.value)}
              className="flex-1"
            />
            <Select
              value={model.type}
              onValueChange={(value) => handleModelChange(index, 'type', value)}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">text</SelectItem>
                <SelectItem value="image">image</SelectItem>
                <SelectItem value="video">video</SelectItem>
              </SelectContent>
            </Select>
            {modelItems.length > 1 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleRemoveModel(index)}
                className="h-10 w-10 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>

      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddModel}
          className="h-8"
        >
          <Plus className="h-4 w-4 mr-1" />
          {t('models.addModel')}
        </Button>
      </div>
    </div>
  )
}
