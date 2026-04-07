"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SqliteRepository = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const node_sqlite_1 = require("node:sqlite");
const DEFAULT_CDK = {
    cdkUrl: null,
    startAt: null,
    endAt: null,
    status: "NO_CDK",
    lastAttemptAt: null,
    lastResultMessage: null,
    lastReadSource: null,
    lastReadSummary: null,
    lastReadLooksLikeHydration: false,
    lastDecisionBasis: null
};
class SqliteRepository {
    dbPath;
    db;
    constructor(dbPath) {
        this.dbPath = dbPath;
        node_fs_1.default.mkdirSync(node_path_1.default.dirname(dbPath), { recursive: true });
        this.db = new node_sqlite_1.DatabaseSync(dbPath);
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
        last_read_source TEXT,
        last_read_summary TEXT,
        last_read_looks_like_hydration INTEGER NOT NULL DEFAULT 0,
        last_decision_basis TEXT,
        FOREIGN KEY(topic_id) REFERENCES topics(topic_id) ON DELETE CASCADE
      );
    `);
        this.tryAddColumn(`ALTER TABLE cdks ADD COLUMN last_read_source TEXT`);
        this.tryAddColumn(`ALTER TABLE cdks ADD COLUMN last_read_summary TEXT`);
        this.tryAddColumn(`ALTER TABLE cdks ADD COLUMN last_read_looks_like_hydration INTEGER NOT NULL DEFAULT 0`);
        this.tryAddColumn(`ALTER TABLE cdks ADD COLUMN last_decision_basis TEXT`);
    }
    tryAddColumn(sql) {
        try {
            this.db.exec(sql);
        }
        catch {
            // Column already exists for existing local databases.
        }
    }
    upsertTopic(record) {
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
        statement.run(record.topicId, record.title, record.topicUrl, record.normalizedTopicUrl, record.publishedAt, record.discoveredAt, record.lastDeepReadAt, record.matchReason, record.isNew ? 1 : 0, JSON.stringify(record.externalLinks));
    }
    upsertCdk(record) {
        const statement = this.db.prepare(`
      INSERT INTO cdks (
        topic_id,
        cdk_url,
        start_at,
        end_at,
        status,
        last_attempt_at,
        last_result_message,
        last_read_source,
        last_read_summary,
        last_read_looks_like_hydration,
        last_decision_basis
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(topic_id) DO UPDATE SET
        cdk_url = excluded.cdk_url,
        start_at = excluded.start_at,
        end_at = excluded.end_at,
        status = excluded.status,
        last_attempt_at = excluded.last_attempt_at,
        last_result_message = excluded.last_result_message,
        last_read_source = excluded.last_read_source,
        last_read_summary = excluded.last_read_summary,
        last_read_looks_like_hydration = excluded.last_read_looks_like_hydration,
        last_decision_basis = excluded.last_decision_basis
    `);
        statement.run(record.topicId, record.cdkUrl, record.startAt, record.endAt, record.status, record.lastAttemptAt, record.lastResultMessage, record.lastReadSource, record.lastReadSummary, record.lastReadLooksLikeHydration ? 1 : 0, record.lastDecisionBasis);
    }
    getTopic(topicId) {
        const row = this.db.prepare(`SELECT * FROM topics WHERE topic_id = ?`).get(topicId);
        return row ? mapTopicRow(row) : null;
    }
    getCdk(topicId) {
        const row = this.db.prepare(`SELECT * FROM cdks WHERE topic_id = ?`).get(topicId);
        return row ? mapCdkRow(row) : null;
    }
    listRows() {
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
        c.last_result_message,
        c.last_read_source,
        c.last_read_summary,
        c.last_read_looks_like_hydration,
        c.last_decision_basis
      FROM topics t
      LEFT JOIN cdks c ON c.topic_id = t.topic_id
      ORDER BY t.discovered_at DESC, t.topic_id DESC
    `).all();
        return rows.map((row) => ({
            ...mapTopicRow(row),
            ...mapCdkRow(row),
            needsCdk: Boolean(row.cdk_url)
        }));
    }
    close() {
        this.db.close();
    }
}
exports.SqliteRepository = SqliteRepository;
const mapTopicRow = (row) => ({
    topicId: row.topic_id,
    title: row.title,
    topicUrl: row.topic_url,
    normalizedTopicUrl: row.normalized_topic_url,
    publishedAt: row.published_at,
    discoveredAt: row.discovered_at,
    lastDeepReadAt: row.last_deep_read_at,
    matchReason: row.match_reason,
    isNew: Boolean(row.is_new),
    externalLinks: JSON.parse(row.external_links)
});
const mapCdkRow = (row) => ({
    topicId: row.topic_id ?? 0,
    cdkUrl: row.cdk_url ?? DEFAULT_CDK.cdkUrl,
    startAt: row.start_at ?? DEFAULT_CDK.startAt,
    endAt: row.end_at ?? DEFAULT_CDK.endAt,
    status: row.status ?? DEFAULT_CDK.status,
    lastAttemptAt: row.last_attempt_at ?? DEFAULT_CDK.lastAttemptAt,
    lastResultMessage: row.last_result_message ?? DEFAULT_CDK.lastResultMessage,
    lastReadSource: row.last_read_source ?? DEFAULT_CDK.lastReadSource,
    lastReadSummary: row.last_read_summary ?? DEFAULT_CDK.lastReadSummary,
    lastReadLooksLikeHydration: Boolean(row.last_read_looks_like_hydration ?? DEFAULT_CDK.lastReadLooksLikeHydration),
    lastDecisionBasis: row.last_decision_basis ?? DEFAULT_CDK.lastDecisionBasis
});
//# sourceMappingURL=repository.js.map