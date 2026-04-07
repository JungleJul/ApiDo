import { describe, expect, test } from "vitest";

import { createCloudflareBackoffState, getEffectiveScanIntervalSeconds, shouldSkipLatestScan } from "../src/core/scan-guard";

describe("getEffectiveScanIntervalSeconds", () => {
  test("enforces a safer minimum interval for automatic latest-page scans", () => {
    expect(getEffectiveScanIntervalSeconds(30)).toBe(180);
    expect(getEffectiveScanIntervalSeconds(300)).toBe(300);
  });
});

describe("createCloudflareBackoffState", () => {
  test("creates a 15 minute pause on first cloudflare detection", () => {
    expect(createCloudflareBackoffState(0, new Date("2026-04-07T12:00:00.000Z"))).toEqual({
      consecutiveCloudflareCount: 1,
      pauseUntil: "2026-04-07T12:15:00.000Z"
    });
  });

  test("extends pause on repeated cloudflare detections", () => {
    expect(createCloudflareBackoffState(1, new Date("2026-04-07T12:00:00.000Z"))).toEqual({
      consecutiveCloudflareCount: 2,
      pauseUntil: "2026-04-07T12:30:00.000Z"
    });
  });
});

describe("shouldSkipLatestScan", () => {
  test("skips automatic scans while cloudflare pause is active", () => {
    expect(shouldSkipLatestScan("2026-04-07T12:15:00.000Z", new Date("2026-04-07T12:10:00.000Z"))).toBe(true);
    expect(shouldSkipLatestScan("2026-04-07T12:15:00.000Z", new Date("2026-04-07T12:16:00.000Z"))).toBe(false);
  });
});
