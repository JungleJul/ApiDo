import type { CdkStatus } from "../shared/types";

export interface CdkPageAnalysis {
  normalizedText: string;
  remainingQuota: number | null;
  totalQuota: number | null;
  status: CdkStatus | "FAILED";
  message: string;
}

const decodeHtmlEntities = (input: string): string =>
  input
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");

const stripHtmlNoise = (input: string): string =>
  input
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ")
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, " ")
    .replace(/<[^>]+>/g, " ");

const normalizeText = (input: string): string => {
  const decoded = decodeHtmlEntities(input);
  const plainText = decoded.includes("<") && decoded.includes(">") ? stripHtmlNoise(decoded) : decoded;
  return plainText.replace(/\s+/g, " ").trim();
};

const extractNumber = (pattern: RegExp, input: string): number | null => {
  const match = input.match(pattern);
  if (!match) {
    return null;
  }

  return Number.parseInt(match[1], 10);
};

const interstitialSpaces = (text: string): string => text.split("").join("\\s*");

const outOfStockPattern = new RegExp(
  ["库存已空", "已领完", "已抢空", "抢空", "发完了"].map(interstitialSpaces).join("|"),
  "i"
);

const endedPattern = new RegExp(
  ["项目已结束", "活动已结束", "领取已结束", "结束领取", "已截止"].map(interstitialSpaces).join("|"),
  "i"
);

const claimedPattern = new RegExp(["已领取", "领取成功", "已成功领取"].map(interstitialSpaces).join("|"), "i");

const claimButtonPattern = new RegExp(["立即领取", "去领取", "马上领取"].map(interstitialSpaces).join("|"), "i");

export const analyzeCdkPageText = (input: string): CdkPageAnalysis => {
  const normalizedText = normalizeText(input);
  const totalQuota = extractNumber(/共\s*(\d+)\s*个/, normalizedText);
  const explicitRemaining = extractNumber(/剩\s*余\s*名\s*额\s*(\d+)/, normalizedText);
  const hasOutOfStockText = outOfStockPattern.test(normalizedText);
  const remainingQuota = explicitRemaining ?? (hasOutOfStockText ? 0 : null);
  const hasEndedText = endedPattern.test(normalizedText);
  const hasClaimedText = claimedPattern.test(normalizedText);
  const hasClaimButton = claimButtonPattern.test(normalizedText);

  if (hasEndedText) {
    return {
      normalizedText,
      remainingQuota,
      totalQuota,
      status: "ENDED",
      message: "活动已结束"
    };
  }

  if (hasClaimedText) {
    return {
      normalizedText,
      remainingQuota,
      totalQuota,
      status: "CLAIMED",
      message: "已领取"
    };
  }

  if (hasOutOfStockText || remainingQuota === 0) {
    return {
      normalizedText,
      remainingQuota: 0,
      totalQuota,
      status: "OUT_OF_STOCK",
      message: totalQuota === null ? "库存已空" : `库存已空（0/${totalQuota}）`
    };
  }

  if (hasClaimButton || (remainingQuota !== null && remainingQuota > 0)) {
    const quotaMessage =
      remainingQuota !== null
        ? totalQuota !== null
          ? `可手动领取，剩余 ${remainingQuota}/${totalQuota}`
          : `可手动领取，剩余 ${remainingQuota}`
        : "可手动领取";

    return {
      normalizedText,
      remainingQuota,
      totalQuota,
      status: "CLAIMABLE",
      message: quotaMessage
    };
  }

  return {
    normalizedText,
    remainingQuota,
    totalQuota,
    status: "FAILED",
    message: "未识别到可领取状态"
  };
};
