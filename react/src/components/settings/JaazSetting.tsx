import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LOGO_URL } from '@/constants'
import { LLMConfig } from '@/types/types'
import { useTranslation } from 'react-i18next'
import AddModelsList from './AddModelsList'

interface JaazSettingProps {
  config: LLMConfig
  onConfigChange: (key: string, newConfig: LLMConfig) => void
}

export default function JaazSetting({
  config,
  onConfigChange,
}: JaazSettingProps) {
  const { t } = useTranslation()

  const handleModelsChange = (
    models: Record<string, { type?: 'text' | 'image' | 'video' }>
  ) => {
    onConfigChange('jaaz', {
      ...config,
      models,
    })
  }

  const handleChange = (field: keyof LLMConfig, value: string | number) => {
    onConfigChange('jaaz', {
      ...config,
      [field]: value,
    })
  }

  return (
    <div className="space-y-4">
      {/* Provider Header */}
      <div className="flex items-center gap-2">
        <img
          src={LOGO_URL}
          alt="Jaaz"
          className="w-10 h-10 rounded-full"
        />
        <p className="font-bold text-2xl w-fit">Jaaz</p>
        {/* <span>✨ Custom Provider</span> */}
      </div>

      {/* Models Configuration */}
      <div className="space-y-2">
        <AddModelsList
          models={config.models || {}}
          onChange={handleModelsChange}
          label={t('settings:models.title')}
        />
      </div>

      {/* Max Tokens Input */}
      <div className="space-y-2">
        <Label htmlFor="jaaz-maxTokens">
          {t('settings:provider.maxTokens')}
        </Label>
        <Input
          id="jaaz-maxTokens"
          type="number"
          placeholder={t('settings:provider.maxTokensPlaceholder')}
          value={config.max_tokens ?? 8192}
          onChange={(e) =>
            handleChange('max_tokens', parseInt(e.target.value))
          }
          className="w-full"
        />
        <p className="text-xs text-gray-500">
          {t('settings:provider.maxTokensDescription')}
        </p>
      </div>
    </div>
  )
}
