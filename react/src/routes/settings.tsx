import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DEFAULT_CONFIG } from '@/constants'
import { LLMConfig } from '@/types/types'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowLeftIcon, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import CommonSetting from '@/components/settings/CommonSetting'
import ComfyuiSetting from '@/components/settings/ComfyuiSetting'

export const Route = createFileRoute('/settings')({
  component: Settings,
})

export default function Settings() {
  const [config, setConfig] = useState<{
    [key: string]: LLMConfig
  }>(DEFAULT_CONFIG)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const navigate = useNavigate()

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch('/api/config')
        const config: { [key: string]: LLMConfig } = await response.json()
        setConfig((curConfig) => {
          const res: { [key: string]: LLMConfig } = {}
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
        const isComfyUIEnabled = config.comfyui && Object.keys(config.comfyui.models || {}).length > 0
        if (isComfyUIEnabled && window.electronAPI?.checkComfyUIInstalled) {
          try {
            const installed = await window.electronAPI.checkComfyUIInstalled()
            if (installed) {
              // Check if process is already running
              const processStatus = await window.electronAPI.getComfyUIProcessStatus?.()
              if (!processStatus?.running) {
                // Start ComfyUI process
                const result = await window.electronAPI.startComfyUIProcess?.()
                if (result?.success) {
                  console.log('ComfyUI process auto-started successfully')
                } else {
                  console.log('Failed to auto-start ComfyUI process:', result?.message)
                }
              }
            }
          } catch (error) {
            console.error('Error auto-starting ComfyUI process:', error)
          }
        }
      } catch (error) {
        console.error('Error loading configuration:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadConfig()
  }, [])

  const handleConfigChange = (key: string, newConfig: LLMConfig) => {
    setConfig(prev => ({
      ...prev,
      [key]: newConfig
    }))
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
      setErrorMessage('Failed to save settings')
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
            Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pb-26">
          {isLoading && (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-zinc-500"></div>
            </div>
          )}

          {!isLoading && Object.keys(config).map((key, index) => (
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
                />
              )}

              {index !== Object.keys(config).length - 1 && (
                <div className="my-6 border-t bg-border" />
              )}
            </div>
          ))}

          <div className="flex justify-center fixed bottom-4 left-1/2 -translate-x-1/2">
            <Button onClick={handleSave} className="w-[400px]" size={'lg'}>
              <Save className="mr-2 h-4 w-4" /> Save Settings
            </Button>
          </div>

          {errorMessage && (
            <div className="text-red-500 text-center mb-4">{errorMessage}</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
