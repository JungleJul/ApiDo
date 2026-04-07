import path from "node:path";

import { describe, expect, test } from "vitest";

import { buildEdgeCdpLaunchPlan, resolveEdgeCdpWebSocketUrl } from "../src/core/edge-cdp";

describe("buildEdgeCdpLaunchPlan", () => {
  test("builds a native Edge launch plan without playwright automation flags", () => {
    const plan = buildEdgeCdpLaunchPlan({
      executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      remoteDebuggingPort: 9222,
      userDataDir: "D:\\AI-SDY\\02Sign\\.runtime\\edge-profile",
      locale: "zh-CN",
      startUrl: "https://linux.do/tag/1515-tag/1515/l/latest"
    });

    expect(plan).toEqual({
      executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      remoteDebuggingPort: 9222,
      userDataDir: path.normalize("D:\\AI-SDY\\02Sign\\.runtime\\edge-profile"),
      args: [
        "--remote-debugging-port=9222",
        `--user-data-dir=${path.normalize("D:\\AI-SDY\\02Sign\\.runtime\\edge-profile")}`,
        "--no-first-run",
        "--no-default-browser-check",
        "--lang=zh-CN",
        "--window-size=1440,960",
        "https://linux.do/tag/1515-tag/1515/l/latest"
      ]
    });
  });
});

describe("resolveEdgeCdpWebSocketUrl", () => {
  test("returns the websocket debugger url published by Edge", () => {
    expect(
      resolveEdgeCdpWebSocketUrl({
        webSocketDebuggerUrl: "ws://127.0.0.1:9222/devtools/browser/edge-session"
      })
    ).toBe("ws://127.0.0.1:9222/devtools/browser/edge-session");
  });
});
