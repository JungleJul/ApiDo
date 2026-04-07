import { FIXED_TAG, type CandidateTopic } from "../shared/types";
import { extractTopicId, normalizeTopicUrl } from "./urls";

interface TopicListItem {
  title: string;
  topicUrl: string;
  tags: string[];
}

export const selectCandidateTopics = (topics: TopicListItem[], keywords: string[]): CandidateTopic[] => {
  const normalizedKeywords = keywords.map((keyword) => keyword.trim()).filter(Boolean);
  const candidates: CandidateTopic[] = [];

  for (const topic of topics.slice(0, 10)) {
    const topicId = extractTopicId(topic.topicUrl);

    if (!topicId) {
      continue;
    }

    const keywordMatched = normalizedKeywords.some((keyword) => topic.title.includes(keyword));
    const fixedTagMatched = topic.tags.includes(FIXED_TAG);

    if (!keywordMatched && !fixedTagMatched) {
      continue;
    }

    candidates.push({
      topicId,
      title: topic.title,
      topicUrl: topic.topicUrl,
      normalizedTopicUrl: normalizeTopicUrl(topic.topicUrl),
      tags: topic.tags,
      matchReason: keywordMatched ? "KEYWORD" : "FIXED_TAG"
    });
  }

  return candidates;
};
