"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveEdgeCdpWebSocketUrl = exports.buildEdgeCdpLaunchPlan = exports.resolveEdgeExecutablePath = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const DEFAULT_EDGE_PATHS = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
];
const resolveEdgeExecutablePath = (preferredPath) => {
    const candidates = preferredPath ? [preferredPath, ...DEFAULT_EDGE_PATHS] : DEFAULT_EDGE_PATHS;
    const match = candidates.find((candidate) => candidate && node_fs_1.default.existsSync(candidate));
    if (!match) {
        throw new Error("未找到 Microsoft Edge，可通过环境变量 LINUXDO_EDGE_PATH 指定 msedge.exe 路径。 ");
    }
    return match;
};
exports.resolveEdgeExecutablePath = resolveEdgeExecutablePath;
const buildEdgeCdpLaunchPlan = ({ executablePath, remoteDebuggingPort, userDataDir, locale = "zh-CN", startUrl = "about:blank" }) => {
    const normalizedUserDataDir = node_path_1.default.normalize(userDataDir);
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
exports.buildEdgeCdpLaunchPlan = buildEdgeCdpLaunchPlan;
const resolveEdgeCdpWebSocketUrl = (payload) => {
    if (!payload.webSocketDebuggerUrl) {
        throw new Error("Edge 未返回 webSocketDebuggerUrl，无法建立 CDP 连接。 ");
    }
    return payload.webSocketDebuggerUrl;
};
exports.resolveEdgeCdpWebSocketUrl = resolveEdgeCdpWebSocketUrl;
//# sourceMappingURL=edge-cdp.js.map