"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonitorService = void 0;
const node_child_process_1 = require("node:child_process");
const node_events_1 = require("node:events");
const node_net_1 = require("node:net");
const node_path_1 = __importDefault(require("node:path"));
const playwright_1 = require("playwright");
const types_1 = require("../shared/types");
const cdk_alerts_1 = require("../core/cdk-alerts");
const cdk_page_1 = require("../core/cdk-page");
const cdk_time_1 = require("../core/cdk-time");
const edge_cdp_1 = require("../core/edge-cdp");
const login_detection_1 = require("../core/login-detection");
const monitor_progress_1 = require("../core/monitor-progress");
const scan_guard_1 = require("../core/scan-guard");
const topic_row_sort_1 = require("../core/topic-row-sort");
const topic_cooldown_1 = require("../core/topic-cooldown");
const time_1 = require("../core/time");
const topic_rules_1 = require("../core/topic-rules");
const urls_1 = require("../core/urls");
const LATEST_URL = "https://linux.do/tag/1515-tag/1515/l/latest";
const LOGIN_URL = "https://linux.do/login";
const CDK_LOGIN_URL = "https://cdk.linux.do/login";
const TOPIC_LIST_SELECTOR = "tr.topic-list-item, .topic-list tbody tr, .latest-topic-list-item";
const LOGIN_NEEDED_STATES = ["LOGIN_NEEDED", "CLOUDFLARE_CHALLENGE"];
const EXTERNAL_CDK_RECHECK_DELAY_MS = 8000;
const createInitialProgress = () => ({
    phase: "STARTUP_LOGIN_CHECK",
    detail: "程序启动中，正在检查 linux.do 和 cdk.linux.do 的登录状态。",
    nextActionAt: null,
    queueLength: 0,
    browserConnected: false,
    lastListCount: 0,
    lastCandidateCount: 0,
    cooldownSkippedCount: 0,
    duplicateSkippedCount: 0,
    loginChecks: {
        linuxDo: "UNKNOWN",
        cdkLinuxDo: "UNKNOWN",
        confirmationRequired: false,
        confirmedByUser: false
    }
});
class MonitorService extends node_events_1.EventEmitter {
    repository;
    settingsStore;
    userDataDir;
    notify;
    debugRuntime;
    config;
    authState = "UNKNOWN";
    lastScanAt = null;
    lastError = null;
    cloudflarePauseUntil = null;
    consecutiveCloudflareCount = 0;
    scanInterval = null;
    loginPollInterval = null;
    browserContext = null;
    browserConnection = null;
    edgeProcess = null;
    edgeRemotePort = null;
    queue = [];
    queuedTopicIds = new Set();
    queueRunning = false;
    lastTopicReadAt = 0;
    activeScanPromise = null;
    scheduledClaimChecks = new Map();
    scheduledPreAlerts = new Map();
    scheduledExternalCdkChecks = new Map();
    preAlertNotified = new Set();
    claimableNotified = new Set();
    progress = createInitialProgress();
    constructor(options) {
        super();
        this.repository = options.repository;
        this.settingsStore = options.settingsStore;
        this.userDataDir = options.userDataDir;
        this.notify = options.notify;
        this.debugRuntime = options.debugRuntime;
        this.config = this.settingsStore.load();
    }
    async start() {
        this.debugRuntime.info("monitor", "Starting monitor service", {
            config: this.config,
            debug: this.debugRuntime.getState()
        });
        this.restartScanLoop();
        this.restoreWaitingClaims();
        const ready = await this.ensureLoginReady(false);
        if (ready) {
            await this.triggerRescan();
        }
        else {
            this.emitSnapshot();
        }
    }
    async stop() {
        this.debugRuntime.info("monitor", "Stopping monitor service");
        if (this.scanInterval) {
            clearInterval(this.scanInterval);
            this.scanInterval = null;
        }
        if (this.loginPollInterval) {
            clearInterval(this.loginPollInterval);
            this.loginPollInterval = null;
        }
        for (const timeout of this.scheduledClaimChecks.values()) {
            clearTimeout(timeout);
        }
        this.scheduledClaimChecks.clear();
        for (const timeout of this.scheduledPreAlerts.values()) {
            clearTimeout(timeout);
        }
        this.scheduledPreAlerts.clear();
        for (const timeout of this.scheduledExternalCdkChecks.values()) {
            clearTimeout(timeout);
        }
        this.scheduledExternalCdkChecks.clear();
        await this.closeBrowserResources();
        this.repository.close();
    }
    getSnapshot() {
        const rows = (0, topic_row_sort_1.sortTopicRows)(this.repository.listRows());
        return {
            authState: this.authState,
            rows,
            config: this.config,
            debug: this.debugRuntime.getState(),
            lastScanAt: this.lastScanAt,
            lastError: this.lastError,
            waitingTopicIds: rows.filter((row) => row.status === "WAITING").map((row) => row.topicId),
            progress: this.buildProgressSnapshot()
        };
    }
    async updateSettings(partial) {
        this.config = this.settingsStore.save(partial);
        this.debugRuntime.info("settings", "Updated application settings", this.config);
        this.restartScanLoop();
        this.emitSnapshot();
        return this.getSnapshot();
    }
    async triggerRescan() {
        if (this.activeScanPromise) {
            this.debugRuntime.debug("scan", "Scan already running, reusing active promise");
            return this.activeScanPromise;
        }
        const gate = (0, monitor_progress_1.describeLoginGate)(this.progress.loginChecks);
        if (gate.requiresConfirmation) {
            this.setProgress(gate.phase, gate.detail);
            this.emitSnapshot();
            return;
        }
        this.activeScanPromise = this.scanLatest().finally(() => {
            this.activeScanPromise = null;
        });
        return this.activeScanPromise;
    }
    async retryClaim(topicId) {
        const cdk = this.repository.getCdk(topicId);
        if (!cdk?.cdkUrl) {
            this.debugRuntime.warn("cdk", "Recheck requested without cdk url", { topicId });
            return;
        }
        await this.handleCdk(topicId, cdk.cdkUrl);
    }
    async openLoginWindow() {
        this.debugRuntime.info("auth", "Opening manual login window");
        if (!this.isBrowserSessionHealthy() || this.debugRuntime.config.headless) {
            await this.relaunchContext(false);
        }
        this.progress.loginChecks.confirmationRequired = true;
        this.progress.loginChecks.confirmedByUser = false;
        const checks = await this.refreshLoginChecks();
        await this.openLoginPages(checks);
        this.lastError = "等待手动确认登录。";
        this.setProgress("WAITING_LOGIN_CONFIRMATION", "登录页面已打开，请手动完成登录后点击已确认登录。", null);
        this.emitSnapshot();
        this.notify("需要手动登录", "请在打开的浏览器里完成登录，然后回到主界面点击已确认登录。 ");
    }
    async confirmLogin() {
        this.debugRuntime.info("auth", "Manual login confirmation requested");
        this.setProgress("STARTUP_LOGIN_CHECK", "正在重新确认 linux.do 和 cdk.linux.do 的登录状态。", null);
        this.emitSnapshot();
        const checks = await this.refreshLoginChecks();
        this.debugRuntime.info("auth", "Manual login confirmation checks completed", checks);
        const fullyLoggedIn = checks.linuxDo === "LOGGED_IN" && checks.cdkLinuxDo === "LOGGED_IN";
        if (fullyLoggedIn || (0, login_detection_1.canProceedAfterManualConfirmation)(checks)) {
            checks.confirmationRequired = false;
            checks.confirmedByUser = true;
            this.progress.loginChecks = checks;
            this.lastError = fullyLoggedIn ? null : "登录状态暂时无法自动识别，已按你的手动确认继续，后续访问时会再次校验。";
            this.setProgress("READY", fullyLoggedIn ? "登录状态已确认，程序可以开始扫描。" : "已按你的手动确认继续，后续会在实际访问页面时再次校验登录态。", this.getNextScanAt());
            this.emitSnapshot();
            await this.triggerRescan();
            return;
        }
        this.progress.loginChecks = {
            ...checks,
            confirmationRequired: true,
            confirmedByUser: false
        };
        const gate = (0, monitor_progress_1.describeLoginGate)(this.progress.loginChecks);
        this.lastError = "登录尚未完成，请继续在浏览器中登录后再次确认。";
        this.setProgress(gate.phase, gate.detail, null);
        this.emitSnapshot();
    }
    async reinitializeBrowser() {
        this.setProgress("BROWSER_RECOVERY", "正在重新初始化浏览器会话。", null);
        this.emitSnapshot();
        await this.relaunchContext(false);
        this.lastError = null;
        this.setProgress("BROWSER_RECOVERY", "浏览器会话已重建，可以重新打开登录窗口或继续扫描。", null);
        this.emitSnapshot();
    }
    async noteCdkOpenedExternally(topicId) {
        const record = this.repository.getCdk(topicId);
        if (!record?.cdkUrl) {
            return;
        }
        const existingTimer = this.scheduledExternalCdkChecks.get(topicId);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }
        this.repository.upsertCdk({
            ...record,
            lastResultMessage: "已在外部浏览器打开，稍后会自动重新检测 CDK 状态。"
        });
        this.emitSnapshot();
        const timeout = setTimeout(() => {
            this.scheduledExternalCdkChecks.delete(topicId);
            void this.retryClaim(topicId);
        }, EXTERNAL_CDK_RECHECK_DELAY_MS);
        this.scheduledExternalCdkChecks.set(topicId, timeout);
    }
    getTopicUrl(topicId) {
        return this.repository.getTopic(topicId)?.normalizedTopicUrl ?? null;
    }
    getCdkUrl(topicId) {
        return this.repository.getCdk(topicId)?.cdkUrl ?? null;
    }
    buildProgressSnapshot() {
        return {
            ...this.progress,
            queueLength: this.queue.length,
            browserConnected: this.isBrowserSessionHealthy()
        };
    }
    emitSnapshot() {
        this.progress = this.buildProgressSnapshot();
        this.emit("snapshot", this.getSnapshot());
    }
    setProgress(phase, detail, nextActionAt = null) {
        this.progress = {
            ...this.progress,
            phase,
            detail,
            nextActionAt,
            queueLength: this.queue.length,
            browserConnected: this.isBrowserSessionHealthy()
        };
    }
    getNextScanAt() {
        return new Date(Date.now() + (0, scan_guard_1.getEffectiveScanIntervalSeconds)(this.config.scanIntervalSeconds) * 1000).toISOString();
    }
    async ensureLoginReady(notifyUser) {
        this.setProgress("STARTUP_LOGIN_CHECK", "正在检查 linux.do 和 cdk.linux.do 的登录状态。", null);
        this.emitSnapshot();
        const checks = await this.refreshLoginChecks();
        const gate = (0, monitor_progress_1.describeLoginGate)(checks);
        this.setProgress(gate.phase, gate.detail, gate.phase === "READY" ? this.getNextScanAt() : null);
        this.emitSnapshot();
        if (gate.requiresConfirmation && notifyUser) {
            this.lastError = gate.detail;
            this.notify("需要手动登录", gate.detail);
        }
        return !gate.requiresConfirmation;
    }
    async refreshLoginChecks() {
        const linuxDo = await this.inspectLoginState(LOGIN_URL, "linuxdo-login");
        const cdkLinuxDo = await this.inspectLoginState(CDK_LOGIN_URL, "cdk-login");
        const next = {
            ...this.progress.loginChecks,
            linuxDo,
            cdkLinuxDo
        };
        if (linuxDo !== "LOGGED_IN" || cdkLinuxDo !== "LOGGED_IN") {
            next.confirmationRequired = true;
            next.confirmedByUser = false;
        }
        this.progress.loginChecks = next;
        this.debugRuntime.info("auth", "Refreshed login checks", next);
        return next;
    }
    async inspectLoginState(url, artifactLabel) {
        const page = await this.getWorkingPage();
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
        await page.waitForLoadState("networkidle", { timeout: 3000 }).catch(() => undefined);
        const bodyText = ((await page.textContent("body").catch(() => "")) ?? "").slice(0, 8000);
        const currentUrl = page.url();
        const pageTitle = await page.title().catch(() => "");
        const pageMarkers = await page
            .evaluate(() => ({
            hasPasswordInput: Boolean(document.querySelector('input[type="password"], input[name*="password" i]')),
            hasLoginForm: Boolean(document.querySelector('form[action*="login"], form[action*="session"], button[type="submit"], .login-button, .btn-primary')),
            hasLogoutAction: Boolean(document.querySelector('a[href*="logout"], button[data-logout], .logout, .sign-out')),
            hasCurrentUserMarker: Boolean(document.querySelector('.current-user, .user-menu, a[href*="/u/"], img.avatar, .header-dropdown-toggle, .user-nav'))
        }))
            .catch(() => ({
            hasPasswordInput: false,
            hasLoginForm: false,
            hasLogoutAction: false,
            hasCurrentUserMarker: false
        }));
        const cookieNames = this.browserContext ? (await this.browserContext.cookies([url])).map((cookie) => cookie.name) : [];
        await this.debugRuntime.capturePage(page, artifactLabel, { url: currentUrl });
        const detectedState = (0, login_detection_1.detectLoginStateFromProbe)({
            currentUrl,
            bodyText,
            pageTitle,
            cookieNames,
            ...pageMarkers
        });
        this.debugRuntime.info("auth", "Inspected login page state", {
            artifactLabel,
            targetUrl: url,
            currentUrl,
            pageTitle,
            cookieNames,
            detectedState,
            ...pageMarkers,
            bodyPreview: bodyText.slice(0, 500)
        });
        return detectedState;
    }
    async openLoginPages(checks) {
        const context = this.browserContext;
        if (!context) {
            throw new Error("浏览器尚未就绪，无法打开登录页面。 ");
        }
        const targets = [];
        if (checks.linuxDo !== "LOGGED_IN") {
            targets.push(LOGIN_URL);
        }
        if (checks.cdkLinuxDo !== "LOGGED_IN") {
            targets.push(CDK_LOGIN_URL);
        }
        if (targets.length === 0) {
            targets.push(LATEST_URL);
        }
        const existingPages = context.pages();
        for (let index = 0; index < targets.length; index += 1) {
            const existingPage = existingPages[index];
            const page = existingPage && !existingPage.isClosed() ? existingPage : await context.newPage();
            await page.goto(targets[index], { waitUntil: "domcontentloaded", timeout: 45000 });
        }
    }
    isBrowserSessionHealthy() {
        const basicHealth = (0, monitor_progress_1.isBrowserSessionUsable)({
            browserControlMode: this.debugRuntime.config.browserControlMode,
            hasContext: Boolean(this.browserContext),
            hasBrowserConnection: Boolean(this.browserConnection),
            browserConnectionConnected: this.browserConnection?.isConnected() ?? false,
            edgeProcessAlive: Boolean(this.edgeProcess && this.edgeProcess.exitCode === null && !this.edgeProcess.killed)
        });
        if (!basicHealth) {
            return false;
        }
        try {
            this.browserContext?.pages();
            return true;
        }
        catch {
            return false;
        }
    }
    restartScanLoop() {
        if (this.scanInterval) {
            clearInterval(this.scanInterval);
        }
        const effectiveIntervalSeconds = (0, scan_guard_1.getEffectiveScanIntervalSeconds)(this.config.scanIntervalSeconds);
        this.debugRuntime.debug("scan", "Restarting scan loop", {
            requestedIntervalSeconds: this.config.scanIntervalSeconds,
            effectiveIntervalSeconds
        });
        this.scanInterval = setInterval(() => {
            void this.triggerRescan();
        }, effectiveIntervalSeconds * 1000);
    }
    async scanLatest() {
        const now = new Date();
        if ((0, scan_guard_1.shouldSkipLatestScan)(this.cloudflarePauseUntil, now)) {
            this.setProgress("CLOUDFLARE_BACKOFF", `Cloudflare 退避中，将在 ${new Date(this.cloudflarePauseUntil ?? now.toISOString()).toLocaleString("zh-CN", {
                hour12: false,
                timeZone: types_1.APP_TIMEZONE
            })} 后再次尝试。`, this.cloudflarePauseUntil);
            this.emitSnapshot();
            return;
        }
        this.setProgress("SCANNING", "正在刷新 latest 列表页并检查前 10 条主题。", null);
        this.emitSnapshot();
        try {
            const page = await this.getWorkingPage();
            await page.goto(LATEST_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
            this.authState = await this.detectAuthState(page);
            await this.debugRuntime.capturePage(page, "latest-list", { authState: this.authState });
            if (this.authState === "CLOUDFLARE_CHALLENGE") {
                const backoff = (0, scan_guard_1.createCloudflareBackoffState)(this.consecutiveCloudflareCount, now);
                this.consecutiveCloudflareCount = backoff.consecutiveCloudflareCount;
                this.cloudflarePauseUntil = backoff.pauseUntil;
                this.lastError = `检测到 Cloudflare 验证，自动扫描已暂停到 ${new Date(backoff.pauseUntil).toLocaleString("zh-CN", { hour12: false, timeZone: types_1.APP_TIMEZONE })}。`;
                this.debugRuntime.warn("auth", "Latest scan blocked by Cloudflare", {
                    pauseUntil: this.cloudflarePauseUntil,
                    consecutiveCloudflareCount: this.consecutiveCloudflareCount,
                    url: page.url()
                });
                this.setProgress("CLOUDFLARE_BACKOFF", this.lastError, this.cloudflarePauseUntil);
                this.emitSnapshot();
                this.notify("监控已退避", this.lastError);
                return;
            }
            if (this.authState === "LOGIN_NEEDED") {
                this.progress.loginChecks = {
                    ...this.progress.loginChecks,
                    linuxDo: "LOGIN_NEEDED",
                    confirmationRequired: true,
                    confirmedByUser: false
                };
                const gate = (0, monitor_progress_1.describeLoginGate)(this.progress.loginChecks);
                this.lastError = "登录态无效，需要手动登录。";
                this.debugRuntime.warn("auth", "Latest scan blocked by login state", { url: page.url() });
                this.setProgress(gate.phase, gate.detail, null);
                this.emitSnapshot();
                this.notify("监控暂停", this.lastError);
                return;
            }
            this.cloudflarePauseUntil = null;
            this.consecutiveCloudflareCount = 0;
            const listItems = await this.extractTopicList(page);
            const candidates = (0, topic_rules_1.selectCandidateTopics)(listItems, this.config.keywords);
            let enqueuedCount = 0;
            let cooldownSkippedCount = 0;
            let duplicateSkippedCount = 0;
            for (const candidate of candidates) {
                const outcome = this.enqueueCandidate(candidate);
                if (outcome === "ENQUEUED") {
                    enqueuedCount += 1;
                }
                else if (outcome === "COOLDOWN") {
                    cooldownSkippedCount += 1;
                }
                else {
                    duplicateSkippedCount += 1;
                }
            }
            this.debugRuntime.info("scan", "Latest scan parsed", {
                listItemCount: listItems.length,
                candidateCount: candidates.length,
                enqueuedCount,
                cooldownSkippedCount,
                duplicateSkippedCount,
                keywords: this.config.keywords
            });
            const summary = (0, monitor_progress_1.describeScanOutcome)({
                listItemCount: listItems.length,
                candidateCount: candidates.length,
                enqueuedCount,
                cooldownSkippedCount,
                duplicateSkippedCount
            });
            this.lastScanAt = new Date().toISOString();
            this.lastError = null;
            this.progress = {
                ...this.progress,
                lastListCount: listItems.length,
                lastCandidateCount: candidates.length,
                cooldownSkippedCount,
                duplicateSkippedCount,
                queueLength: this.queue.length,
                browserConnected: this.isBrowserSessionHealthy()
            };
            this.setProgress(summary.phase, summary.detail, this.getNextScanAt());
            this.emitSnapshot();
        }
        catch (error) {
            this.lastError = error instanceof Error ? error.message : String(error);
            this.debugRuntime.error("scan", "Latest scan failed", { error: this.lastError });
            this.setProgress("ERROR", `读取 latest 列表失败：${this.lastError}`, null);
            this.emitSnapshot();
        }
    }
    enqueueCandidate(candidate) {
        if (this.queuedTopicIds.has(candidate.topicId)) {
            this.debugRuntime.debug("queue", "Skipping duplicate queued topic", { topicId: candidate.topicId });
            return "DUPLICATE";
        }
        const existing = this.repository.getTopic(candidate.topicId);
        if (existing && !(0, topic_cooldown_1.shouldDeepReadTopic)(existing.lastDeepReadAt, this.config.topicCooldownMinutes, new Date())) {
            this.debugRuntime.debug("queue", "Skipping topic due to cooldown", {
                topicId: candidate.topicId,
                lastDeepReadAt: existing.lastDeepReadAt
            });
            return "COOLDOWN";
        }
        this.queue.push(candidate);
        this.queuedTopicIds.add(candidate.topicId);
        this.debugRuntime.info("queue", "Queued topic for deep read", candidate);
        if (!this.queueRunning) {
            this.queueRunning = true;
            void this.processQueue();
        }
        return "ENQUEUED";
    }
    async processQueue() {
        while (this.queue.length > 0) {
            const candidate = this.queue.shift();
            if (!candidate) {
                continue;
            }
            this.queuedTopicIds.delete(candidate.topicId);
            const waitForGap = this.config.topicReadMinGapSeconds * 1000 - (Date.now() - this.lastTopicReadAt);
            this.debugRuntime.debug("queue", "Processing queued topic", {
                topicId: candidate.topicId,
                waitForGap
            });
            await (0, time_1.delay)(waitForGap);
            await this.deepReadTopic(candidate);
            this.lastTopicReadAt = Date.now();
        }
        this.queueRunning = false;
        this.emitSnapshot();
    }
    async deepReadTopic(candidate) {
        try {
            const page = await this.getWorkingPage();
            await page.goto(candidate.normalizedTopicUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
            this.authState = await this.detectAuthState(page);
            await this.debugRuntime.capturePage(page, `topic-${candidate.topicId}`, {
                authState: this.authState,
                topicId: candidate.topicId,
                normalizedTopicUrl: candidate.normalizedTopicUrl
            });
            if (LOGIN_NEEDED_STATES.includes(this.authState)) {
                this.lastError = "读取主题时需要手动登录。";
                this.debugRuntime.warn("auth", "Topic read blocked by auth state", { topicId: candidate.topicId, authState: this.authState });
                this.emitSnapshot();
                this.notify("主题读取暂停", this.lastError);
                return;
            }
            const snapshot = await this.extractTopicSnapshot(page, candidate.title);
            const existing = this.repository.getTopic(candidate.topicId);
            const nowIso = new Date().toISOString();
            const topicRecord = {
                topicId: candidate.topicId,
                title: snapshot.title,
                topicUrl: candidate.topicUrl,
                normalizedTopicUrl: candidate.normalizedTopicUrl,
                publishedAt: snapshot.publishedAt,
                discoveredAt: existing?.discoveredAt ?? nowIso,
                lastDeepReadAt: nowIso,
                matchReason: candidate.matchReason,
                isNew: snapshot.isNew,
                externalLinks: snapshot.externalLinks
            };
            this.debugRuntime.info("topic", "Deep read parsed topic", {
                topicId: candidate.topicId,
                title: snapshot.title,
                cdkLinkCount: snapshot.cdkLinks.length,
                externalLinkCount: snapshot.externalLinks.length,
                publishedAt: snapshot.publishedAt,
                isNew: snapshot.isNew
            });
            this.repository.upsertTopic(topicRecord);
            if (snapshot.cdkLinks.length > 0) {
                await this.handleCdk(candidate.topicId, snapshot.cdkLinks[0]);
            }
            else {
                this.clearCdkTimers(candidate.topicId);
                this.repository.upsertCdk({
                    topicId: candidate.topicId,
                    cdkUrl: null,
                    startAt: null,
                    endAt: null,
                    status: "NO_CDK",
                    lastAttemptAt: null,
                    lastResultMessage: null
                });
            }
            this.lastError = null;
            this.emitSnapshot();
        }
        catch (error) {
            this.lastError = error instanceof Error ? error.message : String(error);
            this.debugRuntime.error("topic", "Deep read failed", { topicId: candidate.topicId, error: this.lastError });
            this.emitSnapshot();
        }
    }
    async handleCdk(topicId, cdkUrl) {
        try {
            const page = await this.getWorkingPage();
            await page.goto(cdkUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
            this.authState = await this.detectAuthState(page);
            await this.debugRuntime.capturePage(page, `cdk-${topicId}-status`, {
                authState: this.authState,
                topicId,
                cdkUrl
            });
            if (LOGIN_NEEDED_STATES.includes(this.authState)) {
                this.repository.upsertCdk({
                    topicId,
                    cdkUrl,
                    startAt: null,
                    endAt: null,
                    status: "LOGIN_REQUIRED",
                    lastAttemptAt: new Date().toISOString(),
                    lastResultMessage: "需要手动登录后重试"
                });
                this.lastError = "CDK 页面要求重新登录。";
                this.debugRuntime.warn("auth", "CDK page blocked by auth state", { topicId, authState: this.authState, cdkUrl });
                this.emitSnapshot();
                this.notify("CDK 检测暂停", this.lastError);
                return;
            }
            const bodyText = ((await page.locator("body").innerText().catch(() => "")) || ((await page.textContent("body").catch(() => "")) ?? "")).trim();
            const parsedWindow = (0, cdk_time_1.parseCdkWindow)(bodyText);
            if (parsedWindow) {
                const windowStatus = (0, cdk_time_1.classifyCdkWindow)(parsedWindow, new Date());
                this.debugRuntime.info("cdk", "Parsed cdk time window", {
                    topicId,
                    cdkUrl,
                    parsedWindow,
                    windowStatus
                });
                if (windowStatus === "ENDED") {
                    this.clearCdkTimers(topicId);
                    this.repository.upsertCdk({
                        topicId,
                        cdkUrl,
                        startAt: parsedWindow.startAt,
                        endAt: parsedWindow.endAt,
                        status: "ENDED",
                        lastAttemptAt: new Date().toISOString(),
                        lastResultMessage: "活动已结束"
                    });
                    this.emitSnapshot();
                    return;
                }
                const alertPlan = (0, cdk_alerts_1.getManualClaimAlertPlan)(parsedWindow, new Date());
                if (alertPlan.status === "WAITING") {
                    this.repository.upsertCdk({
                        topicId,
                        cdkUrl,
                        startAt: parsedWindow.startAt,
                        endAt: parsedWindow.endAt,
                        status: "WAITING",
                        lastAttemptAt: null,
                        lastResultMessage: alertPlan.message
                    });
                    this.scheduleManualClaimNotifications(topicId, parsedWindow.startAt, alertPlan.notifyAt, alertPlan.shouldNotifyImmediately, alertPlan.message);
                    this.emitSnapshot();
                    return;
                }
            }
            else {
                this.debugRuntime.warn("cdk", "Failed to parse cdk time window from page body", { topicId, cdkUrl });
            }
            const record = this.evaluateManualClaimState(topicId, cdkUrl, parsedWindow?.startAt ?? null, parsedWindow?.endAt ?? null, bodyText);
            this.repository.upsertCdk(record);
            this.emitSnapshot();
        }
        catch (error) {
            this.repository.upsertCdk({
                topicId,
                cdkUrl,
                startAt: null,
                endAt: null,
                status: "FAILED",
                lastAttemptAt: new Date().toISOString(),
                lastResultMessage: error instanceof Error ? error.message : String(error)
            });
            this.lastError = error instanceof Error ? error.message : String(error);
            this.debugRuntime.error("cdk", "CDK handling failed", { topicId, cdkUrl, error: this.lastError });
            this.emitSnapshot();
        }
    }
    evaluateManualClaimState(topicId, cdkUrl, startAt, endAt, bodyText) {
        this.clearCdkTimers(topicId);
        const analysis = (0, cdk_page_1.analyzeCdkPageText)(bodyText);
        this.debugRuntime.debug("cdk", "Evaluating manual-claim page state", {
            topicId,
            cdkUrl,
            remainingQuota: analysis.remainingQuota,
            totalQuota: analysis.totalQuota,
            status: analysis.status,
            bodyPreview: analysis.normalizedText.slice(0, 500)
        });
        if (analysis.status === "CLAIMABLE") {
            const message = analysis.message || (0, cdk_alerts_1.getClaimableManualMessage)();
            if (!this.claimableNotified.has(topicId)) {
                this.notify("CDK 可手动领取", message);
                this.claimableNotified.add(topicId);
            }
            return this.makeCdkRecord(topicId, cdkUrl, startAt, endAt, "CLAIMABLE", message);
        }
        if (analysis.status === "OUT_OF_STOCK") {
            return this.makeCdkRecord(topicId, cdkUrl, startAt, endAt, "OUT_OF_STOCK", analysis.message);
        }
        if (analysis.status === "CLAIMED") {
            return this.makeCdkRecord(topicId, cdkUrl, startAt, endAt, "CLAIMED", analysis.message);
        }
        if (analysis.status === "ENDED") {
            return this.makeCdkRecord(topicId, cdkUrl, startAt, endAt, "ENDED", analysis.message);
        }
        return this.makeCdkRecord(topicId, cdkUrl, startAt, endAt, "FAILED", analysis.message);
    }
    makeCdkRecord(topicId, cdkUrl, startAt, endAt, status, message) {
        return {
            topicId,
            cdkUrl,
            startAt,
            endAt,
            status,
            lastAttemptAt: new Date().toISOString(),
            lastResultMessage: message
        };
    }
    restoreWaitingClaims() {
        for (const row of this.repository.listRows()) {
            if (row.status === "WAITING" && row.startAt) {
                this.scheduleManualClaimNotifications(row.topicId, row.startAt, row.startAt, false, "活动即将开始，请准备手动完成二次校验。");
            }
        }
    }
    scheduleManualClaimNotifications(topicId, startAt, notifyAt, shouldNotifyImmediately, message) {
        const preAlertTimer = this.scheduledPreAlerts.get(topicId);
        if (preAlertTimer) {
            clearTimeout(preAlertTimer);
        }
        const claimCheckTimer = this.scheduledClaimChecks.get(topicId);
        if (claimCheckTimer) {
            clearTimeout(claimCheckTimer);
        }
        this.claimableNotified.delete(topicId);
        if (shouldNotifyImmediately && !this.preAlertNotified.has(topicId)) {
            this.notify("CDK 即将开始", message);
            this.preAlertNotified.add(topicId);
        }
        else if (notifyAt && notifyAt !== startAt && !this.preAlertNotified.has(topicId)) {
            const preAlertDelay = Math.max(0, new Date(notifyAt).getTime() - Date.now());
            const timeout = setTimeout(() => {
                this.scheduledPreAlerts.delete(topicId);
                if (!this.preAlertNotified.has(topicId)) {
                    this.notify("CDK 即将开始", message);
                    this.preAlertNotified.add(topicId);
                }
            }, preAlertDelay);
            this.scheduledPreAlerts.set(topicId, timeout);
        }
        const startDelay = Math.max(0, new Date(startAt).getTime() - Date.now());
        const timeout = setTimeout(() => {
            this.scheduledClaimChecks.delete(topicId);
            this.preAlertNotified.add(topicId);
            void this.retryClaim(topicId);
        }, startDelay);
        this.scheduledClaimChecks.set(topicId, timeout);
        this.debugRuntime.info("scheduler", "Scheduled manual-claim notifications", {
            topicId,
            startAt,
            notifyAt,
            shouldNotifyImmediately
        });
    }
    clearCdkTimers(topicId) {
        const preAlertTimer = this.scheduledPreAlerts.get(topicId);
        if (preAlertTimer) {
            clearTimeout(preAlertTimer);
            this.scheduledPreAlerts.delete(topicId);
        }
        const claimCheckTimer = this.scheduledClaimChecks.get(topicId);
        if (claimCheckTimer) {
            clearTimeout(claimCheckTimer);
            this.scheduledClaimChecks.delete(topicId);
        }
    }
    async checkManualLoginProgress() {
        if (!this.browserContext) {
            return;
        }
        const page = this.browserContext.pages()[0] ?? await this.browserContext.newPage();
        this.authState = await this.detectAuthState(page);
        this.debugRuntime.debug("auth", "Polling manual login progress", { authState: this.authState, url: page.url() });
        this.emitSnapshot();
        if (this.authState === "LOGGED_IN") {
            if (this.loginPollInterval) {
                clearInterval(this.loginPollInterval);
                this.loginPollInterval = null;
            }
            this.cloudflarePauseUntil = null;
            this.consecutiveCloudflareCount = 0;
            this.notify("登录成功", "已恢复自动监控，后台将继续轮询。 ");
            await this.triggerRescan();
        }
    }
    async extractTopicList(page) {
        const rows = await page.evaluate((selector) => {
            const nodes = Array.from(document.querySelectorAll(selector)).slice(0, 10);
            return nodes
                .map((row) => {
                const titleElement = row.querySelector("a.title, .title a, a.raw-topic-link");
                const tagElements = Array.from(row.querySelectorAll(".discourse-tag, .simple-topic-list__tag, .badge-category__name"));
                return {
                    title: titleElement?.textContent?.trim() ?? "",
                    topicUrl: titleElement?.href ?? "",
                    tags: tagElements.map((tag) => tag.textContent?.trim() ?? "").filter(Boolean)
                };
            })
                .filter((row) => row.title && row.topicUrl);
        }, TOPIC_LIST_SELECTOR);
        this.debugRuntime.debug("scan", "Extracted topic list rows", rows);
        return rows;
    }
    async extractTopicSnapshot(page, fallbackTitle) {
        const raw = await page.evaluate((titleBackup) => {
            const title = document.querySelector("#topic-title .fancy-title, h1.fancy-title, h1")?.textContent?.trim() ?? titleBackup;
            const publishedAt = document.querySelector("article#post_1 time[datetime], #post_1 time[datetime], .topic-post:first-child time[datetime]")?.dateTime ?? null;
            const links = Array.from(document.querySelectorAll("article#post_1 .cooked a[href], #post_1 .cooked a[href], .topic-post:first-child .cooked a[href]"))
                .map((node) => node.href)
                .filter(Boolean);
            return {
                title,
                publishedAt,
                links
            };
        }, fallbackTitle);
        const { cdkLinks, externalLinks } = (0, urls_1.collectLinks)(raw.links);
        return {
            topicId: 0,
            title: raw.title,
            topicUrl: page.url(),
            publishedAt: raw.publishedAt,
            externalLinks,
            cdkLinks,
            isNew: (0, time_1.isTopicNew)(raw.publishedAt)
        };
    }
    async getWorkingPage() {
        if (!this.browserContext) {
            await this.relaunchContext(this.debugRuntime.config.headless);
        }
        const context = this.browserContext;
        if (!context) {
            throw new Error("浏览器上下文启动失败");
        }
        const existingPage = context.pages()[0];
        if (existingPage) {
            return existingPage;
        }
        return context.newPage();
    }
    async closeBrowserResources() {
        if (this.browserConnection) {
            await this.browserConnection.close().catch(() => undefined);
            this.browserConnection = null;
            this.browserContext = null;
        }
        else if (this.browserContext) {
            await this.browserContext.close().catch(() => undefined);
            this.browserContext = null;
        }
        if (this.edgeProcess && !this.edgeProcess.killed) {
            this.edgeProcess.kill();
            await (0, time_1.delay)(500);
        }
        this.edgeProcess = null;
        this.edgeRemotePort = null;
    }
    async relaunchContext(headless) {
        await this.closeBrowserResources();
        if (this.debugRuntime.config.browserControlMode === "edge-cdp") {
            await this.launchEdgeViaCdp();
            return;
        }
        this.debugRuntime.info("browser", "Launching Playwright-managed browser context", {
            headless,
            browserChannel: this.debugRuntime.config.browserChannel,
            userDataDir: this.userDataDir
        });
        this.browserContext = await playwright_1.chromium.launchPersistentContext(node_path_1.default.join(this.userDataDir, "playwright-profile"), {
            channel: this.debugRuntime.config.browserChannel,
            headless,
            locale: "zh-CN",
            timezoneId: types_1.APP_TIMEZONE,
            viewport: { width: 1440, height: 960 }
        });
    }
    async launchEdgeViaCdp() {
        const executablePath = (0, edge_cdp_1.resolveEdgeExecutablePath)(this.debugRuntime.config.edgeExecutablePath);
        const remoteDebuggingPort = await this.getFreePort();
        const launchPlan = (0, edge_cdp_1.buildEdgeCdpLaunchPlan)({
            executablePath,
            remoteDebuggingPort,
            userDataDir: node_path_1.default.join(this.userDataDir, "edge-profile"),
            startUrl: "about:blank"
        });
        this.debugRuntime.info("browser", "Launching native Edge instance for CDP attach", launchPlan);
        this.edgeProcess = (0, node_child_process_1.spawn)(launchPlan.executablePath, launchPlan.args, {
            stdio: "ignore",
            windowsHide: false
        });
        this.edgeProcess.once("exit", (code, signal) => {
            this.debugRuntime.warn("browser", "Native Edge process exited", { code, signal, remoteDebuggingPort: launchPlan.remoteDebuggingPort });
            this.edgeProcess = null;
        });
        const wsEndpoint = await this.waitForEdgeCdpReady(launchPlan.remoteDebuggingPort, 30000);
        this.browserConnection = await playwright_1.chromium.connectOverCDP(wsEndpoint);
        this.browserContext = this.browserConnection.contexts()[0] ?? null;
        this.edgeRemotePort = launchPlan.remoteDebuggingPort;
        if (!this.browserContext) {
            throw new Error("Edge CDP 默认上下文不可用，请重新打开登录窗口重试。 ");
        }
    }
    async waitForEdgeCdpReady(port, timeoutMs) {
        const endpointUrl = `http://127.0.0.1:${port}/json/version`;
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            try {
                const response = await fetch(endpointUrl);
                if (response.ok) {
                    const payload = (await response.json());
                    return (0, edge_cdp_1.resolveEdgeCdpWebSocketUrl)(payload);
                }
            }
            catch {
            }
            await (0, time_1.delay)(500);
        }
        throw new Error("Edge 远程调试端口未就绪，请确认浏览器已成功启动。 ");
    }
    async getFreePort() {
        return new Promise((resolve, reject) => {
            const server = (0, node_net_1.createServer)();
            server.unref();
            server.on("error", reject);
            server.listen(0, "127.0.0.1", () => {
                const address = server.address();
                if (!address || typeof address === "string") {
                    server.close(() => reject(new Error("无法分配 Edge 远程调试端口。")));
                    return;
                }
                server.close((error) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve(address.port);
                });
            });
        });
    }
    async detectAuthState(page) {
        const bodyText = ((await page.textContent("body").catch(() => "")) ?? "").slice(0, 8000);
        const topicRows = await page.locator(TOPIC_LIST_SELECTOR).count().catch(() => 0);
        let nextState = "UNKNOWN";
        if (/cloudflare|checking your browser|turnstile|cf-challenge/i.test(bodyText)) {
            nextState = "CLOUDFLARE_CHALLENGE";
        }
        else if (topicRows > 0) {
            nextState = "LOGGED_IN";
        }
        else if (/登录|sign in|log in|登录到/i.test(bodyText) || /\/login|\/session/.test(page.url())) {
            nextState = "LOGIN_NEEDED";
        }
        this.debugRuntime.debug("auth", "Detected auth state", {
            url: page.url(),
            topicRows,
            nextState,
            bodyPreview: bodyText.slice(0, 300)
        });
        return nextState;
    }
}
exports.MonitorService = MonitorService;
//# sourceMappingURL=monitor-service.js.map