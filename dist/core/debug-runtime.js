"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DebugRuntime = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const debug_artifacts_1 = require("./debug-artifacts");
class DebugRuntime {
    config;
    artifactsDirectory;
    logFilePath;
    constructor(config, baseDir) {
        this.config = config;
        this.artifactsDirectory = node_path_1.default.join(baseDir, "debug-artifacts");
        this.logFilePath = node_path_1.default.join(this.artifactsDirectory, "monitor.log");
        if (config.enabled) {
            node_fs_1.default.mkdirSync(this.artifactsDirectory, { recursive: true });
        }
    }
    getState() {
        return {
            ...this.config,
            artifactsDirectory: this.artifactsDirectory,
            logFilePath: this.logFilePath
        };
    }
    info(scope, message, data) {
        this.write("INFO", scope, message, data, false);
    }
    warn(scope, message, data) {
        this.write("WARN", scope, message, data, false);
    }
    error(scope, message, data) {
        this.write("ERROR", scope, message, data, false);
    }
    debug(scope, message, data) {
        this.write("DEBUG", scope, message, data, true);
    }
    async capturePage(page, label, metadata) {
        if (!this.config.enabled || !this.config.persistHtmlSnapshots) {
            return;
        }
        const timestamp = new Date().toISOString();
        const fileStem = (0, debug_artifacts_1.buildArtifactFileName)({ label, timestamp, extension: "html" }).replace(/\.html$/, "");
        const htmlPath = node_path_1.default.join(this.artifactsDirectory, `${fileStem}.html`);
        const jsonPath = node_path_1.default.join(this.artifactsDirectory, `${fileStem}.json`);
        const textPath = node_path_1.default.join(this.artifactsDirectory, `${fileStem}.txt`);
        const [html, bodyText, title] = await Promise.all([
            page.content(),
            page.textContent("body").catch(() => ""),
            page.title().catch(() => "")
        ]);
        node_fs_1.default.writeFileSync(htmlPath, html, "utf8");
        node_fs_1.default.writeFileSync(textPath, bodyText ?? "", "utf8");
        node_fs_1.default.writeFileSync(jsonPath, JSON.stringify({
            timestamp,
            url: page.url(),
            title,
            metadata: metadata ?? {}
        }, null, 2), "utf8");
        this.debug("snapshot", `Saved page artifact: ${node_path_1.default.basename(htmlPath)}`);
    }
    write(level, scope, message, data, verboseOnly) {
        if (!this.config.enabled) {
            return;
        }
        if (verboseOnly && !this.config.verboseLogging) {
            return;
        }
        const timestamp = new Date().toISOString();
        const line = JSON.stringify({ timestamp, level, scope, message, data: data ?? null });
        node_fs_1.default.mkdirSync(this.artifactsDirectory, { recursive: true });
        node_fs_1.default.appendFileSync(this.logFilePath, `${line}\n`, "utf8");
        if (level === "ERROR") {
            console.error(`[${scope}] ${message}`, data ?? "");
            return;
        }
        if (level === "WARN") {
            console.warn(`[${scope}] ${message}`, data ?? "");
            return;
        }
        console.log(`[${scope}] ${message}`, data ?? "");
    }
}
exports.DebugRuntime = DebugRuntime;
//# sourceMappingURL=debug-runtime.js.map