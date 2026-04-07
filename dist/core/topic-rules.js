"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.selectCandidateTopics = void 0;
const types_1 = require("../shared/types");
const urls_1 = require("./urls");
const selectCandidateTopics = (topics, keywords) => {
    const normalizedKeywords = keywords.map((keyword) => keyword.trim()).filter(Boolean);
    const candidates = [];
    for (const topic of topics.slice(0, 10)) {
        const topicId = (0, urls_1.extractTopicId)(topic.topicUrl);
        if (!topicId) {
            continue;
        }
        const keywordMatched = normalizedKeywords.some((keyword) => topic.title.includes(keyword));
        const fixedTagMatched = topic.tags.includes(types_1.FIXED_TAG);
        if (!keywordMatched && !fixedTagMatched) {
            continue;
        }
        candidates.push({
            topicId,
            title: topic.title,
            topicUrl: topic.topicUrl,
            normalizedTopicUrl: (0, urls_1.normalizeTopicUrl)(topic.topicUrl),
            tags: topic.tags,
            matchReason: keywordMatched ? "KEYWORD" : "FIXED_TAG"
        });
    }
    return candidates;
};
exports.selectCandidateTopics = selectCandidateTopics;
//# sourceMappingURL=topic-rules.js.map