export const MIN_SAFE_SCAN_INTERVAL_SECONDS = 180;

export interface CloudflareBackoffState {
  consecutiveCloudflareCount: number;
  pauseUntil: string;
}

export const getEffectiveScanIntervalSeconds = (requestedSeconds: number): number =>
  Math.max(MIN_SAFE_SCAN_INTERVAL_SECONDS, requestedSeconds);

export const createCloudflareBackoffState = (
  previousCount: number,
  now: Date
): CloudflareBackoffState => {
  const consecutiveCloudflareCount = previousCount + 1;
  const pauseMinutes = consecutiveCloudflareCount === 1 ? 15 : 30;

  return {
    consecutiveCloudflareCount,
    pauseUntil: new Date(now.getTime() + pauseMinutes * 60 * 1000).toISOString()
  };
};

export const shouldSkipLatestScan = (pauseUntil: string | null, now: Date): boolean => {
  if (!pauseUntil) {
    return false;
  }

  return now.getTime() < new Date(pauseUntil).getTime();
};
