"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDebugConfig = void 0;
const isTruthy = (value) => {
    if (!value) {
        return false;
    }
    return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
};
const getDebugConfig = (env) => {
    const enabled = isTruthy(env.LINUXDO_DEBUG);
    const browserControlMode = env.LINUXDO_BROWSER_MODE === "playwright" ? "playwright" : "edge-cdp";
    const browserChannel = env.LINUXDO_BROWSER_CHANNEL === "chromium" ? "chromium" : "msedge";
    const edgeExecutablePath = env.LINUXDO_EDGE_PATH?.trim() ? env.LINUXDO_EDGE_PATH.trim() : null;
    return {
        enabled,
        browserControlMode,
        headless: env.LINUXDO_HEADFUL ? !isTruthy(env.LINUXDO_HEADFUL) : false,
        browserChannel,
        edgeExecutablePath,
        openElectronDevTools: isTruthy(env.LINUXDO_OPEN_DEVTOOLS),
        persistHtmlSnapshots: isTruthy(env.LINUXDO_SAVE_HTML),
        verboseLogging: isTruthy(env.LINUXDO_VERBOSE_LOGS)
    };
};
exports.getDebugConfig = getDebugConfig;
//# sourceMappingURL=debug-config.js.map