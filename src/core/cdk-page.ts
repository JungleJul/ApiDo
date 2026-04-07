import type { CdkStatus } from "../shared/types";

export interface CdkPageAnalysis {
  normalizedText: string;
  remainingQuota: number | null;
  totalQuota: number | null;
  status: CdkStatus | "FAILED";
  message: string;
}

const normalizeText = (input: string): string => input.replace(/\s+/g, " ").trim();

const extractNumber = (pattern: RegExp, input: string): number | null => {
  const match = input.match(pattern);
  if (!match) {
    return null;
  }

  return Number.parseInt(match[1], 10);
};

export const analyzeCdkPageText = (input: string): CdkPageAnalysis => {
  const normalizedText = normalizeText(input);
  const totalQuota = extractNumber(/共\s*(\d+)\s*个/, normalizedText);
  const explicitRemaining = extractNumber(/剩余名额\s*(\d+)/, normalizedText);
  const hasOutOfStockText = /库存已空|已领完|已抢空|抢空|发完了/.test(normalizedText);
  const remainingQuota = explicitRemaining ?? (hasOutOfStockText ? 0 : null);
  const hasEndedText = /项目已结束|活动已结束|领取已结束|结束领取|已截止/.test(normalizedText);
  const hasClaimedText = /已领取|领取成功|已成功领取/.test(normalizedText);
  const hasClaimButton = /立即领取|去领取|马上领取/.test(normalizedText);

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
