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
import { LLMConfig } from '@/types/types'
import { useTranslation } from 'react-i18next'
import AddModelsList from './AddModelsList'

interface AddProviderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (providerKey: string, config: LLMConfig) => void
}

export default function AddProviderDialog({
  open,
  onOpenChange,
  onSave
}: AddProviderDialogProps) {
  const { t } = useTranslation()
  const [providerName, setProviderName] = useState('')
  const [apiUrl, setApiUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [models, setModels] = useState<Record<string, { type?: 'text' | 'image' | 'video' }>>({})

  const handleSave = () => {
    if (!providerName.trim() || !apiUrl.trim()) {
      return
    }

    const config: LLMConfig = {
      models,
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
    setModels({})
    onOpenChange(false)
  }

  const handleCancel = () => {
    // Reset form
    setProviderName('')
    setApiUrl('')
    setApiKey('')
    setModels({})
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('settings:provider.addProvider')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Provider Name */}
          <div className="space-y-2">
            <Label htmlFor="provider-name">{t('settings:provider.providerName')}</Label>
            <Input
              id="provider-name"
              placeholder={t('settings:provider.providerNamePlaceholder')}
              value={providerName}
              onChange={(e) => setProviderName(e.target.value)}
            />
          </div>

          {/* API URL */}
          <div className="space-y-2">
            <Label htmlFor="api-url">{t('settings:provider.apiUrl')}</Label>
            <Input
              id="api-url"
              placeholder={t('settings:provider.apiUrlPlaceholder')}
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
            />
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <Label htmlFor="api-key">{t('settings:provider.apiKey')}</Label>
            <Input
              id="api-key"
              type="password"
              placeholder={t('settings:provider.apiKeyPlaceholder')}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>

          {/* Models */}
          <AddModelsList
            models={models}
            onChange={setModels}
            label={t('settings:models.title')}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            {t('settings:provider.cancel')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={!providerName.trim() || !apiUrl.trim()}
          >
            {t('settings:provider.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
