"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsStore = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const config_1 = require("./config");
class SettingsStore {
    filePath;
    constructor(filePath) {
        this.filePath = filePath;
    }
    load() {
        try {
            const raw = node_fs_1.default.readFileSync(this.filePath, "utf8");
            return this.normalize(JSON.parse(raw));
        }
        catch {
            const config = this.normalize({});
            this.write(config);
            return config;
        }
    }
    save(partial) {
        const next = this.normalize({ ...this.load(), ...partial });
        this.write(next);
        return next;
    }
    normalize(input) {
        const scanIntervalSeconds = Number.isFinite(input.scanIntervalSeconds)
            ? Math.max(10, Number(input.scanIntervalSeconds))
            : config_1.defaultConfig.scanIntervalSeconds;
        return {
            scanIntervalSeconds,
            topicReadMinGapSeconds: config_1.defaultConfig.topicReadMinGapSeconds,
            topicCooldownMinutes: config_1.defaultConfig.topicCooldownMinutes,
            keywords: Array.isArray(input.keywords)
                ? input.keywords.map((keyword) => keyword.trim()).filter(Boolean)
                : config_1.defaultConfig.keywords,
            notificationsEnabled: typeof input.notificationsEnabled === "boolean"
                ? input.notificationsEnabled
                : config_1.defaultConfig.notificationsEnabled
        };
    }
    write(config) {
        node_fs_1.default.mkdirSync(node_path_1.default.dirname(this.filePath), { recursive: true });
        node_fs_1.default.writeFileSync(this.filePath, JSON.stringify(config, null, 2), "utf8");
    }
}
exports.SettingsStore = SettingsStore;
//# sourceMappingURL=settings-store.js.map