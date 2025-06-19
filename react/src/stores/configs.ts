import { DEFAULT_PROVIDERS_CONFIG } from '@/constants'
import { LLMConfig, Model } from '@/types/types'
import { create } from 'zustand'

type ConfigsStore = {
  initCanvas: boolean
  setInitCanvas: (initCanvas: boolean) => void

  textModels: Model[]
  imageModels: Model[]
  setTextModels: (models: Model[]) => void
  setImageModels: (models: Model[]) => void

  textModel?: Model
  imageModel?: Model
  setTextModel: (model?: Model) => void
  setImageModel: (model?: Model) => void

  showInstallDialog: boolean
  setShowInstallDialog: (show: boolean) => void

  showUpdateDialog: boolean
  setShowUpdateDialog: (show: boolean) => void

  showSettingsDialog: boolean
  setShowSettingsDialog: (show: boolean) => void

  showLoginDialog: boolean
  setShowLoginDialog: (show: boolean) => void

  providers: {
    [key: string]: LLMConfig
  }
  setProviders: (providers: { [key: string]: LLMConfig }) => void
}

const useConfigsStore = create<ConfigsStore>((set) => ({
  initCanvas: false,
  setInitCanvas: (initCanvas) => set({ initCanvas }),

  textModels: [],
  imageModels: [],
  setTextModels: (models) => set({ textModels: models }),
  setImageModels: (models) => set({ imageModels: models }),

  textModel: undefined,
  imageModel: undefined,
  setTextModel: (model) => set({ textModel: model }),
  setImageModel: (model) => set({ imageModel: model }),

  showInstallDialog: false,
  setShowInstallDialog: (show) => set({ showInstallDialog: show }),

  showUpdateDialog: false,
  setShowUpdateDialog: (show) => set({ showUpdateDialog: show }),

  showSettingsDialog: false,
  setShowSettingsDialog: (show) => set({ showSettingsDialog: show }),

  showLoginDialog: false,
  setShowLoginDialog: (show) => set({ showLoginDialog: show }),

  providers: DEFAULT_PROVIDERS_CONFIG,
  setProviders: (providers) => set({ providers }),
}))

export default useConfigsStore
