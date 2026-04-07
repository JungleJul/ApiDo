export type MonitorPhase =
  | "STARTUP_LOGIN_CHECK"
  | "WAITING_LOGIN_CONFIRMATION"
  | "READY"
  | "SCANNING"
  | "QUEUEING"
  | "READING_TOPIC"
  | "READING_CDK"
  | "COOLDOWN"
  | "IDLE"
  | "CLOUDFLARE_BACKOFF"
  | "BROWSER_RECOVERY"
  | "ERROR";

export interface LoginGateState {
  linuxDo: "LOGGED_IN" | "LOGIN_NEEDED" | "CLOUDFLARE_CHALLENGE" | "UNKNOWN";
  cdkLinuxDo: "LOGGED_IN" | "LOGIN_NEEDED" | "CLOUDFLARE_CHALLENGE" | "UNKNOWN";
  confirmationRequired: boolean;
  confirmedByUser: boolean;
}

export interface LoginGateSummary {
  phase: MonitorPhase;
  requiresConfirmation: boolean;
  detail: string;
}

export interface ScanOutcomeInput {
  listItemCount: number;
  candidateCount: number;
  enqueuedCount: number;
  cooldownSkippedCount: number;
  duplicateSkippedCount: number;
}

export interface ScanOutcomeSummary {
  phase: MonitorPhase;
  detail: string;
}

export interface BrowserSessionHealthInput {
  browserControlMode: "edge-cdp" | "playwright";
  hasContext: boolean;
  hasBrowserConnection: boolean;
  browserConnectionConnected: boolean;
  edgeProcessAlive: boolean;
}

export const describeLoginGate = (state: LoginGateState): LoginGateSummary => {
  const fullyLoggedIn = state.linuxDo === "LOGGED_IN" && state.cdkLinuxDo === "LOGGED_IN";
  if (!fullyLoggedIn || (state.confirmationRequired && !state.confirmedByUser)) {
    return {
      phase: "WAITING_LOGIN_CONFIRMATION",
      requiresConfirmation: true,
      detail: "请先在浏览器中确认 linux.do 和 cdk.linux.do 都已登录，然后点击已确认登录。"
    };
  }

  return {
    phase: "READY",
    requiresConfirmation: false,
    detail: "登录状态已确认，程序可以开始扫描。"
  };
};

export const describeScanOutcome = (input: ScanOutcomeInput): ScanOutcomeSummary => {
  if (input.candidateCount === 0) {
    return {
      phase: "IDLE",
      detail: `前 ${input.listItemCount} 条主题里没有命中关键字或固定标签。`
    };
  }

  if (input.enqueuedCount === 0 && input.cooldownSkippedCount === input.candidateCount) {
    return {
      phase: "COOLDOWN",
      detail: `命中的 ${input.candidateCount} 个主题都在 30 分钟冷却中，本轮无需重复读取。`
    };
  }

  if (input.enqueuedCount === 0 && input.duplicateSkippedCount > 0) {
    return {
      phase: "QUEUEING",
      detail: "命中的主题已经在队列中等待处理，本轮没有新增读取任务。"
    };
  }

  return {
    phase: "QUEUEING",
    detail: `本轮命中 ${input.candidateCount} 个主题，已加入 ${input.enqueuedCount} 个读取任务。`
  };
};

export const isBrowserSessionUsable = (input: BrowserSessionHealthInput): boolean => {
  if (!input.hasContext) {
    return false;
  }

  if (input.browserControlMode === "playwright") {
    return true;
  }

  return input.hasBrowserConnection && input.browserConnectionConnected && input.edgeProcessAlive;
};
