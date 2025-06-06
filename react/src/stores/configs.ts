import { Model } from '@/types/types'
import { create } from 'zustand'

type ConfigsStore = {
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
}

const useConfigsStore = create<ConfigsStore>((set) => ({
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
}))

export default useConfigsStore
