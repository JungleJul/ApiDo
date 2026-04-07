"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld("monitorApi", {
    getSnapshot: () => electron_1.ipcRenderer.invoke("monitor:getSnapshot"),
    onSnapshot: (listener) => {
        const subscription = (_event, snapshot) => listener(snapshot);
        electron_1.ipcRenderer.on("monitor:snapshot", subscription);
        return () => electron_1.ipcRenderer.removeListener("monitor:snapshot", subscription);
    },
    openTopic: (topicId) => electron_1.ipcRenderer.invoke("monitor:openTopic", topicId),
    openCdk: (topicId) => electron_1.ipcRenderer.invoke("monitor:openCdk", topicId),
    openExternal: (url) => electron_1.ipcRenderer.invoke("monitor:openExternal", url),
    openDebugDirectory: () => electron_1.ipcRenderer.invoke("monitor:openDebugDirectory"),
    openDebugLog: () => electron_1.ipcRenderer.invoke("monitor:openDebugLog"),
    triggerRescan: () => electron_1.ipcRenderer.invoke("monitor:triggerRescan"),
    retryClaim: (topicId) => electron_1.ipcRenderer.invoke("monitor:retryClaim", topicId),
    openLoginWindow: () => electron_1.ipcRenderer.invoke("monitor:openLoginWindow"),
    confirmLogin: () => electron_1.ipcRenderer.invoke("monitor:confirmLogin"),
    reinitializeBrowser: () => electron_1.ipcRenderer.invoke("monitor:reinitializeBrowser"),
    updateSettings: (config) => electron_1.ipcRenderer.invoke("monitor:updateSettings", config)
});
//# sourceMappingURL=index.js.map