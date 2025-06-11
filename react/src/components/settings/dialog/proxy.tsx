import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Network, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getSettings, updateSettings } from '@/api/settings'

type ProxyMode = 'none' | 'system' | 'custom'

interface ProxyConfig {
  mode: ProxyMode
  url: string
}

const SettingProxy = () => {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [testing, setTesting] = useState(false)
  const [proxyConfig, setProxyConfig] = useState<ProxyConfig>({
    mode: 'none',
    url: ''
  })

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const settings = await getSettings()

        // Extract proxy config from the response
        const proxyValue = (settings.proxy as string) || ''

        let mode: ProxyMode = 'none'
        let url = ''

        if (proxyValue === '') {
          mode = 'none'
        } else if (proxyValue === 'system') {
          mode = 'system'
        } else {
          mode = 'custom'
          url = proxyValue
        }

        setProxyConfig({ mode, url })
      } catch (error) {
        console.error('Error loading settings:', error)
        setErrorMessage(t('settings:messages.failedToLoad'))
      } finally {
        setIsLoading(false)
      }
    }

    loadConfig()
  }, [t])

  const handleModeChange = (mode: ProxyMode) => {
    setProxyConfig(prev => ({ ...prev, mode }))
  }

  const handleUrlChange = (url: string) => {
    setProxyConfig(prev => ({ ...prev, url }))
  }

  const handleSave = async () => {
    try {
      setErrorMessage('')

      let proxyValue: string
      switch (proxyConfig.mode) {
        case 'none':
          proxyValue = ''
          break
        case 'system':
          proxyValue = 'system'
          break
        case 'custom':
          proxyValue = proxyConfig.url.trim()
          break
        default:
          proxyValue = ''
      }

      // Save proxy settings
      const result = await updateSettings({
        proxy: proxyValue
      })

      if (result.status === 'success') {
        toast.success(result.message)
      } else {
        throw new Error(result.message || 'Failed to save settings')
      }
    } catch (error) {
      console.error('Error saving proxy settings:', error)
      setErrorMessage(t('settings:messages.failedToSave'))
    }
  }

  return (
    <div className="flex flex-col items-center justify-center p-4 relative w-full sm:pb-0 pb-10">
      {isLoading && (
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-zinc-500"></div>
        </div>
      )}

      {!isLoading && (
        <div className="w-full">
          <div className="flex items-center gap-2 mb-4">
            <Network className="h-5 w-5" />
            <h3 className="text-lg font-semibold">{t('settings:proxy:title')}</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            {t('settings:proxy:description')}
          </p>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="proxy-mode" className="text-sm font-medium">
                {t('settings:proxy:mode')}
              </Label>
              <Select value={proxyConfig.mode} onValueChange={handleModeChange}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder={t('settings:proxy:selectMode')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('settings:proxy:modes.none')}</SelectItem>
                  <SelectItem value="system">{t('settings:proxy:modes.system')}</SelectItem>
                  <SelectItem value="custom">{t('settings:proxy:modes.custom')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {proxyConfig.mode === 'custom' && (
              <div className="space-y-2">
                <Label htmlFor="proxy-url" className="text-sm font-medium">
                  {t('settings:proxy:url')}
                </Label>
                <Input
                  id="proxy-url"
                  type="text"
                  placeholder={t('settings:proxy:urlPlaceholder')}
                  value={proxyConfig.url}
                  onChange={(e) => handleUrlChange(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {t('settings:proxy:urlDescription')}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex justify-center fixed sm:bottom-2 sm:left-[calc(var(--sidebar-width)+0.45rem)] sm:translate-x-0 -translate-x-1/2 bottom-15 left-1/2 gap-1.5">
        <Button onClick={handleSave} disabled={isLoading}>
          <Save className="mr-2 h-4 w-4" /> {t('settings:saveSettings')}
        </Button>
      </div>

      {errorMessage && (
        <div className="text-red-500 text-center mb-4">{errorMessage}</div>
      )}
    </div>
  )
}

export default SettingProxy
