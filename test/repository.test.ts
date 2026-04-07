import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { SqliteRepository } from "../src/core/repository";
import type { CdkRecord, TopicRecord } from "../src/shared/types";

const tempDirs: string[] = [];
const repositories: SqliteRepository[] = [];

const createRepository = (): SqliteRepository => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "linuxdo-cdk-monitor-"));
  tempDirs.push(dir);
  const repository = new SqliteRepository(path.join(dir, "app.db"));
  repositories.push(repository);
  return repository;
};

const createTopic = (partial: Partial<TopicRecord>): TopicRecord => ({
  topicId: 1,
  title: "公益节点更新",
  topicUrl: "https://linux.do/t/topic/1",
  normalizedTopicUrl: "https://linux.do/t/topic/1",
  publishedAt: "2026-04-07T10:00:00.000Z",
  discoveredAt: "2026-04-07T10:05:00.000Z",
  lastDeepReadAt: "2026-04-07T10:05:00.000Z",
  matchReason: "KEYWORD",
  isNew: true,
  externalLinks: ["https://example.com"],
  ...partial
});

const createCdk = (partial: Partial<CdkRecord>): CdkRecord => ({
  topicId: 1,
  cdkUrl: "https://cdk.linux.do/activity/1",
  startAt: "2026-04-07T11:00:00.000Z",
  endAt: "2026-04-07T12:00:00.000Z",
  status: "WAITING",
  lastAttemptAt: null,
  lastResultMessage: null,
  lastReadSource: null,
  lastReadSummary: null,
  lastReadLooksLikeHydration: false,
  lastDecisionBasis: null,
  ...partial
});

afterEach(() => {
  while (repositories.length) {
    repositories.pop()?.close();
  }

  while (tempDirs.length) {
    const dir = tempDirs.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("SqliteRepository", () => {
  test("upserts a topic and cdk record into a single row snapshot", () => {
    const repository = createRepository();

    repository.upsertTopic(createTopic({ topicId: 10 }));
    repository.upsertCdk(createCdk({ topicId: 10 }));

    expect(repository.listRows()).toEqual([
      expect.objectContaining({
        topicId: 10,
        title: "公益节点更新",
        cdkUrl: "https://cdk.linux.do/activity/1",
        status: "WAITING",
        externalLinks: ["https://example.com"],
        needsCdk: true
      })
    ]);
  });

  test("updates existing topic row instead of creating duplicates", () => {
    const repository = createRepository();

    repository.upsertTopic(createTopic({ topicId: 11, title: "旧标题" }));
    repository.upsertTopic(createTopic({ topicId: 11, title: "新标题", externalLinks: ["https://foo.bar"] }));

    const rows = repository.listRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        topicId: 11,
        title: "新标题",
        externalLinks: ["https://foo.bar"]
      })
    );
  });
});
