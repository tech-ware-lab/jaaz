interface ElectronAPI {
  publishPost: (data: {
    channel: string
    title: string
    content: string
    images: string[]
    video: string
  }) => Promise<{ success?: boolean; error?: string }>
  pickImage: () => Promise<string[] | null>
  pickVideo: () => Promise<string | null>
  installComfyUI: () => Promise<{ success: boolean; error?: string }>
  cancelComfyUIInstall: () => Promise<{
    success?: boolean
    error?: string
    message?: string
  }>
  checkComfyUIInstalled: () => Promise<boolean>
  // ComfyUI process management methods
  startComfyUIProcess: () => Promise<{ success: boolean; message?: string }>
  stopComfyUIProcess: () => Promise<{ success: boolean; message?: string }>
  getComfyUIProcessStatus: () => Promise<{ running: boolean; pid?: number }>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
