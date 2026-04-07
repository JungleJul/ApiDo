import type { DebugConfig as DebugConfigFlags } from "../core/debug-config";
import type { MonitorPhase } from "../core/monitor-progress";

export const APP_TIMEZONE = "Asia/Shanghai";
export const FIXED_TAG = "福利羊毛";

export type MatchReason = "KEYWORD" | "FIXED_TAG";

export type CdkStatus =
  | "NO_CDK"
  | "WAITING"
  | "CLAIMABLE"
  | "CLAIMING"
  | "CLAIMED"
  | "OUT_OF_STOCK"
  | "FAILED"
  | "ENDED"
  | "LOGIN_REQUIRED";

export type AuthState = "LOGGED_IN" | "LOGIN_NEEDED" | "CLOUDFLARE_CHALLENGE" | "UNKNOWN";

export interface AppConfig {
  scanIntervalSeconds: number;
  topicReadMinGapSeconds: number;
  topicCooldownMinutes: number;
  keywords: string[];
  notificationsEnabled: boolean;
}

export interface DebugState extends DebugConfigFlags {
  artifactsDirectory: string;
  logFilePath: string;
}

export interface LoginChecks {
  linuxDo: AuthState;
  cdkLinuxDo: AuthState;
  confirmationRequired: boolean;
  confirmedByUser: boolean;
}

export interface RuntimeProgress {
  phase: MonitorPhase;
  detail: string;
  nextActionAt: string | null;
  queueLength: number;
  browserConnected: boolean;
  lastListCount: number;
  lastCandidateCount: number;
  cooldownSkippedCount: number;
  duplicateSkippedCount: number;
  loginChecks: LoginChecks;
}

export interface CandidateTopic {
  topicId: number;
  title: string;
  topicUrl: string;
  normalizedTopicUrl: string;
  tags: string[];
  matchReason: MatchReason;
}

export interface TopicRecord {
  topicId: number;
  title: string;
  topicUrl: string;
  normalizedTopicUrl: string;
  publishedAt: string | null;
  discoveredAt: string;
  lastDeepReadAt: string | null;
  matchReason: MatchReason;
  isNew: boolean;
  externalLinks: string[];
}

export interface CdkRecord {
  topicId: number;
  cdkUrl: string | null;
  startAt: string | null;
  endAt: string | null;
  status: CdkStatus;
  lastAttemptAt: string | null;
  lastResultMessage: string | null;
}

export interface TopicRow extends TopicRecord, CdkRecord {
  needsCdk: boolean;
}

export interface TopicSnapshot {
  topicId: number;
  title: string;
  topicUrl: string;
  publishedAt: string | null;
  externalLinks: string[];
  cdkLinks: string[];
  isNew: boolean;
}

export interface CdkWindow {
  startAt: string;
  endAt: string;
}

export interface SchedulerTask {
  topicId: number;
  runAt: string;
}

export interface AppStatusSnapshot {
  authState: AuthState;
  rows: TopicRow[];
  config: AppConfig;
  debug: DebugState;
  lastScanAt: string | null;
  lastError: string | null;
  waitingTopicIds: number[];
  progress: RuntimeProgress;
}

export interface RendererApi {
  getSnapshot: () => Promise<AppStatusSnapshot>;
  onSnapshot: (listener: (snapshot: AppStatusSnapshot) => void) => () => void;
  openTopic: (topicId: number) => Promise<void>;
  openCdk: (topicId: number) => Promise<void>;
  openExternal: (url: string) => Promise<void>;
  openDebugDirectory: () => Promise<void>;
  openDebugLog: () => Promise<void>;
  triggerRescan: () => Promise<void>;
  retryClaim: (topicId: number) => Promise<void>;
  openLoginWindow: () => Promise<void>;
  confirmLogin: () => Promise<void>;
  reinitializeBrowser: () => Promise<void>;
  updateSettings: (config: Partial<AppConfig>) => Promise<AppStatusSnapshot>;
}
