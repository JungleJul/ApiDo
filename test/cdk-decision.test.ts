import { describe, expect, test } from "vitest";

import { describeCdkDecisionBasis } from "../src/core/cdk-debug";

describe("describeCdkDecisionBasis", () => {
  test("marks time-window based waiting decision", () => {
    expect(
      describeCdkDecisionBasis({
        looksLikeHydration: false,
        usedWindowParsing: true,
        retryAttempts: 1,
        finalStatus: "WAITING"
      })
    ).toBe("时间窗口判定");
  });

  test("marks body-text decision after retries", () => {
    expect(
      describeCdkDecisionBasis({
        looksLikeHydration: false,
        usedWindowParsing: false,
        retryAttempts: 3,
        finalStatus: "OUT_OF_STOCK"
      })
    ).toBe("正文识别（重试后成功）");
  });

  test("marks hydration-like failed reads", () => {
    expect(
      describeCdkDecisionBasis({
        looksLikeHydration: true,
        usedWindowParsing: false,
        retryAttempts: 4,
        finalStatus: "FAILED"
      })
    ).toBe("疑似噪声（重试后仍失败）");
  });
});
