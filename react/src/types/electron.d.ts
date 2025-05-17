interface ElectronAPI {
  pickImage: () => Promise<string[] | null>;
  pickVideo: () => Promise<string | null>;
  publishRednote: () => Promise<any>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
