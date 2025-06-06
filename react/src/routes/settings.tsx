import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DEFAULT_CONFIG } from '@/constants'
import { LLMConfig } from '@/types/types'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowLeftIcon, Save, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import CommonSetting from '@/components/settings/CommonSetting'
import ComfyuiSetting from '@/components/settings/ComfyuiSetting'
import AddProviderDialog from '@/components/settings/AddProviderDialog'

export const Route = createFileRoute('/settings')({
  component: Settings,
})

export default function Settings() {
  const { t } = useTranslation()
  const [config, setConfig] = useState<{
    [key: string]: LLMConfig
  }>(DEFAULT_CONFIG)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [isAddProviderDialogOpen, setIsAddProviderDialogOpen] = useState(false)

  const navigate = useNavigate()

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch('/api/config')
        const config: { [key: string]: LLMConfig } = await response.json()

        setConfig(() => {
          const res: { [key: string]: LLMConfig } = {}

          // First, add custom providers that are not in DEFAULT_CONFIG
          for (const provider in config) {
            if (
              !(provider in DEFAULT_CONFIG) &&
              typeof config[provider] === 'object'
            ) {
              console.log('Adding custom provider:', provider, config[provider])
              res[provider] = config[provider]
            }
          }

          // Then, add providers from DEFAULT_CONFIG
          for (const provider in DEFAULT_CONFIG) {
            if (config[provider] && typeof config[provider] === 'object') {
              res[provider] = {
                ...DEFAULT_CONFIG[provider],
                ...config[provider],
              }
            } else {
              res[provider] = DEFAULT_CONFIG[provider]
            }
          }

          return res
        })

        // TODO: move to other place
        // Auto-start ComfyUI process if enabled and installed
        const isComfyUIEnabled =
          config.comfyui && Object.keys(config.comfyui.models || {}).length > 0
        if (isComfyUIEnabled && window.electronAPI?.checkComfyUIInstalled) {
          try {
            const installed = await window.electronAPI.checkComfyUIInstalled()
            if (installed) {
              // Check if process is already running
              const processStatus =
                await window.electronAPI.getComfyUIProcessStatus?.()
              if (!processStatus?.running) {
                // Start ComfyUI process
                const result = await window.electronAPI.startComfyUIProcess?.()
                if (result?.success) {
                  console.log('ComfyUI process auto-started successfully')
                } else {
                  console.log(
                    'Failed to auto-start ComfyUI process:',
                    result?.message
                  )
                }
              }
            }
          } catch (error) {
            console.error('Error auto-starting ComfyUI process:', error)
          }
        }
      } catch (error) {
        console.error('Error loading configuration:', error)
        setErrorMessage(t('settings:messages.failedToLoad'))
      } finally {
        setIsLoading(false)
      }
    }

    loadConfig()
  }, [])

  const handleConfigChange = (key: string, newConfig: LLMConfig) => {
    setConfig((prev) => ({
      ...prev,
      [key]: newConfig,
    }))
  }

  const handleAddProvider = (providerKey: string, newConfig: LLMConfig) => {
    setConfig((prev) => ({
      [providerKey]: newConfig,
      ...prev,
    }))
  }

  const handleDeleteProvider = (providerKey: string) => {
    setConfig((prev) => {
      const newConfig = { ...prev }
      delete newConfig[providerKey]
      return newConfig
    })
  }

  const handleSave = async () => {
    try {
      setErrorMessage('')

      const response = await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      })

      if (!response.ok) {
        throw new Error('Failed to save configuration')
      }

      const result = await response.json()
      if (result.status === 'success') {
        navigate({ to: '/' })
      } else {
        throw new Error(result.message || 'Failed to save configuration')
      }
    } catch (error) {
      console.error('Error saving settings:', error)
      setErrorMessage(t('settings:messages.failedToSave'))
    }
  }

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <Button
        onClick={() => navigate({ to: '/' })}
        className="fixed top-4 left-4"
        size={'icon'}
      >
        <ArrowLeftIcon />
      </Button>

      <Card className="w-full max-w-[800px] shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            {t('settings:title')}
          </CardTitle>
          <div className="pt-4">
            <Button
              onClick={() => setIsAddProviderDialogOpen(true)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              {t('settings:provider.addProvider')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pb-26">
          {isLoading && (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-zinc-500"></div>
            </div>
          )}

          {!isLoading &&
            Object.keys(config).map((key, index) => (
              <div key={key}>
                {key === 'comfyui' ? (
                  <ComfyuiSetting
                    config={config[key]}
                    onConfigChange={handleConfigChange}
                  />
                ) : (
                  <CommonSetting
                    providerKey={key}
                    config={config[key]}
                    onConfigChange={handleConfigChange}
                    onDeleteProvider={handleDeleteProvider}
                  />
                )}

                {index !== Object.keys(config).length - 1 && (
                  <div className="my-6 border-t bg-border" />
                )}
              </div>
            ))}

          <div className="flex justify-center fixed bottom-4 left-1/2 -translate-x-1/2">
            <Button onClick={handleSave} className="w-[400px]" size={'lg'}>
              <Save className="mr-2 h-4 w-4" /> {t('settings:saveSettings')}
            </Button>
          </div>

          {errorMessage && (
            <div className="text-red-500 text-center mb-4">{errorMessage}</div>
          )}
        </CardContent>
      </Card>

      <AddProviderDialog
        open={isAddProviderDialogOpen}
        onOpenChange={setIsAddProviderDialogOpen}
        onSave={handleAddProvider}
      />
    </div>
  )
}
