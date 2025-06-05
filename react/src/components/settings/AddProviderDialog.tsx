import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, X } from 'lucide-react'
import { LLMConfig } from '@/types/types'

interface AddProviderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (providerKey: string, config: LLMConfig) => void
}

type ModelItem = {
  name: string
  type: 'text' | 'image' | 'video'
}

export default function AddProviderDialog({
  open,
  onOpenChange,
  onSave
}: AddProviderDialogProps) {
  const [providerName, setProviderName] = useState('')
  const [apiUrl, setApiUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [models, setModels] = useState<ModelItem[]>([{ name: '', type: 'text' }])

  const handleAddModel = () => {
    setModels([...models, { name: '', type: 'text' }])
  }

  const handleRemoveModel = (index: number) => {
    if (models.length > 1) {
      setModels(models.filter((_, i) => i !== index))
    }
  }

  const handleModelChange = (index: number, field: keyof ModelItem, value: string) => {
    const newModels = [...models]
    if (field === 'type') {
      newModels[index][field] = value as 'text' | 'image' | 'video'
    } else {
      newModels[index][field] = value
    }
    setModels(newModels)
  }

  const handleSave = () => {
    if (!providerName.trim() || !apiUrl.trim()) {
      return
    }

    // Filter out empty model names
    const validModels = models.filter(model => model.name.trim())

    // Create models object with specified types
    const modelsConfig: Record<string, { type?: 'text' | 'image' | 'video' }> = {}
    validModels.forEach(model => {
      modelsConfig[model.name] = { type: model.type }
    })

    const config: LLMConfig = {
      models: modelsConfig,
      url: apiUrl,
      api_key: apiKey,
      max_tokens: 8192
    }

    // Use provider name as key (convert to lowercase and replace spaces with underscores)
    const providerKey = providerName.toLowerCase().replace(/\s+/g, '_')

    onSave(providerKey, config)

    // Reset form
    setProviderName('')
    setApiUrl('')
    setApiKey('')
    setModels([{ name: '', type: 'text' }])
    onOpenChange(false)
  }

  const handleCancel = () => {
    // Reset form
    setProviderName('')
    setApiUrl('')
    setApiKey('')
    setModels([{ name: '', type: 'text' }])
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Provider</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Provider Name */}
          <div className="space-y-2">
            <Label htmlFor="provider-name">Provider Name</Label>
            <Input
              id="provider-name"
              placeholder="Enter provider name"
              value={providerName}
              onChange={(e) => setProviderName(e.target.value)}
            />
          </div>

          {/* API URL */}
          <div className="space-y-2">
            <Label htmlFor="api-url">API URL</Label>
            <Input
              id="api-url"
              placeholder="Enter API URL"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
            />
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <Label htmlFor="api-key">API Key</Label>
            <Input
              id="api-key"
              type="password"
              placeholder="Enter API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>

          {/* Models */}
          <div className="space-y-2">
            <Label>Models</Label>

            <div className="space-y-2">
              {models.map((model, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    placeholder="Enter model name"
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
                  {models.length > 1 && (
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
                Add Model
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!providerName.trim() || !apiUrl.trim()}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
