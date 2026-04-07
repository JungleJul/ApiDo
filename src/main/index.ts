import { app, BrowserWindow, ipcMain, Menu, Notification, Tray, nativeImage, shell } from "electron";
import fs from "node:fs";
import path from "node:path";

import { MonitorService } from "../automation/monitor-service";
import { getDebugConfig } from "../core/debug-config";
import { DebugRuntime } from "../core/debug-runtime";
import { SqliteRepository } from "../core/repository";
import { SettingsStore } from "../core/settings-store";
import type { AppConfig } from "../shared/types";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let monitorService: MonitorService;
let stopHandled = false;
let debugRuntime: DebugRuntime;

const createTrayIcon = () => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <rect width="64" height="64" rx="16" fill="#c8642c"/>
      <path d="M16 22h32v6H16zm0 14h20v6H16z" fill="#fff6ef"/>
      <circle cx="46" cy="39" r="8" fill="#266146"/>
    </svg>
  `;

  return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`);
};

const sendSnapshot = () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send("monitor:snapshot", monitorService.getSnapshot());
};

const createWindow = async (): Promise<void> => {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1200,
    minHeight: 720,
    show: false,
    backgroundColor: "#f6f2ea",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
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
    void shell.openExternal(url);
    return { action: "deny" };
  });

  await mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));

  if (debugRuntime.config.enabled && debugRuntime.config.openElectronDevTools) {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }
};

const createTray = (): void => {
  tray = new Tray(createTrayIcon());
  tray.setToolTip("Linux.do CDK Monitor");
  tray.on("click", () => {
    if (!mainWindow) {
      return;
    }

    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  tray.setContextMenu(
    Menu.buildFromTemplate([
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
          void shell.openPath(debugRuntime.artifactsDirectory);
        }
      },
      { type: "separator" },
      {
        label: "退出",
        click: () => {
          isQuitting = true;
          app.quit();
        }
      }
    ])
  );
};

const bindIpc = (): void => {
  ipcMain.handle("monitor:getSnapshot", () => monitorService.getSnapshot());
  ipcMain.handle("monitor:triggerRescan", async () => {
    await monitorService.triggerRescan();
  });
  ipcMain.handle("monitor:retryClaim", async (_event, topicId: number) => {
    await monitorService.retryClaim(topicId);
  });
  ipcMain.handle("monitor:openLoginWindow", async () => {
    await monitorService.openLoginWindow();
  });
  ipcMain.handle("monitor:confirmLogin", async () => {
    await monitorService.confirmLogin();
  });
  ipcMain.handle("monitor:reinitializeBrowser", async () => {
    await monitorService.reinitializeBrowser();
  });
  ipcMain.handle("monitor:openTopic", async (_event, topicId: number) => {
    const url = monitorService.getTopicUrl(topicId);
    if (url) {
      await shell.openExternal(url);
    }
  });
  ipcMain.handle("monitor:openCdk", async (_event, topicId: number) => {
    const url = monitorService.getCdkUrl(topicId);
    if (url) {
      await shell.openExternal(url);
      await monitorService.noteCdkOpenedExternally(topicId);
    }
  });
  ipcMain.handle("monitor:openExternal", async (_event, url: string) => {
    await shell.openExternal(url);
  });
  ipcMain.handle("monitor:openDebugDirectory", async () => {
    await shell.openPath(debugRuntime.artifactsDirectory);
  });
  ipcMain.handle("monitor:openDebugLog", async () => {
    await shell.openPath(debugRuntime.logFilePath);
  });
  ipcMain.handle("monitor:updateSettings", async (_event, config: Partial<AppConfig>) => monitorService.updateSettings(config));
};

void app.whenReady().then(async () => {
  const baseDir = path.join(app.getPath("userData"), "linuxdo-cdk-monitor");
  fs.mkdirSync(baseDir, { recursive: true });

  debugRuntime = new DebugRuntime(getDebugConfig(process.env), baseDir);
  debugRuntime.info("app", "Electron app starting", {
    baseDir,
    debug: debugRuntime.getState()
  });

  const repository = new SqliteRepository(path.join(baseDir, "monitor.db"));
  const settingsStore = new SettingsStore(path.join(baseDir, "settings.json"));

  monitorService = new MonitorService({
    repository,
    settingsStore,
    userDataDir: baseDir,
    debugRuntime,
    notify: (title, body) => {
      if (!monitorService.getSnapshot().config.notificationsEnabled) {
        return;
      }

      if (Notification.isSupported()) {
        new Notification({ title, body }).show();
      }
    }
  });

  monitorService.on("snapshot", sendSnapshot);

  await createWindow();
  createTray();
  bindIpc();
  await monitorService.start();
  sendSnapshot();

  app.on("activate", () => {
    if (!mainWindow) {
      return;
    }

    mainWindow.show();
    mainWindow.focus();
  });
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("will-quit", (event) => {
  if (stopHandled) {
    return;
  }

  event.preventDefault();
  stopHandled = true;
  void monitorService.stop().finally(() => {
    app.exit(0);
  });
});


