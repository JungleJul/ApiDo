import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("monitorApi", {
  getSnapshot: () => ipcRenderer.invoke("monitor:getSnapshot"),
  onSnapshot: (listener: (snapshot: unknown) => void) => {
    const subscription = (_event: Electron.IpcRendererEvent, snapshot: unknown) => listener(snapshot);
    ipcRenderer.on("monitor:snapshot", subscription);
    return () => ipcRenderer.removeListener("monitor:snapshot", subscription);
  },
  openTopic: (topicId: number) => ipcRenderer.invoke("monitor:openTopic", topicId),
  openCdk: (topicId: number) => ipcRenderer.invoke("monitor:openCdk", topicId),
  openExternal: (url: string) => ipcRenderer.invoke("monitor:openExternal", url),
  openDebugDirectory: () => ipcRenderer.invoke("monitor:openDebugDirectory"),
  openDebugLog: () => ipcRenderer.invoke("monitor:openDebugLog"),
  triggerRescan: () => ipcRenderer.invoke("monitor:triggerRescan"),
  retryClaim: (topicId: number) => ipcRenderer.invoke("monitor:retryClaim", topicId),
  openLoginWindow: () => ipcRenderer.invoke("monitor:openLoginWindow"),
  confirmLogin: () => ipcRenderer.invoke("monitor:confirmLogin"),
  reinitializeBrowser: () => ipcRenderer.invoke("monitor:reinitializeBrowser"),
  updateSettings: (config: Record<string, unknown>) => ipcRenderer.invoke("monitor:updateSettings", config)
});
