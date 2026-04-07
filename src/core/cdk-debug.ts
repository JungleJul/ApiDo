export interface CdkTextCandidate {
  source: string;
  text: string;
}

export interface CdkTextInspectionResult {
  source: string;
  text: string;
  summary: string;
  looksLikeHydration: boolean;
  retryAttempts: number;
}

export interface CdkDecisionBasisInput {
  looksLikeHydration: boolean;
  usedWindowParsing: boolean;
  retryAttempts: number;
  finalStatus: string;
}

const normalizeWhitespace = (input: string): string => input.replace(/\s+/g, " ").trim();

const createSummary = (input: string): string => {
  const normalized = normalizeWhitespace(input);
  return normalized.slice(0, 240);
};

const scoreCandidate = (text: string): number => {
  const normalized = normalizeWhitespace(text);
  if (!normalized) {
    return -100;
  }

  let score = 0;

  if (/剩\s*余\s*名\s*额|共\s*\d+\s*个|立即\s*领\s*取|库存\s*已\s*空|已\s*领\s*取|项\s*目\s*已\s*结\s*束/.test(normalized)) {
    score += 20;
  }

  if (/\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2}\s*-\s*\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2}/.test(normalized)) {
    score += 10;
  }

  if (/self\.__next_f|webpackChunk|static\/chunks|function\(|__next/i.test(normalized)) {
    score -= 25;
  }

  return score;
};

const adjustScoreBySource = (source: string, text: string, score: number): number => {
  const normalized = normalizeWhitespace(text);

  if (source === "title") {
    score -= 8;
    if (/^LINUX DO CDK$/i.test(normalized)) {
      score -= 20;
    }
  }

  return score;
};

export const inspectCdkTextCandidates = (candidates: CdkTextCandidate[]): CdkTextInspectionResult => {
  const normalizedCandidates = candidates.map((candidate) => ({
    ...candidate,
    text: normalizeWhitespace(candidate.text)
  }));

  const bestCandidate =
    normalizedCandidates.reduce<{ source: string; text: string; score: number } | null>((best, candidate) => {
      const score = adjustScoreBySource(candidate.source, candidate.text, scoreCandidate(candidate.text));
      if (!best || score > best.score) {
        return {
          source: candidate.source,
          text: candidate.text,
          score
        };
      }

      return best;
    }, null) ?? {
      source: "unknown",
      text: "",
      score: -100
    };

  const looksLikeHydration = /self\.__next_f|webpackChunk|static\/chunks|function\(|__next/i.test(bestCandidate.text);

  return {
    source: bestCandidate.source,
    text: bestCandidate.text,
    summary: createSummary(bestCandidate.text),
    looksLikeHydration,
    retryAttempts: 1
  };
};

export const shouldRetryCdkTextInspection = (result: CdkTextInspectionResult): boolean => {
  if (result.looksLikeHydration) {
    return true;
  }

  return result.source === "title" && /^LINUX DO CDK$/i.test(normalizeWhitespace(result.text));
};

export const describeCdkDecisionBasis = (input: CdkDecisionBasisInput): string => {
  if (input.usedWindowParsing) {
    return input.retryAttempts > 1 ? "时间窗口判定（重试后成功）" : "时间窗口判定";
  }

  if (input.looksLikeHydration && input.finalStatus === "FAILED") {
    return input.retryAttempts > 1 ? "疑似噪声（重试后仍失败）" : "疑似噪声";
  }

  if (input.finalStatus === "FAILED") {
    return "正文识别失败";
  }

  return input.retryAttempts > 1 ? "正文识别（重试后成功）" : "正文识别";
};
