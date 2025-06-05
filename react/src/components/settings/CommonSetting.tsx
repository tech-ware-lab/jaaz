import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { PROVIDER_NAME_MAPPING } from '@/constants'
import { LLMConfig } from '@/types/types'
import AddModelsList from './AddModelsList'
import { Trash2 } from 'lucide-react'

interface CommonSettingProps {
  providerKey: string
  config: LLMConfig
  onConfigChange: (key: string, newConfig: LLMConfig) => void
  onDeleteProvider?: (providerKey: string) => void
}

export default function CommonSetting({
  providerKey,
  config,
  onConfigChange,
  onDeleteProvider
}: CommonSettingProps) {
  const provider = PROVIDER_NAME_MAPPING[providerKey] || {
    name: providerKey.charAt(0).toUpperCase() + providerKey.slice(1).replace(/_/g, ' '),
    // TODO: replace icon
    icon: 'https://openai.com/favicon.ico'
  }

  // Check if this is a custom provider (not in PROVIDER_NAME_MAPPING)
  const isCustomProvider = !(providerKey in PROVIDER_NAME_MAPPING)

  const handleChange = (field: keyof LLMConfig, value: string | number) => {
    onConfigChange(providerKey, {
      ...config,
      [field]: value,
    })
  }

  const handleModelsChange = (models: Record<string, { type?: 'text' | 'image' | 'video' }>) => {
    onConfigChange(providerKey, {
      ...config,
      models,
    })
  }

  const handleDelete = () => {
    if (onDeleteProvider && isCustomProvider) {
      onDeleteProvider(providerKey)
    }
  }

  const isImageProvider = providerKey === 'replicate' || providerKey === 'huggingface'
  const hasMaxTokens = !isImageProvider

  return (
    <div className="space-y-4">
      {/* Provider Header */}
      <div className="flex items-center gap-2">
        <img
          src={provider.icon}
          alt={provider.name}
          className="w-10 h-10 rounded-full"
        />
        <p className="font-bold text-2xl w-fit">
          {provider.name}
        </p>
        {isCustomProvider && <span>✨ Custom Provider</span>}
        {isImageProvider && <span>🎨 Image Generation</span>}

        {/* Delete Button - only for custom providers */}
        {isCustomProvider && onDeleteProvider && (
          <div className="ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          </div>
        )}
      </div>

      {/* API URL Input */}
      <div className="space-y-2">
        <Label htmlFor={`${providerKey}-url`}>API URL</Label>
        <Input
          id={`${providerKey}-url`}
          placeholder="Enter your API URL"
          value={config.url ?? ''}
          onChange={(e) => handleChange('url', e.target.value)}
          className="w-full"
        />
      </div>

      {/* API Key Input */}
      <div className="space-y-2">
        <Label htmlFor={`${providerKey}-apiKey`}>API Key</Label>
        <Input
          id={`${providerKey}-apiKey`}
          type="password"
          placeholder="Enter your API key"
          value={config.api_key ?? ''}
          onChange={(e) => handleChange('api_key', e.target.value)}
          className="w-full"
        />
        <p className="text-xs text-gray-500">
          Your API key will be stored securely
        </p>
      </div>

      {/* Models Configuration - only for custom providers */}
      {isCustomProvider && (
        <div className="space-y-2">
          <AddModelsList
            models={config.models || {}}
            onChange={handleModelsChange}
            label="Models"
          />
        </div>
      )}

      {/* Max Tokens Input - only for text providers */}
      {hasMaxTokens && (
        <div className="space-y-2">
          <Label htmlFor={`${providerKey}-maxTokens`}>Max Tokens</Label>
          <Input
            id={`${providerKey}-maxTokens`}
            type="number"
            placeholder="Enter your max tokens"
            value={config.max_tokens ?? 8192}
            onChange={(e) => handleChange('max_tokens', parseInt(e.target.value))}
            className="w-full"
          />
          <p className="text-xs text-gray-500">
            The maximum number of tokens in the response
          </p>
        </div>
      )}
    </div>
  )
}
