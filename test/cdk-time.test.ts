import { describe, expect, test } from "vitest";

import { classifyCdkWindow, parseCdkWindow } from "../src/core/cdk-time";

describe("parseCdkWindow", () => {
  test("parses the cdk activity range text into iso dates", () => {
    expect(parseCdkWindow("2026/04/07 19:25:00 - 2026/04/08 19:25:00")).toEqual({
      startAt: "2026-04-07T11:25:00.000Z",
      endAt: "2026-04-08T11:25:00.000Z"
    });
  });
});

describe("classifyCdkWindow", () => {
  test("classifies waiting, claimable, and ended windows", () => {
    const window = {
      startAt: "2026-04-07T11:25:00.000Z",
      endAt: "2026-04-08T11:25:00.000Z"
    };

    expect(classifyCdkWindow(window, new Date("2026-04-07T11:24:59.000Z"))).toBe("WAITING");
    expect(classifyCdkWindow(window, new Date("2026-04-07T11:25:00.000Z"))).toBe("CLAIMABLE");
    expect(classifyCdkWindow(window, new Date("2026-04-08T11:25:01.000Z"))).toBe("ENDED");
  });
});
