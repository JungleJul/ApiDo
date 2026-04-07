import { describe, expect, test } from "vitest";

import { sortTopicRows } from "../src/core/topic-row-sort";
import type { TopicRow } from "../src/shared/types";

const createRow = (partial: Partial<TopicRow>): TopicRow => ({
  topicId: 0,
  title: "",
  topicUrl: "",
  normalizedTopicUrl: "",
  publishedAt: null,
  discoveredAt: "2026-04-07T10:00:00.000Z",
  lastDeepReadAt: null,
  matchReason: "KEYWORD",
  isNew: false,
  externalLinks: [],
  cdkUrl: null,
  startAt: null,
  endAt: null,
  status: "NO_CDK",
  lastAttemptAt: null,
  lastResultMessage: null,
  needsCdk: false,
  ...partial
});

describe("sortTopicRows", () => {
  test("prioritizes waiting cdk start time, then new topics, then topic id", () => {
    const rows = [
      createRow({
        topicId: 1001,
        discoveredAt: "2026-04-07T12:00:00.000Z",
        status: "NO_CDK",
        isNew: false
      }),
      createRow({
        topicId: 1002,
        discoveredAt: "2026-04-07T09:00:00.000Z",
        startAt: "2026-04-07T13:00:00.000Z",
        status: "WAITING",
        needsCdk: true,
        isNew: false
      }),
      createRow({
        topicId: 1003,
        discoveredAt: "2026-04-07T12:00:00.000Z",
        status: "NO_CDK",
        isNew: true
      })
    ];

    expect(sortTopicRows(rows).map((row) => row.topicId)).toEqual([1002, 1003, 1001]);
  });
});
