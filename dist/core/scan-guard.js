"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shouldSkipLatestScan = exports.createCloudflareBackoffState = exports.getEffectiveScanIntervalSeconds = exports.MIN_SAFE_SCAN_INTERVAL_SECONDS = void 0;
exports.MIN_SAFE_SCAN_INTERVAL_SECONDS = 180;
const getEffectiveScanIntervalSeconds = (requestedSeconds) => Math.max(exports.MIN_SAFE_SCAN_INTERVAL_SECONDS, requestedSeconds);
exports.getEffectiveScanIntervalSeconds = getEffectiveScanIntervalSeconds;
const createCloudflareBackoffState = (previousCount, now) => {
    const consecutiveCloudflareCount = previousCount + 1;
    const pauseMinutes = consecutiveCloudflareCount === 1 ? 15 : 30;
    return {
        consecutiveCloudflareCount,
        pauseUntil: new Date(now.getTime() + pauseMinutes * 60 * 1000).toISOString()
    };
};
exports.createCloudflareBackoffState = createCloudflareBackoffState;
const shouldSkipLatestScan = (pauseUntil, now) => {
    if (!pauseUntil) {
        return false;
    }
    return now.getTime() < new Date(pauseUntil).getTime();
};
exports.shouldSkipLatestScan = shouldSkipLatestScan;
//# sourceMappingURL=scan-guard.js.map