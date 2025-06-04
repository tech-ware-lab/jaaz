import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { DEFAULT_CONFIG, PROVIDER_NAME_MAPPING } from '@/constants'
import { LLMConfig } from '@/types/types'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowLeftIcon, Save, Download, CheckCircle, AlertCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import InstallComfyUIDialog from '@/components/comfyui/InstallComfyUIDialog'

export const Route = createFileRoute('/settings')({
  component: Settings,
})

export default function Settings() {
  const [provider, setProvider] = useState('anthropic')
  const [config, setConfig] = useState<{
    [key: string]: LLMConfig
  }>(DEFAULT_CONFIG)
  const [isApiKeyDirty, setIsApiKeyDirty] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [showInstallDialog, setShowInstallDialog] = useState(false)
  const [comfyUIStatus, setComfyUIStatus] = useState<'unknown' | 'installed' | 'not-installed' | 'running'>('unknown')
  const [comfyUIEnabled, setComfyUIEnabled] = useState(false)

  const navigate = useNavigate()

  // Check ComfyUI status
  const checkComfyUIStatus = async () => {
    if (!comfyUIEnabled) {
      setComfyUIStatus('unknown')
      return
    }

    try {
      // First check if ComfyUI process is running via electron API
      if (window.electronAPI?.getComfyUIProcessStatus) {
        const processStatus = await window.electronAPI.getComfyUIProcessStatus()
        console.log('🦄 ComfyUI process status:', processStatus)
        if (processStatus.running) {
          setComfyUIStatus('running')
          return
        }
      }

      // If process is not running, check if ComfyUI is responding via HTTP
      try {
        console.log('🦄 Checking ComfyUI HTTP response...')
        const response = await fetch('http://127.0.0.1:8188/system_stats', {
          method: 'GET',
          signal: AbortSignal.timeout(3000) // 3 second timeout
        })
        console.log('🦄 ComfyUI HTTP response status:', response.status)
        if (response.ok) {
          setComfyUIStatus('running')
          return
        }
      } catch (error) {
        console.log('🦄 2. HTTP Error:', error instanceof Error ? error.message : String(error))
        // ComfyUI is not running via HTTP, continue to check installation
      }

      // Check if ComfyUI is installed via electron API
      if (window.electronAPI?.checkComfyUIInstalled) {
        try {
          const installed = await window.electronAPI.checkComfyUIInstalled()
          console.log('🦄 ComfyUI installation status:', installed)
          setComfyUIStatus(installed ? 'installed' : 'not-installed')
        } catch (error) {
          console.log('🦄 ComfyUI installation check failed:', error instanceof Error ? error.message : String(error))
          setComfyUIStatus('not-installed')
        }
      } else {
        setComfyUIStatus('not-installed')
      }
    } catch (error) {
      console.error('Error checking ComfyUI status:', error)
      setComfyUIStatus('not-installed')
    }
  }

  // Manual verification function for debugging
  const verifyComfyUIStatus = async () => {
    console.log('🦄 === Manual ComfyUI Status Verification ===')

    // 1. Check process status
    try {
      const processStatus = await window.electronAPI?.getComfyUIProcessStatus()
      console.log('🦄 1. Process Status:', processStatus)
    } catch (error) {
      console.log('🦄 1. Process Status Error:', error)
    }

    // 2. Check HTTP response
    try {
      const response = await fetch('http://127.0.0.1:8188/system_stats', {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      })
      console.log('🦄 2. HTTP Status:', response.status, response.ok)
      if (response.ok) {
        const data = await response.json()
        console.log('🦄 2. HTTP Response Data:', data)
      }
    } catch (error) {
      console.log('🦄 2. HTTP Error:', error instanceof Error ? error.message : String(error))
    }

    // 3. Check installation
    try {
      const installed = await window.electronAPI?.checkComfyUIInstalled()
      console.log('🦄 3. Installation Status:', installed)
    } catch (error) {
      console.log('🦄 3. Installation Error:', error instanceof Error ? error.message : String(error))
    }

    // 4. Try to access ComfyUI web interface
    console.log('🦄 4. You can manually check by opening: http://127.0.0.1:8188 in your browser')
    console.log('🦄 === End Verification ===')
  }

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

        // Check if ComfyUI is enabled in config
        const isComfyUIEnabled = config.comfyui && Object.keys(config.comfyui.models || {}).length > 0
        setComfyUIEnabled(isComfyUIEnabled)

        // Auto-start ComfyUI process if enabled and installed
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

  // Check ComfyUI status when enabled state changes
  useEffect(() => {
    checkComfyUIStatus()
  }, [comfyUIEnabled])

  const handleSave = async () => {
    try {
      setErrorMessage('')

      // If ComfyUI is disabled, remove its models from config
      const configToSave = { ...config }
      if (!comfyUIEnabled && configToSave.comfyui) {
        configToSave.comfyui = {
          ...configToSave.comfyui,
          models: {}
        }
      }

      const response = await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(configToSave),
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
      // You might want to show an error message to the user here
    }
  }

  const handleInstallSuccess = async () => {
    setComfyUIStatus('installed')
    // Enable ComfyUI and restore default models
    setComfyUIEnabled(true)
    setConfig(prev => ({
      ...prev,
      comfyui: {
        ...prev.comfyui,
        models: DEFAULT_CONFIG.comfyui.models
      }
    }))

    // Start ComfyUI process since user just installed it
    try {
      const result = await window.electronAPI?.startComfyUIProcess?.()
      if (result?.success) {
        setComfyUIStatus('running')
        console.log('ComfyUI process started after installation')
      } else {
        console.error('Failed to start ComfyUI process after installation:', result?.message)
      }
    } catch (error) {
      console.error('Error starting ComfyUI process after installation:', error)
    }
  }

  const handleComfyUIToggle = async (enabled: boolean) => {
    setComfyUIEnabled(enabled)

    if (enabled) {
      // Restore default models when enabling
      setConfig(prev => ({
        ...prev,
        comfyui: {
          ...prev.comfyui,
          models: DEFAULT_CONFIG.comfyui.models
        }
      }))

      // Check if ComfyUI is installed first
      let isInstalled = false
      try {
        isInstalled = await window.electronAPI?.checkComfyUIInstalled()
        console.log('🦄 ComfyUI installation check result:', isInstalled)
      } catch (error) {
        console.error('Error checking ComfyUI installation:', error)
      }

      if (isInstalled) {
        // Update status to installed if not already set
        if (comfyUIStatus !== 'installed' && comfyUIStatus !== 'running') {
          setComfyUIStatus('installed')
        }

        // Try to start ComfyUI process
        try {
          console.log('🦄 Attempting to start ComfyUI process...')
          const result = await window.electronAPI?.startComfyUIProcess()
          console.log('🦄 Start result:', result)

          if (result?.success) {
            setComfyUIStatus('running')
            console.log('ComfyUI process started successfully:', result.message)
          } else {
            console.error('Failed to start ComfyUI process:', result?.message)
            setComfyUIStatus('installed') // Keep as installed but not running
          }
        } catch (error) {
          console.error('Error starting ComfyUI process:', error)
          setComfyUIStatus('installed') // Keep as installed but not running
        }
      } else {
        // ComfyUI is not installed
        setComfyUIStatus('not-installed')
        console.log('ComfyUI is not installed, please install it first')
      }
    } else {
      // Clear models when disabling
      setConfig(prev => ({
        ...prev,
        comfyui: {
          ...prev.comfyui,
          models: {}
        }
      }))

      // Check actual process status before attempting to stop
      try {
        const processStatus = await window.electronAPI?.getComfyUIProcessStatus()
        console.log('🦄 Current process status:', processStatus)

        if (processStatus?.running) {
          // Only try to stop if process is actually running
          console.log('🦄 Stopping ComfyUI process...')
          const result = await window.electronAPI?.stopComfyUIProcess()
          console.log('🦄 Stop result:', result)

          if (result?.success) {
            console.log('ComfyUI process stopped successfully')
          } else {
            console.error('Failed to stop ComfyUI process:', result?.message)
          }
        } else {
          console.log('🦄 ComfyUI process is not running, no need to stop')
        }

        // Update status based on installation after stopping
        const installed = await window.electronAPI?.checkComfyUIInstalled()
        setComfyUIStatus(installed ? 'installed' : 'not-installed')

      } catch (error) {
        console.error('Error checking/stopping ComfyUI process:', error)
        // Fallback: just check installation status
        try {
          const installed = await window.electronAPI?.checkComfyUIInstalled()
          setComfyUIStatus(installed ? 'installed' : 'not-installed')
        } catch (fallbackError) {
          console.error('Fallback installation check failed:', fallbackError)
          setComfyUIStatus('unknown')
        }
      }
    }
  }

  const getComfyUIStatusIcon = () => {
    if (!comfyUIEnabled) return null

    switch (comfyUIStatus) {
      case 'running':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'installed':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />
      case 'not-installed':
        return <AlertCircle className="w-5 h-5 text-red-500" />
      default:
        return <AlertCircle className="w-5 h-5 text-gray-500" />
    }
  }

  const getComfyUIStatusText = () => {
    if (!comfyUIEnabled) return 'Disabled'

    switch (comfyUIStatus) {
      case 'running':
        return 'Running'
      case 'installed':
        return 'Installed (Not Running)'
      case 'not-installed':
        return 'Not Installed'
      default:
        return 'Checking...'
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
          {Object.keys(config).map((key, index) => (
            <>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <img
                    src={PROVIDER_NAME_MAPPING[key].icon}
                    alt={PROVIDER_NAME_MAPPING[key].name}
                    className="w-10 h-10 rounded-full"
                  />
                  <p className="font-bold text-2xl w-fit">
                    {PROVIDER_NAME_MAPPING[key].name}
                  </p>
                  {key === 'replicate' && <span>🎨 Image Generation</span>}
                  {key === 'comfyui' && (
                    <div className="flex items-center gap-2">
                      <span>🎨 Local Image Generation</span>
                      {getComfyUIStatusIcon()}
                      <span className="text-sm text-muted-foreground">
                        {getComfyUIStatusText()}
                      </span>
                    </div>
                  )}
                </div>

                {/* ComfyUI Enable/Disable Switch */}
                {key === 'comfyui' && (
                  <div className="flex items-center space-x-2 mb-4">
                    <Switch
                      id="comfyui-enable"
                      checked={comfyUIEnabled}
                      onCheckedChange={handleComfyUIToggle}
                    />
                    <Label htmlFor="comfyui-enable" className="text-sm font-medium">
                      Enable ComfyUI Local Image Generation
                    </Label>
                    {/* Debug button for verification */}
                    <Button
                      onClick={verifyComfyUIStatus}
                      variant="outline"
                      size="sm"
                      className="ml-4"
                    >
                      🔍 Debug Status
                    </Button>
                  </div>
                )}

                {/* ComfyUI special handling - only show when enabled */}
                {key === 'comfyui' && comfyUIEnabled && comfyUIStatus === 'not-installed' && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-yellow-800">ComfyUI Not Installed</h4>
                        <p className="text-sm text-yellow-700 mt-1">
                          Install ComfyUI to enable local image generation with Flux models
                        </p>
                      </div>
                      <Button
                        onClick={() => setShowInstallDialog(true)}
                        variant="outline"
                        size="sm"
                        className="border-yellow-300 text-yellow-700 hover:bg-yellow-100"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Install ComfyUI
                      </Button>
                    </div>
                  </div>
                )}

                {/* URL Input - show for all providers except ComfyUI when disabled */}
                {(key !== 'comfyui' || comfyUIEnabled) && key !== 'comfyui' && (
                  <Input
                    placeholder="Enter your API URL"
                    value={config[key]?.url ?? ''}
                    onChange={(e) => {
                      setConfig({
                        ...config,
                        [key]: {
                          ...config[key],
                          url: e.target.value,
                        },
                      })
                    }}
                    className="w-full"
                  />
                )}

                {/* {key === 'comfyui' && comfyUIEnabled && (
                  <Input
                    placeholder="ComfyUI API URL"
                    value={config[key]?.url ?? 'http://127.0.0.1:8188'}
                    onChange={(e) => {
                      setConfig({
                        ...config,
                        [key]: {
                          ...config[key],
                          url: e.target.value,
                        },
                      })
                    }}
                    className="w-full"
                    disabled={comfyUIStatus === 'not-installed'}
                  />
                )} */}
              </div>

              {/* API Key - show for all providers except ComfyUI */}
              {key !== 'comfyui' && (
                <div className="space-y-2">
                  <Label htmlFor={`${key}-apiKey`}>API Key</Label>
                  <Input
                    id={`${key}-apiKey`}
                    type="password"
                    placeholder="Enter your API key"
                    value={config[key]?.api_key ?? ''}
                    onChange={(e) => {
                      setConfig({
                        ...config,
                        [key]: { ...config[key], api_key: e.target.value },
                      })
                      setIsApiKeyDirty(true)
                    }}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500">
                    Your API key will be stored securely
                  </p>
                </div>
              )}

              {/* Max Tokens - show for text providers */}
              {key !== 'replicate' && key !== 'huggingface' && key !== 'comfyui' && (
                <div className="space-y-2">
                  <Label htmlFor={`${key}-maxTokens`}>Max Tokens</Label>
                  <Input
                    id={`${key}-maxTokens`}
                    type="number"
                    placeholder="Enter your max tokens"
                    value={config[key]?.max_tokens ?? 8192}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        [key]: {
                          ...config[key],
                          max_tokens: parseInt(e.target.value),
                        },
                      })
                    }
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500">
                    The maximum number of tokens in the response
                  </p>
                </div>
              )}

              {index !== Object.keys(config).length - 1 && (
                <div className="my-6 border-t bg-border" />
              )}
            </>
          ))}
          <div className="flex justify-center fixed bottom-4 left-1/2 -translate-x-1/2">
            <Button onClick={handleSave} className="w-[400px]" size={'lg'}>
              <Save className="mr-2 h-4 w-4" /> Save Settings
            </Button>
          </div>

          {successMessage && (
            <div className="text-green-500 text-center mb-4">
              {successMessage}
            </div>
          )}
          {errorMessage && (
            <div className="text-red-500 text-center mb-4">{errorMessage}</div>
          )}
        </CardContent>
      </Card>

      <InstallComfyUIDialog
        open={showInstallDialog}
        onOpenChange={setShowInstallDialog}
        onInstallSuccess={handleInstallSuccess}
      />
    </div>
  )
}
