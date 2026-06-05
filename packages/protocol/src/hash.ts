/**
 * Hash 工具 — 生成 agent hash 和 IM hash
 *
 * 映射关系用 hash 做键：
 *   agent hash = hash(project_id, session_id)
 *   IM hash    = hash(channel_id, thread_id)
 */

import { createHash } from 'node:crypto';

/**
 * 生成 agent 侧 hash
 * @param projectId 项目 ID
 * @param sessionId 会话 ID
 */
export function agentHash(projectId: string, sessionId: string): string {
  return sha256(`agent:${projectId}:${sessionId}`);
}

/**
 * 生成 IM 侧 hash
 * @param channelId 频道 ID
 * @param threadId  线程 ID（无线程时传空字符串）
 */
export function imHash(channelId: string, threadId: string): string {
  return sha256(`im:${channelId}:${threadId}`);
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 16);
}
