import fs from "node:fs";
import path from "node:path";

import { defaultConfig } from "./config";
import type { AppConfig } from "../shared/types";

export class SettingsStore {
  constructor(private readonly filePath: string) {}

  load(): AppConfig {
    try {
      const raw = fs.readFileSync(this.filePath, "utf8");
      return this.normalize(JSON.parse(raw) as Partial<AppConfig>);
    } catch {
      const config = this.normalize({});
      this.write(config);
      return config;
    }
  }

  save(partial: Partial<AppConfig>): AppConfig {
    const next = this.normalize({ ...this.load(), ...partial });
    this.write(next);
    return next;
  }

  private normalize(input: Partial<AppConfig>): AppConfig {
    const scanIntervalSeconds = Number.isFinite(input.scanIntervalSeconds)
      ? Math.max(10, Number(input.scanIntervalSeconds))
      : defaultConfig.scanIntervalSeconds;

    return {
      scanIntervalSeconds,
      topicReadMinGapSeconds: defaultConfig.topicReadMinGapSeconds,
      topicCooldownMinutes: defaultConfig.topicCooldownMinutes,
      keywords: Array.isArray(input.keywords)
        ? input.keywords.map((keyword) => keyword.trim()).filter(Boolean)
        : defaultConfig.keywords,
      notificationsEnabled: typeof input.notificationsEnabled === "boolean"
        ? input.notificationsEnabled
        : defaultConfig.notificationsEnabled
    };
  }

  private write(config: AppConfig): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(config, null, 2), "utf8");
  }
}
