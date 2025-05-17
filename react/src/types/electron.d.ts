interface ElectronAPI {
  pickImage: () => Promise<string[] | null>;
  pickVideo: () => Promise<string | null>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
