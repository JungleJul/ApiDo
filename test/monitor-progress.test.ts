import { describe, expect, test } from "vitest";

import {
  describeLoginGate,
  describeScanOutcome,
  isBrowserSessionUsable,
  type LoginGateState,
  type ScanOutcomeInput
} from "../src/core/monitor-progress";

const loggedInChecks: LoginGateState = {
  linuxDo: "LOGGED_IN",
  cdkLinuxDo: "LOGGED_IN",
  confirmationRequired: false,
  confirmedByUser: false
};

describe("describeLoginGate", () => {
  test("requires manual confirmation when either site is not logged in", () => {
    expect(
      describeLoginGate({
        linuxDo: "LOGGED_IN",
        cdkLinuxDo: "LOGIN_NEEDED",
        confirmationRequired: true,
        confirmedByUser: false
      })
    ).toEqual({
      phase: "WAITING_LOGIN_CONFIRMATION",
      requiresConfirmation: true,
      detail: "请先在浏览器中确认 linux.do 和 cdk.linux.do 都已登录，然后点击已确认登录。"
    });
  });

  test("allows monitoring immediately when both sites are already logged in", () => {
    expect(describeLoginGate(loggedInChecks)).toEqual({
      phase: "READY",
      requiresConfirmation: false,
      detail: "登录状态已确认，程序可以开始扫描。"
    });
  });

  test("waits for the explicit confirmation click after manual login was required", () => {
    expect(
      describeLoginGate({
        linuxDo: "LOGGED_IN",
        cdkLinuxDo: "LOGGED_IN",
        confirmationRequired: true,
        confirmedByUser: false
      })
    ).toEqual({
      phase: "WAITING_LOGIN_CONFIRMATION",
      requiresConfirmation: true,
      detail: "请先在浏览器中确认 linux.do 和 cdk.linux.do 都已登录，然后点击已确认登录。"
    });
  });
});

describe("describeScanOutcome", () => {
  test("reports when all candidates are skipped by cooldown", () => {
    const input: ScanOutcomeInput = {
      listItemCount: 10,
      candidateCount: 4,
      enqueuedCount: 0,
      cooldownSkippedCount: 4,
      duplicateSkippedCount: 0
    };

    expect(describeScanOutcome(input)).toEqual({
      phase: "COOLDOWN",
      detail: "命中的 4 个主题都在 30 分钟冷却中，本轮无需重复读取。"
    });
  });

  test("reports when nothing matched in the first 10 topics", () => {
    expect(
      describeScanOutcome({
        listItemCount: 10,
        candidateCount: 0,
        enqueuedCount: 0,
        cooldownSkippedCount: 0,
        duplicateSkippedCount: 0
      })
    ).toEqual({
      phase: "IDLE",
      detail: "前 10 条主题里没有命中关键字或固定标签。"
    });
  });
});

describe("isBrowserSessionUsable", () => {
  test("treats a closed Edge process as unusable even if context objects still exist", () => {
    expect(
      isBrowserSessionUsable({
        browserControlMode: "edge-cdp",
        hasContext: true,
        hasBrowserConnection: true,
        browserConnectionConnected: true,
        edgeProcessAlive: false
      })
    ).toBe(false);
  });

  test("accepts a healthy Playwright-managed browser context", () => {
    expect(
      isBrowserSessionUsable({
        browserControlMode: "playwright",
        hasContext: true,
        hasBrowserConnection: false,
        browserConnectionConnected: false,
        edgeProcessAlive: false
      })
    ).toBe(true);
  });
});
