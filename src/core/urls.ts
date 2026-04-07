const TOPIC_URL_PATTERN = /^https?:\/\/linux\.do\/t\/topic\/(\d+)(?:\/\d+)?(?:[/?#].*)?$/i;

export const normalizeTopicUrl = (url: string): string => {
  const match = url.match(TOPIC_URL_PATTERN);

  if (!match) {
    return url;
  }

  return `https://linux.do/t/topic/${match[1]}`;
};

export const extractTopicId = (url: string): number | null => {
  const normalized = normalizeTopicUrl(url);
  const match = normalized.match(/\/t\/topic\/(\d+)$/);

  return match ? Number(match[1]) : null;
};

export const collectLinks = (urls: string[]): { cdkLinks: string[]; externalLinks: string[] } => {
  const cdkLinks = new Set<string>();
  const externalLinks = new Set<string>();

  for (const rawUrl of urls) {
    try {
      const parsed = new URL(rawUrl);
      const normalized = parsed.toString();

      if (parsed.hostname === "cdk.linux.do") {
        cdkLinks.add(normalized);
        continue;
      }

      if (parsed.hostname === "linux.do" || parsed.hostname.endsWith(".linux.do")) {
        continue;
      }

      externalLinks.add(normalized);
    } catch {
      continue;
    }
  }

  return {
    cdkLinks: [...cdkLinks],
    externalLinks: [...externalLinks]
  };
};
