import { describe, expect, test } from "vitest";

import { inspectCdkTextCandidates, shouldRetryCdkTextInspection } from "../src/core/cdk-debug";

describe("inspectCdkTextCandidates", () => {
  test("prefers meaningful business text over hydration script noise", () => {
    const result = inspectCdkTextCandidates([
      {
        source: "textContent",
        text: 'self.__next_f.push([1,"static/chunks/app/layout.js"]); webpackChunk_N_E.push([[123],{456:function(){}}]);'
      },
      {
        source: "dom-cleaned",
        text: "2026/04/07 19:25:00 - 2026/04/08 19:25:00 剩余 名额 6 共 6 个 立即 领取"
      }
    ]);

    expect(result.source).toBe("dom-cleaned");
    expect(result.looksLikeHydration).toBe(false);
    expect(result.text).toContain("剩余 名额 6");
    expect(result.summary).toContain("立即 领取");
  });

  test("flags hydration-heavy content when no meaningful text is available", () => {
    const result = inspectCdkTextCandidates([
      {
        source: "innerText",
        text: 'self.__next_f.push([1,"static/chunks/app/layout.js"]); static/chunks/581.js __next_f function webpackChunk_N_E'
      }
    ]);

    expect(result.source).toBe("innerText");
    expect(result.looksLikeHydration).toBe(true);
    expect(result.summary).toContain("self.__next_f");
  });

  test("does not fall back to title when the page has only shell text", () => {
    const result = inspectCdkTextCandidates([
      {
        source: "innerText",
        text: 'self.__next_f.push([1,"static/chunks/app/layout.js"]); static/chunks/581.js __next_f function webpackChunk_N_E'
      },
      {
        source: "title",
        text: "LINUX DO CDK"
      }
    ]);

    expect(result.source).toBe("innerText");
    expect(result.looksLikeHydration).toBe(true);
    expect(result.text).not.toBe("LINUX DO CDK");
  });

  test("requests another read attempt when inspection only has shell text", () => {
    expect(
      shouldRetryCdkTextInspection({
        source: "innerText",
        text: 'self.__next_f.push([1,"static/chunks/app/layout.js"]); static/chunks/581.js',
        summary: 'self.__next_f.push([1,"static/chunks/app/layout.js"]); static/chunks/581.js',
        looksLikeHydration: true
      })
    ).toBe(true);

    expect(
      shouldRetryCdkTextInspection({
        source: "title",
        text: "LINUX DO CDK",
        summary: "LINUX DO CDK",
        looksLikeHydration: false
      })
    ).toBe(true);
  });
});
