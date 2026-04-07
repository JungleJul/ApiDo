"use strict";
const root = document.querySelector("#app");
const formatter = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai"
});
let currentSnapshot = null;
const escapeHtml = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const formatTime = (value) => (value ? formatter.format(new Date(value)) : "-");
const formatKeywords = (keywords) => keywords.join(", ");
const getAuthLabel = (authState) => {
    switch (authState) {
        case "LOGGED_IN":
            return "已登录";
        case "LOGIN_NEEDED":
            return "需要登录";
        case "CLOUDFLARE_CHALLENGE":
            return "Cloudflare 验证中";
        default:
            return "状态未知";
    }
};
const getLoginCheckLabel = (authState) => {
    switch (authState) {
        case "LOGGED_IN":
            return "已登录";
        case "LOGIN_NEEDED":
            return "未登录";
        case "CLOUDFLARE_CHALLENGE":
            return "验证中";
        default:
            return "待检查";
    }
};
const getPhaseLabel = (phase) => {
    switch (phase) {
        case "STARTUP_LOGIN_CHECK":
            return "启动检查";
        case "WAITING_LOGIN_CONFIRMATION":
            return "等待确认登录";
        case "READY":
            return "待机中";
        case "SCANNING":
            return "扫描列表页";
        case "QUEUEING":
            return "排队读取";
        case "READING_TOPIC":
            return "读取主题";
        case "READING_CDK":
            return "读取 CDK";
        case "COOLDOWN":
            return "命中冷却";
        case "IDLE":
            return "无命中";
        case "CLOUDFLARE_BACKOFF":
            return "Cloudflare 退避";
        case "BROWSER_RECOVERY":
            return "浏览器恢复";
        case "ERROR":
            return "异常";
    }
};
const getStatusClass = (status) => {
    switch (status) {
        case "CLAIMED":
            return "chip-success";
        case "WAITING":
            return "chip-waiting";
        case "FAILED":
        case "LOGIN_REQUIRED":
            return "chip-danger";
        case "OUT_OF_STOCK":
        case "ENDED":
            return "chip-warning";
        default:
            return "chip-muted";
    }
};
const getStatusLabel = (status) => {
    switch (status) {
        case "NO_CDK":
            return "无需领取";
        case "WAITING":
            return "未到时间";
        case "CLAIMABLE":
            return "可领取";
        case "CLAIMING":
            return "处理中";
        case "CLAIMED":
            return "已领取";
        case "OUT_OF_STOCK":
            return "库存已空";
        case "FAILED":
            return "读取失败";
        case "ENDED":
            return "活动结束";
        case "LOGIN_REQUIRED":
            return "需重新登录";
    }
};
const renderLinks = (row) => {
    if (row.externalLinks.length === 0) {
        return '<span class="muted">-</span>';
    }
    return row.externalLinks
        .map((link) => `<button class="link-button" data-external="${escapeHtml(link)}">${escapeHtml(link)}</button>`)
        .join("");
};
const render = (snapshot) => {
    if (!root) {
        return;
    }
    const showLoginConfirm = snapshot.progress.loginChecks.confirmationRequired;
    root.innerHTML = `
    <main class="shell">
      <section class="hero">
        <div>
          <p class="eyebrow">Linux.do CDK Monitor</p>
          <h1>后台监控、人工确认登录、自动回读</h1>
          <p class="subtitle">启动前先检查两个站点登录状态，扫描链路会持续展示当前进展，并在你外部打开 CDK 后自动回读状态。</p>
        </div>
        <div class="hero-actions">
          <button class="primary-button" id="rescan">立即重扫</button>
          <button class="secondary-button" id="login">打开登录窗口</button>
          <button class="secondary-button" id="confirm-login">已确认登录</button>
          <button class="secondary-button" id="reinit-browser">重新初始化浏览器</button>
        </div>
      </section>

      <section class="status-grid">
        <article class="card">
          <span class="label">运行阶段</span>
          <strong>${escapeHtml(getPhaseLabel(snapshot.progress.phase))}</strong>
        </article>
        <article class="card">
          <span class="label">登录状态</span>
          <strong>${escapeHtml(getAuthLabel(snapshot.authState))}</strong>
        </article>
        <article class="card">
          <span class="label">浏览器会话</span>
          <strong>${snapshot.progress.browserConnected ? "已连接" : "未连接"}</strong>
        </article>
        <article class="card ${snapshot.lastError ? "card-danger" : ""}">
          <span class="label">最近错误</span>
          <strong>${escapeHtml(snapshot.lastError ?? "无")}</strong>
        </article>
      </section>

      <section class="settings-panel">
        <div class="settings-header">
          <div>
            <p class="eyebrow">运行状态</p>
            <h2>当前进展</h2>
          </div>
          ${showLoginConfirm ? '<span class="chip chip-warning">等待你确认登录</span>' : '<span class="chip chip-success">自动监控可运行</span>'}
        </div>
        <div class="debug-grid">
          <div class="fixed-fields">
            <span>状态说明：${escapeHtml(snapshot.progress.detail)}</span>
            <span>下一步时间：${escapeHtml(formatTime(snapshot.progress.nextActionAt))}</span>
          </div>
          <div class="fixed-fields">
            <span>列表命中：前 10 条里命中 ${snapshot.progress.lastCandidateCount} 个</span>
            <span>当前队列：${snapshot.progress.queueLength}</span>
          </div>
          <div class="fixed-fields">
            <span>冷却跳过：${snapshot.progress.cooldownSkippedCount}</span>
            <span>重复跳过：${snapshot.progress.duplicateSkippedCount}</span>
          </div>
          <div class="fixed-fields">
            <span>linux.do：${escapeHtml(getLoginCheckLabel(snapshot.progress.loginChecks.linuxDo))}</span>
            <span>cdk.linux.do：${escapeHtml(getLoginCheckLabel(snapshot.progress.loginChecks.cdkLinuxDo))}</span>
          </div>
        </div>
      </section>

      <section class="settings-panel">
        <div class="settings-header">
          <div>
            <p class="eyebrow">监控设置</p>
            <h2>轮询和筛选</h2>
          </div>
          <button class="secondary-button" id="save-settings">保存设置</button>
        </div>
        <div class="settings-grid">
          <label>
            <span>扫描间隔（秒）</span>
            <input id="scan-interval" type="number" min="10" step="1" value="${snapshot.config.scanIntervalSeconds}" />
          </label>
          <label>
            <span>关键字（逗号分隔）</span>
            <input id="keywords" type="text" value="${escapeHtml(formatKeywords(snapshot.config.keywords))}" />
          </label>
          <label class="checkbox-field">
            <input id="notifications" type="checkbox" ${snapshot.config.notificationsEnabled ? "checked" : ""} />
            <span>启用桌面通知</span>
          </label>
          <div class="fixed-fields">
            <span>主题读取间隔：${snapshot.config.topicReadMinGapSeconds} 秒</span>
            <span>同帖冷却：${snapshot.config.topicCooldownMinutes} 分钟</span>
            <span>自动扫描安全下限：180 秒</span>
          </div>
        </div>
      </section>

      <section class="settings-panel debug-panel ${snapshot.debug.enabled ? "debug-active" : ""}">
        <div class="settings-header">
          <div>
            <p class="eyebrow">调试模式</p>
            <h2>${snapshot.debug.enabled ? "已启用 DOM 调试增强" : "当前未启用调试增强"}</h2>
          </div>
          <div class="hero-actions">
            <button class="secondary-button" id="open-debug-dir">打开调试目录</button>
            <button class="secondary-button" id="open-debug-log">打开日志文件</button>
          </div>
        </div>
        <div class="debug-grid">
          <div class="fixed-fields">
            <span>接入方式：${snapshot.debug.browserControlMode === "edge-cdp" ? "原生 Edge CDP" : "Playwright 浏览器"}</span>
            <span>窗口模式：${snapshot.debug.headless ? "无头" : "有头"}</span>
            <span>浏览器通道：${snapshot.debug.browserChannel}</span>
            <span>Electron DevTools：${snapshot.debug.openElectronDevTools ? "开启" : "关闭"}</span>
          </div>
          <div class="fixed-fields">
            <span>HTML 快照：${snapshot.debug.persistHtmlSnapshots ? "保存" : "不保存"}</span>
            <span>详细日志：${snapshot.debug.verboseLogging ? "开启" : "关闭"}</span>
          </div>
          <div class="fixed-fields debug-paths">
            <span>调试目录：${escapeHtml(snapshot.debug.artifactsDirectory)}</span>
            <span>日志文件：${escapeHtml(snapshot.debug.logFilePath)}</span>
          </div>
        </div>
      </section>

      <section class="table-card">
        <div class="table-header">
          <div>
            <p class="eyebrow">主题结果</p>
            <h2>命中主题表</h2>
          </div>
          <p class="subtitle">排序规则：时间优先，其次待开始 CDK，再其次新帖。</p>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>发现时间</th>
                <th>帖子标题</th>
                <th>是否需要领取CDK</th>
                <th>CDK领取情况</th>
                <th>CDK开始领取时间</th>
                <th>其余外部链接</th>
                <th>是否新帖</th>
              </tr>
            </thead>
            <tbody>
              ${snapshot.rows.length > 0 ? snapshot.rows.map((row) => `
                <tr class="${row.isNew ? "row-new" : ""} ${row.status === "WAITING" ? "row-waiting" : ""}">
                  <td>${escapeHtml(formatTime(row.discoveredAt))}</td>
                  <td>
                    <button class="title-button" data-topic-id="${row.topicId}">${escapeHtml(row.title)}</button>
                    <p class="meta">#${row.topicId}</p>
                  </td>
                  <td>${row.needsCdk ? '<span class="chip chip-muted">需要</span>' : '<span class="chip chip-muted">否</span>'}</td>
                  <td>
                    <span class="chip ${getStatusClass(row.status)}">${escapeHtml(getStatusLabel(row.status))}</span>
                    ${row.cdkUrl ? `<div class="row-actions"><button class="tiny-button" data-cdk-id="${row.topicId}">打开 CDK</button><button class="tiny-button" data-retry-id="${row.topicId}">重新检测</button></div>` : '<span class="muted">-</span>'}
                    ${row.lastResultMessage ? `<p class="meta">${escapeHtml(row.lastResultMessage)}</p>` : ""}
                  </td>
                  <td class="${row.status === "WAITING" ? "future-time" : ""}">${escapeHtml(formatTime(row.startAt))}</td>
                  <td><div class="link-list">${renderLinks(row)}</div></td>
                  <td>${row.isNew ? '<span class="chip chip-new">新帖</span>' : '<span class="muted">否</span>'}</td>
                </tr>
              `).join("") : '<tr><td colspan="7" class="empty-state">暂无命中主题，程序会按配置持续轮询。</td></tr>'}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  `;
    bindEvents();
};
const bindEvents = () => {
    document.querySelector("#rescan")?.addEventListener("click", () => {
        void window.monitorApi.triggerRescan();
    });
    document.querySelector("#login")?.addEventListener("click", () => {
        void window.monitorApi.openLoginWindow();
    });
    document.querySelector("#confirm-login")?.addEventListener("click", () => {
        void window.monitorApi.confirmLogin();
    });
    document.querySelector("#reinit-browser")?.addEventListener("click", () => {
        void window.monitorApi.reinitializeBrowser();
    });
    document.querySelector("#open-debug-dir")?.addEventListener("click", () => {
        void window.monitorApi.openDebugDirectory();
    });
    document.querySelector("#open-debug-log")?.addEventListener("click", () => {
        void window.monitorApi.openDebugLog();
    });
    document.querySelector("#save-settings")?.addEventListener("click", async () => {
        const scanInterval = Number((document.querySelector("#scan-interval")?.value ?? "30").trim());
        const keywords = (document.querySelector("#keywords")?.value ?? "")
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);
        const notificationsEnabled = document.querySelector("#notifications")?.checked ?? true;
        const snapshot = await window.monitorApi.updateSettings({
            scanIntervalSeconds: scanInterval,
            keywords,
            notificationsEnabled
        });
        currentSnapshot = snapshot;
        render(currentSnapshot);
    });
    document.querySelectorAll("[data-topic-id]").forEach((element) => {
        element.addEventListener("click", () => {
            const topicId = Number(element.dataset.topicId);
            void window.monitorApi.openTopic(topicId);
        });
    });
    document.querySelectorAll("[data-cdk-id]").forEach((element) => {
        element.addEventListener("click", () => {
            const topicId = Number(element.dataset.cdkId);
            void window.monitorApi.openCdk(topicId);
        });
    });
    document.querySelectorAll("[data-retry-id]").forEach((element) => {
        element.addEventListener("click", () => {
            const topicId = Number(element.dataset.retryId);
            void window.monitorApi.retryClaim(topicId);
        });
    });
    document.querySelectorAll("[data-external]").forEach((element) => {
        element.addEventListener("click", () => {
            const url = element.dataset.external;
            if (url) {
                void window.monitorApi.openExternal(url);
            }
        });
    });
};
const bootstrap = async () => {
    const snapshot = (await window.monitorApi.getSnapshot());
    currentSnapshot = snapshot;
    render(snapshot);
    window.monitorApi.onSnapshot((nextSnapshot) => {
        currentSnapshot = nextSnapshot;
        render(nextSnapshot);
    });
};
void bootstrap();
//# sourceMappingURL=main.js.map