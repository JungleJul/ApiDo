"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const monitor_service_1 = require("../automation/monitor-service");
const debug_config_1 = require("../core/debug-config");
const debug_runtime_1 = require("../core/debug-runtime");
const repository_1 = require("../core/repository");
const settings_store_1 = require("../core/settings-store");
let mainWindow = null;
let tray = null;
let isQuitting = false;
let monitorService;
let stopHandled = false;
let debugRuntime;
const createTrayIcon = () => {
    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <rect width="64" height="64" rx="16" fill="#c8642c"/>
      <path d="M16 22h32v6H16zm0 14h20v6H16z" fill="#fff6ef"/>
      <circle cx="46" cy="39" r="8" fill="#266146"/>
    </svg>
  `;
    return electron_1.nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`);
};
const sendSnapshot = () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
        return;
    }
    mainWindow.webContents.send("monitor:snapshot", monitorService.getSnapshot());
};
const createWindow = async () => {
    mainWindow = new electron_1.BrowserWindow({
        width: 1480,
        height: 920,
        minWidth: 1200,
        minHeight: 720,
        show: false,
        backgroundColor: "#f6f2ea",
        webPreferences: {
            preload: node_path_1.default.join(__dirname, "../preload/index.js"),
            contextIsolation: true,
            nodeIntegration: false
        }
    });
    mainWindow.on("ready-to-show", () => {
        mainWindow?.show();
    });
    mainWindow.on("close", (event) => {
        if (isQuitting) {
            return;
        }
        event.preventDefault();
        mainWindow?.hide();
    });
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        void electron_1.shell.openExternal(url);
        return { action: "deny" };
    });
    await mainWindow.loadFile(node_path_1.default.join(__dirname, "../renderer/index.html"));
    if (debugRuntime.config.enabled && debugRuntime.config.openElectronDevTools) {
        mainWindow.webContents.openDevTools({ mode: "detach" });
    }
};
const createTray = () => {
    tray = new electron_1.Tray(createTrayIcon());
    tray.setToolTip("Linux.do CDK Monitor");
    tray.on("click", () => {
        if (!mainWindow) {
            return;
        }
        if (mainWindow.isVisible()) {
            mainWindow.hide();
        }
        else {
            mainWindow.show();
            mainWindow.focus();
        }
    });
    tray.setContextMenu(electron_1.Menu.buildFromTemplate([
        {
            label: "显示窗口",
            click: () => {
                mainWindow?.show();
                mainWindow?.focus();
            }
        },
        {
            label: "立即重扫",
            click: () => {
                void monitorService.triggerRescan();
            }
        },
        {
            label: "打开登录窗口",
            click: () => {
                void monitorService.openLoginWindow();
            }
        },
        {
            label: "已确认登录",
            click: () => {
                void monitorService.confirmLogin();
            }
        },
        {
            label: "重新初始化浏览器",
            click: () => {
                void monitorService.reinitializeBrowser();
            }
        },
        {
            label: "打开调试目录",
            click: () => {
                void electron_1.shell.openPath(debugRuntime.artifactsDirectory);
            }
        },
        { type: "separator" },
        {
            label: "退出",
            click: () => {
                isQuitting = true;
                electron_1.app.quit();
            }
        }
    ]));
};
const bindIpc = () => {
    electron_1.ipcMain.handle("monitor:getSnapshot", () => monitorService.getSnapshot());
    electron_1.ipcMain.handle("monitor:triggerRescan", async () => {
        await monitorService.triggerRescan();
    });
    electron_1.ipcMain.handle("monitor:retryClaim", async (_event, topicId) => {
        await monitorService.retryClaim(topicId);
    });
    electron_1.ipcMain.handle("monitor:openLoginWindow", async () => {
        await monitorService.openLoginWindow();
    });
    electron_1.ipcMain.handle("monitor:confirmLogin", async () => {
        await monitorService.confirmLogin();
    });
    electron_1.ipcMain.handle("monitor:reinitializeBrowser", async () => {
        await monitorService.reinitializeBrowser();
    });
    electron_1.ipcMain.handle("monitor:openTopic", async (_event, topicId) => {
        const url = monitorService.getTopicUrl(topicId);
        if (url) {
            await electron_1.shell.openExternal(url);
        }
    });
    electron_1.ipcMain.handle("monitor:openCdk", async (_event, topicId) => {
        const url = monitorService.getCdkUrl(topicId);
        if (url) {
            await electron_1.shell.openExternal(url);
            await monitorService.noteCdkOpenedExternally(topicId);
        }
    });
    electron_1.ipcMain.handle("monitor:openExternal", async (_event, url) => {
        await electron_1.shell.openExternal(url);
    });
    electron_1.ipcMain.handle("monitor:openDebugDirectory", async () => {
        await electron_1.shell.openPath(debugRuntime.artifactsDirectory);
    });
    electron_1.ipcMain.handle("monitor:openDebugLog", async () => {
        await electron_1.shell.openPath(debugRuntime.logFilePath);
    });
    electron_1.ipcMain.handle("monitor:updateSettings", async (_event, config) => monitorService.updateSettings(config));
};
void electron_1.app.whenReady().then(async () => {
    const baseDir = node_path_1.default.join(electron_1.app.getPath("userData"), "linuxdo-cdk-monitor");
    node_fs_1.default.mkdirSync(baseDir, { recursive: true });
    debugRuntime = new debug_runtime_1.DebugRuntime((0, debug_config_1.getDebugConfig)(process.env), baseDir);
    debugRuntime.info("app", "Electron app starting", {
        baseDir,
        debug: debugRuntime.getState()
    });
    const repository = new repository_1.SqliteRepository(node_path_1.default.join(baseDir, "monitor.db"));
    const settingsStore = new settings_store_1.SettingsStore(node_path_1.default.join(baseDir, "settings.json"));
    monitorService = new monitor_service_1.MonitorService({
        repository,
        settingsStore,
        userDataDir: baseDir,
        debugRuntime,
        notify: (title, body) => {
            if (!monitorService.getSnapshot().config.notificationsEnabled) {
                return;
            }
            if (electron_1.Notification.isSupported()) {
                new electron_1.Notification({ title, body }).show();
            }
        }
    });
    monitorService.on("snapshot", sendSnapshot);
    await createWindow();
    createTray();
    bindIpc();
    await monitorService.start();
    sendSnapshot();
    electron_1.app.on("activate", () => {
        if (!mainWindow) {
            return;
        }
        mainWindow.show();
        mainWindow.focus();
    });
});
electron_1.app.on("before-quit", () => {
    isQuitting = true;
});
electron_1.app.on("will-quit", (event) => {
    if (stopHandled) {
        return;
    }
    event.preventDefault();
    stopHandled = true;
    void monitorService.stop().finally(() => {
        electron_1.app.exit(0);
    });
});
//# sourceMappingURL=index.js.map