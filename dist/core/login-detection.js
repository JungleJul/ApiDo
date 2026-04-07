"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canProceedAfterManualConfirmation = exports.detectLoginStateFromProbe = void 0;
const CLOUDFLARE_PATTERN = /cloudflare|checking your browser|turnstile|cf-challenge|enable javascript and cookies|验证成功。正在等待/i;
const LOGIN_TEXT_PATTERN = /密码|用户名|邮箱|sign in|log in|登录到|立即登录|账号登录/i;
const ERROR_PATTERN = /ERR_|无法访问此网站|此站点无法提供安全连接|打不开这个页面/i;
const STRONG_LOGIN_COOKIE_PATTERN = /^(_t|remember_user_token|auth_token|access_token|id_token|jwt|token)$/i;
const hasStrongLoginCookie = (cookieNames) => cookieNames.some((cookieName) => STRONG_LOGIN_COOKIE_PATTERN.test(cookieName));
const detectLoginStateFromProbe = (probe) => {
    const normalizedUrl = probe.currentUrl.toLowerCase();
    if (normalizedUrl.startsWith("chrome-error://") ||
        ERROR_PATTERN.test(probe.bodyText) ||
        ERROR_PATTERN.test(probe.pageTitle)) {
        return "UNKNOWN";
    }
    if (CLOUDFLARE_PATTERN.test(probe.bodyText) ||
        CLOUDFLARE_PATTERN.test(probe.pageTitle) ||
        normalizedUrl.includes("cf-challenge")) {
        return "CLOUDFLARE_CHALLENGE";
    }
    const loginUrl = /\/login\b|\/session\b/i.test(normalizedUrl);
    const loginFormVisible = probe.hasPasswordInput || probe.hasLoginForm || LOGIN_TEXT_PATTERN.test(probe.bodyText);
    const loggedInMarkerVisible = probe.hasLogoutAction || probe.hasCurrentUserMarker;
    const strongLoginCookie = hasStrongLoginCookie(probe.cookieNames);
    if (loggedInMarkerVisible) {
        return "LOGGED_IN";
    }
    if (loginFormVisible && !strongLoginCookie) {
        return "LOGIN_NEEDED";
    }
    if (loginUrl && !loginFormVisible && strongLoginCookie) {
        return "LOGGED_IN";
    }
    if (loginUrl && loginFormVisible) {
        return "LOGIN_NEEDED";
    }
    if (!probe.bodyText.trim() && !probe.pageTitle.trim()) {
        return "UNKNOWN";
    }
    return strongLoginCookie ? "LOGGED_IN" : "UNKNOWN";
};
exports.detectLoginStateFromProbe = detectLoginStateFromProbe;
const canProceedAfterManualConfirmation = (checks) => {
    if (checks.linuxDo === "LOGGED_IN" && checks.cdkLinuxDo === "LOGGED_IN") {
        return true;
    }
    const hasBlockingState = checks.linuxDo === "LOGIN_NEEDED" ||
        checks.linuxDo === "CLOUDFLARE_CHALLENGE" ||
        checks.cdkLinuxDo === "LOGIN_NEEDED" ||
        checks.cdkLinuxDo === "CLOUDFLARE_CHALLENGE";
    if (hasBlockingState) {
        return false;
    }
    return true;
};
exports.canProceedAfterManualConfirmation = canProceedAfterManualConfirmation;
//# sourceMappingURL=login-detection.js.map