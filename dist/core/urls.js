"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectLinks = exports.extractTopicId = exports.normalizeTopicUrl = void 0;
const TOPIC_URL_PATTERN = /^https?:\/\/linux\.do\/t\/topic\/(\d+)(?:\/\d+)?(?:[/?#].*)?$/i;
const normalizeTopicUrl = (url) => {
    const match = url.match(TOPIC_URL_PATTERN);
    if (!match) {
        return url;
    }
    return `https://linux.do/t/topic/${match[1]}`;
};
exports.normalizeTopicUrl = normalizeTopicUrl;
const extractTopicId = (url) => {
    const normalized = (0, exports.normalizeTopicUrl)(url);
    const match = normalized.match(/\/t\/topic\/(\d+)$/);
    return match ? Number(match[1]) : null;
};
exports.extractTopicId = extractTopicId;
const collectLinks = (urls) => {
    const cdkLinks = new Set();
    const externalLinks = new Set();
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
        }
        catch {
            continue;
        }
    }
    return {
        cdkLinks: [...cdkLinks],
        externalLinks: [...externalLinks]
    };
};
exports.collectLinks = collectLinks;
//# sourceMappingURL=urls.js.map