const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // ... existing exposed APIs ...

  // Add new file picker methods
  pickImage: () => ipcRenderer.invoke("pick-image"),
  pickVideo: () => ipcRenderer.invoke("pick-video"),
});
