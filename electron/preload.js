const { contextBridge, ipcRenderer } = require("electron");

// const ipcHandlers = require("./ipcHandlers");

// console.log("Available IPC handlers:", Object.keys(ipcHandlers));

// // Dynamically build API based on handler function names
// const exposedAPI = {};
// for (const name of Object.keys(ipcHandlers)) {
//   exposedAPI[name] = (...args) => {
//     console.log(`Calling IPC handler: ${name} with args:`, args);
//     return ipcRenderer.invoke(name, ...args);
//   };
// }

// console.log("Exposing API with methods:", Object.keys(exposedAPI));

contextBridge.exposeInMainWorld("electronAPI", {
  publishRednote: (...args) => {
    console.log("🦄publishRednote called with args:", args);
    return ipcRenderer.invoke("publishRednote", ...args);
  },
  // Add new file picker methods
  pickImage: () => ipcRenderer.invoke("pick-image"),
  pickVideo: () => ipcRenderer.invoke("pick-video"),
});
