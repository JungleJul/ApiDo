import { describe, expect, test } from "vitest";

import { canProceedAfterManualConfirmation, detectLoginStateFromProbe, type LoginProbe } from "../src/core/login-detection";

const makeProbe = (partial: Partial<LoginProbe>): LoginProbe => ({
  currentUrl: "https://linux.do/login",
  bodyText: "",
  pageTitle: "",
  hasPasswordInput: false,
  hasLoginForm: false,
  hasLogoutAction: false,
  hasCurrentUserMarker: false,
  cookieNames: [],
  ...partial
});

describe("detectLoginStateFromProbe", () => {
  test("returns LOGIN_NEEDED when the login form is visible", () => {
    expect(
      detectLoginStateFromProbe(
        makeProbe({
          bodyText: "请输入用户名和密码后登录",
          hasPasswordInput: true,
          hasLoginForm: true
        })
      )
    ).toBe("LOGIN_NEEDED");
  });

  test("returns LOGGED_IN when a strong login cookie exists and no login form is visible", () => {
    expect(
      detectLoginStateFromProbe(
        makeProbe({
          currentUrl: "https://linux.do/",
          bodyText: "欢迎回来",
          cookieNames: ["_t"]
        })
      )
    ).toBe("LOGGED_IN");
  });

  test("returns CLOUDFLARE_CHALLENGE when the page contains challenge markers", () => {
    expect(
      detectLoginStateFromProbe(
        makeProbe({
          currentUrl: "https://linux.do/cdn-cgi/challenge-platform/h/b/orchestrate/chl_page",
          bodyText: "Checking your browser before accessing linux.do"
        })
      )
    ).toBe("CLOUDFLARE_CHALLENGE");
  });
});

describe("canProceedAfterManualConfirmation", () => {
  test("allows the user to continue when checks are only unknown after manual confirmation", () => {
    expect(
      canProceedAfterManualConfirmation({
        linuxDo: "UNKNOWN",
        cdkLinuxDo: "UNKNOWN",
        confirmationRequired: true,
        confirmedByUser: false
      })
    ).toBe(true);
  });

  test("blocks continuation when either site still explicitly needs login", () => {
    expect(
      canProceedAfterManualConfirmation({
        linuxDo: "LOGGED_IN",
        cdkLinuxDo: "LOGIN_NEEDED",
        confirmationRequired: true,
        confirmedByUser: false
      })
    ).toBe(false);
  });
});
