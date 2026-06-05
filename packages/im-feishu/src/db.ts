/**
 * SQLite 数据库初始化
 *
 * IM 适配器本地数据库，存储 IM 层级映射关系。
 * 表结构设计为可扩展，预留 metadata JSON 字段。
 */

import Database from 'better-sqlite3';

export interface SessionMapping {
  id: number;
  /** IM 侧 hash: hash(channel_id, thread_id) */
  im_hash: string;
  /** Agent 侧 hash: hash(project_id, session_id) */
  agent_hash: string;
  /** 频道 ID */
  channel_id: string;
  /** 线程 ID（Discord thread / 飞书话题等） */
  thread_id: string;
  /** 项目 ID */
  project_id: string;
  /** 会话 ID */
  session_id: string;
  /** 扩展元数据（JSON） */
  metadata: string;
  created_at: string;
  updated_at: string;
}

/**
 * 初始化数据库（内存模式）
 */
export function initDB(): Database.Database {
  const db = new Database(':memory:');

  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS session_mapping (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      im_hash     TEXT    NOT NULL,
      agent_hash  TEXT    NOT NULL,
      channel_id  TEXT    NOT NULL,
      thread_id   TEXT    NOT NULL DEFAULT '',
      project_id  TEXT    NOT NULL,
      session_id  TEXT    NOT NULL,
      metadata    TEXT    NOT NULL DEFAULT '{}',
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(im_hash, agent_hash)
    );

    CREATE INDEX IF NOT EXISTS idx_session_mapping_im_hash
      ON session_mapping(im_hash);
    CREATE INDEX IF NOT EXISTS idx_session_mapping_agent_hash
      ON session_mapping(agent_hash);
  `);

  console.log('[DB] SQLite initialized (in-memory)');
  return db;
}

/**
 * 查询：通过 im_hash 获取映射
 */
export function getByIMHash(db: Database.Database, imHash: string): SessionMapping | undefined {
  return db.prepare('SELECT * FROM session_mapping WHERE im_hash = ?').get(imHash) as SessionMapping | undefined;
}

/**
 * 查询：通过 agent_hash 获取映射
 */
export function getByAgentHash(db: Database.Database, agentHash: string): SessionMapping | undefined {
  return db.prepare('SELECT * FROM session_mapping WHERE agent_hash = ?').get(agentHash) as SessionMapping | undefined;
}

/**
 * 插入或更新映射
 */
export function upsertMapping(
  db: Database.Database,
  mapping: Omit<SessionMapping, 'id' | 'created_at' | 'updated_at'>
): void {
  db.prepare(`
    INSERT INTO session_mapping (im_hash, agent_hash, channel_id, thread_id, project_id, session_id, metadata)
    VALUES (@im_hash, @agent_hash, @channel_id, @thread_id, @project_id, @session_id, @metadata)
    ON CONFLICT(im_hash, agent_hash) DO UPDATE SET
      channel_id = excluded.channel_id,
      thread_id  = excluded.thread_id,
      project_id = excluded.project_id,
      session_id = excluded.session_id,
      metadata   = excluded.metadata,
      updated_at = datetime('now')
  `).run(mapping);
}
