interface ElectronAPI {
  pickImage: () => Promise<string[] | null>;
  pickVideo: () => Promise<string | null>;
  publishPost: (args: {
    channel: "youtube" | "bilibili" | "douyin" | "xiaohongshu";
    title: string;
    content: string;
    images: string[];
    video: string;
  }) => Promise<any>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
