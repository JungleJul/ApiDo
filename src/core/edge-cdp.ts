import fs from "node:fs";
import path from "node:path";

export interface EdgeCdpLaunchPlanOptions {
  executablePath: string;
  remoteDebuggingPort: number;
  userDataDir: string;
  locale?: string;
  startUrl?: string;
}

export interface EdgeCdpLaunchPlan {
  executablePath: string;
  remoteDebuggingPort: number;
  userDataDir: string;
  args: string[];
}

export interface EdgeCdpVersionPayload {
  webSocketDebuggerUrl?: string;
}

const DEFAULT_EDGE_PATHS = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
];

export const resolveEdgeExecutablePath = (preferredPath?: string | null): string => {
  const candidates = preferredPath ? [preferredPath, ...DEFAULT_EDGE_PATHS] : DEFAULT_EDGE_PATHS;
  const match = candidates.find((candidate) => candidate && fs.existsSync(candidate));
  if (!match) {
    throw new Error("未找到 Microsoft Edge，可通过环境变量 LINUXDO_EDGE_PATH 指定 msedge.exe 路径。 ");
  }

  return match;
};

export const buildEdgeCdpLaunchPlan = ({
  executablePath,
  remoteDebuggingPort,
  userDataDir,
  locale = "zh-CN",
  startUrl = "about:blank"
}: EdgeCdpLaunchPlanOptions): EdgeCdpLaunchPlan => {
  const normalizedUserDataDir = path.normalize(userDataDir);
  return {
    executablePath,
    remoteDebuggingPort,
    userDataDir: normalizedUserDataDir,
    args: [
      `--remote-debugging-port=${remoteDebuggingPort}`,
      `--user-data-dir=${normalizedUserDataDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      `--lang=${locale}`,
      "--window-size=1440,960",
      startUrl
    ]
  };
};

export const resolveEdgeCdpWebSocketUrl = (payload: EdgeCdpVersionPayload): string => {
  if (!payload.webSocketDebuggerUrl) {
    throw new Error("Edge 未返回 webSocketDebuggerUrl，无法建立 CDP 连接。 ");
  }

  return payload.webSocketDebuggerUrl;
};
