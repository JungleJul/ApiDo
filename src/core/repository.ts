import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import type { CdkRecord, TopicRecord, TopicRow } from "../shared/types";

const DEFAULT_CDK: Omit<CdkRecord, "topicId"> = {
  cdkUrl: null,
  startAt: null,
  endAt: null,
  status: "NO_CDK",
  lastAttemptAt: null,
  lastResultMessage: null
};

export class SqliteRepository {
  private readonly db: DatabaseSync;

  constructor(private readonly dbPath: string) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS topics (
        topic_id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        topic_url TEXT NOT NULL,
        normalized_topic_url TEXT NOT NULL,
        published_at TEXT,
        discovered_at TEXT NOT NULL,
        last_deep_read_at TEXT,
        match_reason TEXT NOT NULL,
        is_new INTEGER NOT NULL,
        external_links TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS cdks (
        topic_id INTEGER PRIMARY KEY,
        cdk_url TEXT,
        start_at TEXT,
        end_at TEXT,
        status TEXT NOT NULL,
        last_attempt_at TEXT,
        last_result_message TEXT,
        FOREIGN KEY(topic_id) REFERENCES topics(topic_id) ON DELETE CASCADE
      );
    `);
  }

  upsertTopic(record: TopicRecord): void {
    const statement = this.db.prepare(`
      INSERT INTO topics (
        topic_id,
        title,
        topic_url,
        normalized_topic_url,
        published_at,
        discovered_at,
        last_deep_read_at,
        match_reason,
        is_new,
        external_links
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(topic_id) DO UPDATE SET
        title = excluded.title,
        topic_url = excluded.topic_url,
        normalized_topic_url = excluded.normalized_topic_url,
        published_at = excluded.published_at,
        discovered_at = excluded.discovered_at,
        last_deep_read_at = excluded.last_deep_read_at,
        match_reason = excluded.match_reason,
        is_new = excluded.is_new,
        external_links = excluded.external_links
    `);

    statement.run(
      record.topicId,
      record.title,
      record.topicUrl,
      record.normalizedTopicUrl,
      record.publishedAt,
      record.discoveredAt,
      record.lastDeepReadAt,
      record.matchReason,
      record.isNew ? 1 : 0,
      JSON.stringify(record.externalLinks)
    );
  }

  upsertCdk(record: CdkRecord): void {
    const statement = this.db.prepare(`
      INSERT INTO cdks (
        topic_id,
        cdk_url,
        start_at,
        end_at,
        status,
        last_attempt_at,
        last_result_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(topic_id) DO UPDATE SET
        cdk_url = excluded.cdk_url,
        start_at = excluded.start_at,
        end_at = excluded.end_at,
        status = excluded.status,
        last_attempt_at = excluded.last_attempt_at,
        last_result_message = excluded.last_result_message
    `);

    statement.run(
      record.topicId,
      record.cdkUrl,
      record.startAt,
      record.endAt,
      record.status,
      record.lastAttemptAt,
      record.lastResultMessage
    );
  }

  getTopic(topicId: number): TopicRecord | null {
    const row = this.db.prepare(`SELECT * FROM topics WHERE topic_id = ?`).get(topicId) as TopicDbRow | undefined;
    return row ? mapTopicRow(row) : null;
  }

  getCdk(topicId: number): CdkRecord | null {
    const row = this.db.prepare(`SELECT * FROM cdks WHERE topic_id = ?`).get(topicId) as CdkDbRow | undefined;
    return row ? mapCdkRow(row) : null;
  }

  listRows(): TopicRow[] {
    const rows = this.db.prepare(`
      SELECT
        t.topic_id,
        t.title,
        t.topic_url,
        t.normalized_topic_url,
        t.published_at,
        t.discovered_at,
        t.last_deep_read_at,
        t.match_reason,
        t.is_new,
        t.external_links,
        c.cdk_url,
        c.start_at,
        c.end_at,
        c.status,
        c.last_attempt_at,
        c.last_result_message
      FROM topics t
      LEFT JOIN cdks c ON c.topic_id = t.topic_id
      ORDER BY t.discovered_at DESC, t.topic_id DESC
    `).all() as unknown as JoinedDbRow[];

    return rows.map((row) => ({
      ...mapTopicRow(row),
      ...mapCdkRow(row),
      needsCdk: Boolean(row.cdk_url)
    }));
  }

  close(): void {
    this.db.close();
  }
}

interface TopicDbRow {
  topic_id: number;
  title: string;
  topic_url: string;
  normalized_topic_url: string;
  published_at: string | null;
  discovered_at: string;
  last_deep_read_at: string | null;
  match_reason: TopicRecord["matchReason"];
  is_new: number;
  external_links: string;
}

interface CdkDbRow {
  topic_id: number;
  cdk_url: string | null;
  start_at: string | null;
  end_at: string | null;
  status: CdkRecord["status"] | null;
  last_attempt_at: string | null;
  last_result_message: string | null;
}

type JoinedDbRow = TopicDbRow & CdkDbRow;

const mapTopicRow = (row: TopicDbRow): TopicRecord => ({
  topicId: row.topic_id,
  title: row.title,
  topicUrl: row.topic_url,
  normalizedTopicUrl: row.normalized_topic_url,
  publishedAt: row.published_at,
  discoveredAt: row.discovered_at,
  lastDeepReadAt: row.last_deep_read_at,
  matchReason: row.match_reason,
  isNew: Boolean(row.is_new),
  externalLinks: JSON.parse(row.external_links) as string[]
});

const mapCdkRow = (row: Partial<CdkDbRow>): CdkRecord => ({
  topicId: row.topic_id ?? 0,
  cdkUrl: row.cdk_url ?? DEFAULT_CDK.cdkUrl,
  startAt: row.start_at ?? DEFAULT_CDK.startAt,
  endAt: row.end_at ?? DEFAULT_CDK.endAt,
  status: row.status ?? DEFAULT_CDK.status,
  lastAttemptAt: row.last_attempt_at ?? DEFAULT_CDK.lastAttemptAt,
  lastResultMessage: row.last_result_message ?? DEFAULT_CDK.lastResultMessage
});
