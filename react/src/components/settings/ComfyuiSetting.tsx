import InstallComfyUIDialog from '@/components/comfyui/InstallComfyUIDialog'
import UninstallProgressDialog from '@/components/comfyui/UninstallProgressDialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DEFAULT_PROVIDERS_CONFIG, PROVIDER_NAME_MAPPING } from '@/constants'
import { LLMConfig } from '@/types/types'
import {
  AlertCircle,
  CheckCircle,
  Download,
  PaletteIcon,
  Play,
  Plus,
  PlusIcon,
  SquareSquareIcon,
  Trash2,
  UploadIcon,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useConfigs } from '@/contexts/configs'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
  DialogTrigger,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

interface ComfyuiSettingProps {
  config: LLMConfig
  onConfigChange: (key: string, newConfig: LLMConfig) => void
}

export default function ComfyuiSetting({
  config,
  onConfigChange,
}: ComfyuiSettingProps) {
  const { t } = useTranslation()
  const { setShowInstallDialog } = useConfigs()
  const [comfyUIStatus, setComfyUIStatus] = useState<
    'unknown' | 'running' | 'not-running'
  >('unknown')
  const [isComfyUIInstalled, setIsComfyUIInstalled] = useState<boolean>(false)
  const [showUninstallDialog, setShowUninstallDialog] = useState<boolean>(false)
  const provider = PROVIDER_NAME_MAPPING.comfyui
  const comfyUrl = config.url || ''
  const [comfyuiModels, setComfyuiModels] = useState<string[]>([])
  const [workflows, setWorkflows] = useState<string[]>([])

  // Validate URL format
  const isValidUrl = (url: string): boolean => {
    try {
      const urlObj = new URL(url)
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
    } catch {
      return false
    }
  }

  // Check if ComfyUI is installed
  useEffect(() => {
    const checkInstallation = async () => {
      try {
        const installed = await window.electronAPI?.checkComfyUIInstalled()
        console.log('ComfyUI installation status:', installed)
        setIsComfyUIInstalled(!!installed)
      } catch (error) {
        console.error('Error checking ComfyUI installation:', error)
        setIsComfyUIInstalled(false)
      }
    }

    checkInstallation()
  }, [])

  // Fetch ComfyUI models when URL is available
  useEffect(() => {
    if (!comfyUrl || !isValidUrl(comfyUrl)) {
      console.log('Invalid ComfyUI URL format for models fetch:', comfyUrl)
      setComfyuiModels([])
      return
    }

    fetch(`/api/comfyui/object_info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: comfyUrl }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0]) {
          const modelList =
            data?.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0]
          console.log('ComfyUI models:', modelList)
          setComfyuiModels(modelList)

          // if models are fetched, then ComfyUI is installed and running
          //TODO: Needs to delete this line, because user may self installed ComfyUI, but we cannot show Start ComfyUI button if user self installed ComfyUI
          setIsComfyUIInstalled(true)
        }
      })
      .catch((error) => {
        console.error('Failed to fetch ComfyUI models:', error)
        setComfyuiModels([])
      })
  }, [comfyUrl])

  // Check ComfyUI status when URL is provided
  const checkComfyUIStatus = useCallback(async () => {
    if (!comfyUrl) {
      setComfyUIStatus('unknown')
      return
    }

    // Validate URL format first
    if (!isValidUrl(comfyUrl)) {
      console.log('Invalid ComfyUI URL format:', comfyUrl)
      setComfyUIStatus('not-running')
      return
    }

    try {
      console.log('Checking ComfyUI status at:', comfyUrl)
      const response = await fetch(`${comfyUrl}/system_stats`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      })

      if (response.ok) {
        console.log('ComfyUI is running')
        setComfyUIStatus('running')
      } else {
        console.log('ComfyUI is not responding')
        setComfyUIStatus('not-running')
      }
    } catch (error) {
      console.log(
        'ComfyUI connection failed:',
        error instanceof Error ? error.message : String(error)
      )
      setComfyUIStatus('not-running')
    }
  }, [comfyUrl])

  // Check status when URL changes
  useEffect(() => {
    checkComfyUIStatus()
  }, [comfyUrl, checkComfyUIStatus])

  const handleUrlChange = (url: string) => {
    onConfigChange('comfyui', {
      ...config,
      url: url,
    })
  }

  const handleInstallClick = () => {
    setShowInstallDialog(true)
  }

  // start ComfyUI
  const startComfyUI = async () => {
    try {
      console.log('Starting ComfyUI...')
      const result = await window.electronAPI?.startComfyUIProcess()

      if (result?.success) {
        console.log('ComfyUI started successfully:', result.message)
        // Recheck status after starting
        setTimeout(() => {
          checkComfyUIStatus()
        }, 3000)
      } else {
        console.error('Failed to start ComfyUI:', result?.message)
      }
    } catch (error) {
      console.error('Error starting ComfyUI:', error)
    }
  }

  const handleStartClick = async () => {
    await startComfyUI()
  }

  // Uninstall ComfyUI
  const handleUninstallClick = async () => {
    // Show uninstall dialog (confirmation will be handled in the dialog)
    setShowUninstallDialog(true)
  }

  // Handle actual uninstall after confirmation
  const handleConfirmUninstall = async () => {
    // Stop ComfyUI process first if it's running
    if (comfyUIStatus === 'running') {
      console.log('Stopping ComfyUI process before uninstallation...')
      try {
        const stopResult = await window.electronAPI?.stopComfyUIProcess()
        if (stopResult?.success) {
          console.log('ComfyUI process stopped successfully')
          // Wait for process to fully terminate
          await new Promise((resolve) => setTimeout(resolve, 2000))
        }
      } catch (stopError) {
        console.log('Error stopping ComfyUI process:', stopError)
      }
    }

    try {
      await window.electronAPI?.uninstallComfyUI()
    } catch (error) {
      console.error('Error starting uninstallation:', error)
    }
  }

  // Handle uninstall completion
  const handleUninstallComplete = () => {
    console.log('ComfyUI uninstalled successfully')
    setIsComfyUIInstalled(false)
    setComfyUIStatus('unknown')
    setComfyuiModels([])

    // Clear ComfyUI configuration
    onConfigChange('comfyui', {
      ...config,
      url: '',
      models: {},
    })
  }

  // ComfyUI installed successfully
  const handleInstallSuccess = async () => {
    setIsComfyUIInstalled(true)

    // Set default URL if not already set
    if (!comfyUrl) {
      onConfigChange('comfyui', {
        ...config,
        models: DEFAULT_PROVIDERS_CONFIG.comfyui.models,
        url: 'http://127.0.0.1:8188',
      })
    }

    // Start ComfyUI after installation
    await startComfyUI()
  }

  const getComfyUIStatusIcon = () => {
    if (!isComfyUIInstalled) return null

    if (!comfyUrl) {
      return <AlertCircle className="w-5 h-5 text-yellow-500" />
    }

    switch (comfyUIStatus) {
      case 'running':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'not-running':
        return <AlertCircle className="w-5 h-5 text-red-500" />
      default:
        return <AlertCircle className="w-5 h-5 text-gray-500" />
    }
  }

  const getComfyUIStatusText = () => {
    if (!isComfyUIInstalled) return ''

    if (!comfyUrl) {
      return t('settings:comfyui.status.installed')
    }

    switch (comfyUIStatus) {
      case 'running':
        return t('settings:comfyui.status.running')
      case 'not-running':
        return t('settings:comfyui.status.notRunning')
      default:
        return t('settings:comfyui.status.checking')
    }
  }

  return (
    <div className="space-y-4">
      {/* Provider Header */}
      <div className="flex items-center gap-2">
        <img
          src={provider.icon}
          alt={provider.name}
          className="w-10 h-10 rounded-full"
        />
        <p className="font-bold text-2xl w-fit">{provider.name}</p>
        <span>{t('settings:comfyui.localImageGeneration')}</span>

        {/* Status or Start/Uninstall Button */}
        <div className="ml-auto">
          {isComfyUIInstalled ? (
            // Show status, start and uninstall buttons if ComfyUI is installed
            <div className="flex items-center gap-2">
              {getComfyUIStatusIcon()}
              <span className="text-sm text-muted-foreground">
                {getComfyUIStatusText()}
              </span>
              {(comfyUIStatus === 'not-running' ||
                (!comfyUrl && isComfyUIInstalled)) && (
                <Button
                  onClick={handleStartClick}
                  variant="outline"
                  size="sm"
                  className="border-green-300 text-green-700 hover:bg-green-50"
                >
                  <Play className="w-4 h-4 mr-2" />
                  {t('settings:comfyui.startButton')}
                </Button>
              )}
              <Button
                onClick={handleUninstallClick}
                variant="outline"
                size="sm"
                className="border-red-300 text-red-700 hover:bg-red-50"
                disabled={showUninstallDialog}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {t('settings:comfyui.uninstallButton')}
              </Button>
            </div>
          ) : (
            // Show install button if ComfyUI is not installed
            <></>
            // <Button
            //   onClick={handleInstallClick}
            //   variant="outline"
            //   size="sm"
            //   className="border-blue-300 text-blue-700 hover:bg-blue-50"
            // >
            //   <Download className="w-4 h-4 mr-2" />
            //   {t('settings:comfyui.installButton')}
            // </Button>
          )}
        </div>
      </div>

      {/* API URL Input */}
      <div className="space-y-2">
        <Label htmlFor="comfyui-url">{t('settings:provider.apiUrl')}</Label>
        <Input
          id="comfyui-url"
          placeholder="http://127.0.0.1:8188"
          value={comfyUrl}
          onChange={(e) => handleUrlChange(e.target.value)}
          className={`w-full ${
            comfyUrl && !isValidUrl(comfyUrl)
              ? 'border-red-300 focus:border-red-500'
              : ''
          }`}
        />
        <p className="text-xs text-gray-500">
          {t('settings:comfyui.urlDescription')}
        </p>
        {comfyUrl && !isValidUrl(comfyUrl) && (
          <p className="text-xs text-red-500 mt-1">
            {t('settings:comfyui.invalidUrl')}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <PaletteIcon className="w-5 h-5" />
        <p className="text-sm font-bold">{t('settings:comfyui.workflows')}</p>
        <AddWorkflowDialog />
      </div>

      {/* ComfyUI Models */}
      {comfyuiModels.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <SquareSquareIcon className="w-4 h-4" />
            <p className="text-sm font-bold">{t('settings:models.title')}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {comfyuiModels.map((model) => (
              <div key={model} className="flex items-center gap-2">
                <Checkbox
                  id={model}
                  checked={!!config.models?.[model]}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onConfigChange('comfyui', {
                        ...config,
                        models: {
                          ...config.models,
                          [model]: {
                            type: 'image',
                          },
                        },
                      })
                    } else {
                      const newModels = { ...config.models }
                      delete newModels[model]
                      onConfigChange('comfyui', {
                        ...config,
                        models: newModels,
                      })
                    }
                  }}
                />
                <Label htmlFor={model}>{model}</Label>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Install Dialog */}
      <InstallComfyUIDialog onInstallSuccess={handleInstallSuccess} />

      {/* Uninstall Dialog */}
      <UninstallProgressDialog
        open={showUninstallDialog}
        onOpenChange={setShowUninstallDialog}
        onUninstallComplete={handleUninstallComplete}
        onConfirmUninstall={handleConfirmUninstall}
      />
    </div>
  )
}
type ComfyUIAPINode = {
  class_type: string
  inputs: Record<string, any>
}
function AddWorkflowDialog() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [workflowName, setWorkflowName] = useState('')
  const [workflowJson, setWorkflowJson] = useState<Record<
    string,
    ComfyUIAPINode
  > | null>(null)
  const [inputs, setInputs] = useState<
    {
      name: string
      type: 'string' | 'number' | 'boolean'
      description: string
      node_id: string
      node_input_name: string
      default_value: string | number | boolean
    }[]
  >([])
  const [outputs, setOutputs] = useState<
    {
      name: string
      type: 'string' | 'number' | 'boolean'
      description: string
    }[]
  >([])
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputs([])
    const file = e.target.files?.[0]
    if (file) {
      try {
        const fileContent = await file.text()
        // Parse the JSON content
        const jsonContent = JSON.parse(fileContent)
        console.log('Parsed workflow JSON:', jsonContent)
        setWorkflowJson(jsonContent)
        setWorkflowName(file.name.replace('.json', ''))
        for (const key in jsonContent) {
          const node: ComfyUIAPINode = jsonContent[key]
          if (!node.class_type) {
            throw new Error('No class_type found in workflow JSON')
          }
          const classType = node.class_type
          // if (classType === 'SaveImage') {
          //   setOutputs(node.inputs.required.model_name.map((model: string) => ({
          //     name: model,
          //     type: 'string',
          //     description: '',
          //   })))
          // }
        }
      } catch (error) {
        console.error(error)
        toast.error(
          'Invalid workflow JSON, make sure you exprted API JSON in ComfyUI! ' +
            error
        )
      }

      // const formData = new FormData()
      // formData.append('file', file)
      // formData.append('workflow_name', workflowName)

      // await fetch('/api/settings/comfyui/upload_workflow', {
      //   method: 'POST',
      //   body: formData,
      // })
    }
  }
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <PlusIcon className="w-4 h-4" />
          Add Workflow
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl h-[80vh] overflow-y-auto flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Workflow</DialogTitle>
        </DialogHeader>
        <Input
          type="text"
          style={{ flexShrink: 0 }}
          placeholder="Workflow Name"
          value={workflowName}
          onChange={(e) => setWorkflowName(e.target.value)}
        />
        <Button onClick={() => inputRef.current?.click()}>
          <UploadIcon className="w-4 h-4 mr-2" />
          Upload Workflow API JSON
        </Button>
        <input
          type="file"
          accept=".json"
          ref={inputRef}
          onChange={handleFileChange}
          className="hidden"
        />
        {workflowJson && (
          <div className="flex flex-col bg-accent p-2 rounded-md">
            <p className="font-bold">Inputs</p>
            {inputs.length > 0 ? (
              inputs.map((input) => (
                <div key={input.name}>
                  <p>{input.name}</p>
                  <p>{input.description}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center">
                Please add your workflow inputs from below. Choose at lease one
                input.
              </p>
            )}
            {/* <p className="font-bold">Outputs</p>
            {outputs.map((input) => (
              <div key={input.name}>
                <p>{input.name}</p>
                <p>{input.description}</p>
              </div>
            ))} */}
          </div>
        )}
        {workflowJson &&
          Object.keys(workflowJson).map((nodeID) => {
            const node = workflowJson[nodeID]
            return (
              <div key={nodeID}>
                <p className="font-bold">
                  {node.class_type} #{nodeID}
                </p>
                <div className="ml-4 flex flex-col gap-1">
                  {Object.keys(node.inputs).map((inputKey) => {
                    const inputValue = node.inputs[inputKey]
                    if (
                      typeof inputValue !== 'boolean' &&
                      typeof inputValue !== 'number' &&
                      typeof inputValue !== 'string'
                    ) {
                      return null
                    }
                    return (
                      <div key={inputKey} className="flex items-center gap-2">
                        <p className="bg-accent text-sm px-2 py-0.5 rounded-md">
                          {inputKey}
                        </p>
                        <Input
                          type="text"
                          value={inputValue.toString()}
                          disabled
                        />
                        <Button
                          variant="outline"
                          size="default"
                          onClick={() => {
                            setInputs([
                              ...inputs,
                              {
                                name: inputKey,
                                type: 'string',
                                description: '',
                                node_id: nodeID,
                                node_input_name: inputKey,
                                default_value: inputValue,
                              },
                            ])
                          }}
                        >
                          <PlusIcon className="w-4 h-4" />
                          Add Input
                        </Button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
      </DialogContent>
    </Dialog>
  )
}
