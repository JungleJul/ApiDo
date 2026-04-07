"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getClaimableManualMessage = exports.getManualClaimAlertPlan = void 0;
const PRE_ALERT_MINUTES = 3;
const PRE_ALERT_TEXT = "活动将在 3 分钟后开始，请准备手动完成二次校验。";
const SOON_TEXT = "活动即将开始，请准备手动完成二次校验。";
const CLAIMABLE_TEXT = "CDK 现在可以手动领取，领取时会弹出二次校验。";
const getManualClaimAlertPlan = (window, now) => {
    const startAtMs = new Date(window.startAt).getTime();
    const endAtMs = new Date(window.endAt).getTime();
    const nowMs = now.getTime();
    if (nowMs > endAtMs) {
        return {
            status: "ENDED",
            notifyAt: null,
            shouldNotifyImmediately: false,
            message: "活动已结束。"
        };
    }
    if (nowMs >= startAtMs) {
        return {
            status: "CLAIMABLE",
            notifyAt: null,
            shouldNotifyImmediately: true,
            message: CLAIMABLE_TEXT
        };
    }
    const preAlertAtMs = startAtMs - PRE_ALERT_MINUTES * 60 * 1000;
    const withinPreAlertWindow = nowMs >= preAlertAtMs;
    return {
        status: "WAITING",
        notifyAt: withinPreAlertWindow ? window.startAt : new Date(preAlertAtMs).toISOString(),
        shouldNotifyImmediately: withinPreAlertWindow,
        message: withinPreAlertWindow ? SOON_TEXT : PRE_ALERT_TEXT
    };
};
exports.getManualClaimAlertPlan = getManualClaimAlertPlan;
const getClaimableManualMessage = () => CLAIMABLE_TEXT;
exports.getClaimableManualMessage = getClaimableManualMessage;
//# sourceMappingURL=cdk-alerts.js.map