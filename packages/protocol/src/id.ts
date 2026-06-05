/**
 * ID 生成工具 — 帧 ID、会话 ID 等
 */

import { randomBytes } from 'node:crypto';

/** 生成短帧 ID（8 字符 hex） */
export function frameId(): string {
  return randomBytes(4).toString('hex');
}

/** 生成会话 ID（16 字符 hex） */
export function sessionId(): string {
  return randomBytes(8).toString('hex');
}
