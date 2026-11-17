const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("sewaAPI", {
  saveSettings: (settings) =>
    ipcRenderer.invoke("config:save-settings", settings),

  getSettings: () => ipcRenderer.invoke("config:get-settings"),

  startAgent: () => ipcRenderer.invoke("agent:start"),

  stopAgent: () => ipcRenderer.invoke("agent:stop"),
});
