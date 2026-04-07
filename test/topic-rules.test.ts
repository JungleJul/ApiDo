import { describe, expect, test } from "vitest";

import { selectCandidateTopics } from "../src/core/topic-rules";

describe("selectCandidateTopics", () => {
  test("only inspects the first ten topics and keeps list order", () => {
    const topics = Array.from({ length: 12 }, (_, index) => ({
      title: index === 10 ? "公益资源" : `帖子 ${index}`,
      topicUrl: `https://linux.do/t/topic/${1000 + index}`,
      tags: []
    }));

    expect(selectCandidateTopics(topics, ["公益"]).map((topic) => topic.topicId)).toEqual([]);
  });

  test("matches keyword titles and fixed tag topics", () => {
    const topics = [
      {
        title: "公益节点更新",
        topicUrl: "https://linux.do/t/topic/1001/5",
        tags: ["讨论"]
      },
      {
        title: "普通帖子",
        topicUrl: "https://linux.do/t/topic/1002",
        tags: ["福利羊毛"]
      },
      {
        title: "普通帖子2",
        topicUrl: "https://linux.do/t/topic/1003",
        tags: ["灌水"]
      }
    ];

    expect(selectCandidateTopics(topics, ["公益", "小站"])).toEqual([
      {
        topicId: 1001,
        title: "公益节点更新",
        topicUrl: "https://linux.do/t/topic/1001/5",
        normalizedTopicUrl: "https://linux.do/t/topic/1001",
        tags: ["讨论"],
        matchReason: "KEYWORD"
      },
      {
        topicId: 1002,
        title: "普通帖子",
        topicUrl: "https://linux.do/t/topic/1002",
        normalizedTopicUrl: "https://linux.do/t/topic/1002",
        tags: ["福利羊毛"],
        matchReason: "FIXED_TAG"
      }
    ]);
  });
});
