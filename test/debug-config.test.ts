import { describe, expect, test } from "vitest";

import { getDebugConfig } from "../src/core/debug-config";

describe("getDebugConfig", () => {
  test("uses edge headed defaults that are friendlier to cloudflare-protected sites", () => {
    expect(getDebugConfig({})).toEqual({
      enabled: false,
      browserControlMode: "edge-cdp",
      headless: false,
      browserChannel: "msedge",
      edgeExecutablePath: null,
      openElectronDevTools: false,
      persistHtmlSnapshots: false,
      verboseLogging: false
    });
  });

  test("enables debugging flags from env vars", () => {
    expect(
      getDebugConfig({
        LINUXDO_DEBUG: "1",
        LINUXDO_BROWSER_MODE: "playwright",
        LINUXDO_HEADFUL: "false",
        LINUXDO_BROWSER_CHANNEL: "chromium",
        LINUXDO_EDGE_PATH: "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
        LINUXDO_OPEN_DEVTOOLS: "yes",
        LINUXDO_SAVE_HTML: "on",
        LINUXDO_VERBOSE_LOGS: "1"
      })
    ).toEqual({
      enabled: true,
      browserControlMode: "playwright",
      headless: true,
      browserChannel: "chromium",
      edgeExecutablePath: "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
      openElectronDevTools: true,
      persistHtmlSnapshots: true,
      verboseLogging: true
    });
  });
});
