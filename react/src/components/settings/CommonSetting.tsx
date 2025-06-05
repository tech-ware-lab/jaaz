import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PROVIDER_NAME_MAPPING } from '@/constants'
import { LLMConfig } from '@/types/types'

interface CommonSettingProps {
  providerKey: string
  config: LLMConfig
  onConfigChange: (key: string, newConfig: LLMConfig) => void
}

export default function CommonSetting({
  providerKey,
  config,
  onConfigChange
}: CommonSettingProps) {
  const provider = PROVIDER_NAME_MAPPING[providerKey] || {
    name: providerKey.charAt(0).toUpperCase() + providerKey.slice(1).replace(/_/g, ' '),
    // TODO: replace icon
    icon: 'https://openai.com/favicon.ico'
  }

  const handleChange = (field: keyof LLMConfig, value: string | number) => {
    onConfigChange(providerKey, {
      ...config,
      [field]: value,
    })
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
        {isImageProvider && <span>🎨 Image Generation</span>}
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
