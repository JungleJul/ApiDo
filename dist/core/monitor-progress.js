"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isBrowserSessionUsable = exports.describeScanOutcome = exports.describeLoginGate = void 0;
const describeLoginGate = (state) => {
    const fullyLoggedIn = state.linuxDo === "LOGGED_IN" && state.cdkLinuxDo === "LOGGED_IN";
    if (!fullyLoggedIn || (state.confirmationRequired && !state.confirmedByUser)) {
        return {
            phase: "WAITING_LOGIN_CONFIRMATION",
            requiresConfirmation: true,
            detail: "请先在浏览器中确认 linux.do 和 cdk.linux.do 都已登录，然后点击已确认登录。"
        };
    }
    return {
        phase: "READY",
        requiresConfirmation: false,
        detail: "登录状态已确认，程序可以开始扫描。"
    };
};
exports.describeLoginGate = describeLoginGate;
const describeScanOutcome = (input) => {
    if (input.candidateCount === 0) {
        return {
            phase: "IDLE",
            detail: `前 ${input.listItemCount} 条主题里没有命中关键字或固定标签。`
        };
    }
    if (input.enqueuedCount === 0 && input.cooldownSkippedCount === input.candidateCount) {
        return {
            phase: "COOLDOWN",
            detail: `命中的 ${input.candidateCount} 个主题都在 30 分钟冷却中，本轮无需重复读取。`
        };
    }
    if (input.enqueuedCount === 0 && input.duplicateSkippedCount > 0) {
        return {
            phase: "QUEUEING",
            detail: "命中的主题已经在队列中等待处理，本轮没有新增读取任务。"
        };
    }
    return {
        phase: "QUEUEING",
        detail: `本轮命中 ${input.candidateCount} 个主题，已加入 ${input.enqueuedCount} 个读取任务。`
    };
};
exports.describeScanOutcome = describeScanOutcome;
const isBrowserSessionUsable = (input) => {
    if (!input.hasContext) {
        return false;
    }
    if (input.browserControlMode === "playwright") {
        return true;
    }
    return input.hasBrowserConnection && input.browserConnectionConnected && input.edgeProcessAlive;
};
exports.isBrowserSessionUsable = isBrowserSessionUsable;
//# sourceMappingURL=monitor-progress.js.map