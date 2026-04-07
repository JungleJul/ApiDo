import type { CdkStatus, CdkWindow } from "../shared/types";

const RANGE_PATTERN =
  /(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})\s*-\s*(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/;

const toShanghaiDate = (
  year: string,
  month: string,
  day: string,
  hour: string,
  minute: string,
  second: string
): Date => {
  const utcMillis = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour) - 8,
    Number(minute),
    Number(second)
  );

  return new Date(utcMillis);
};

export const parseCdkWindow = (input: string): CdkWindow | null => {
  const match = input.match(RANGE_PATTERN);

  if (!match) {
    return null;
  }

  const startAt = toShanghaiDate(match[1], match[2], match[3], match[4], match[5], match[6]);
  const endAt = toShanghaiDate(match[7], match[8], match[9], match[10], match[11], match[12]);

  return {
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString()
  };
};

export const classifyCdkWindow = (window: CdkWindow, now: Date): CdkStatus => {
  const startAt = new Date(window.startAt);
  const endAt = new Date(window.endAt);

  if (now < startAt) {
    return "WAITING";
  }

  if (now > endAt) {
    return "ENDED";
  }

  return "CLAIMABLE";
};
