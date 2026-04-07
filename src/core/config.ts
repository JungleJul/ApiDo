import type { AppConfig } from "../shared/types";

export const defaultConfig: AppConfig = {
  scanIntervalSeconds: 30,
  topicReadMinGapSeconds: 10,
  topicCooldownMinutes: 30,
  keywords: ["公益", "小站"],
  notificationsEnabled: true
};
