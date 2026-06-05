/**
 * 飞书消息处理器
 *
 * 演示核心流程：
 * 1. 接收外部消息（飞书 webhook 或 SDK 回调）
 * 2. 查询/生成 agent_session_id
 * 3. 组装请求帧发给 Bridge
 * 4. 接收流式响应并渲染回飞书
 */

import type Database from 'better-sqlite3';
import type { Frame, StreamPayload } from '@are/protocol';
import { agentHash, imHash, sessionId } from '@are/protocol';
import { getByIMHash, upsertMapping } from './db.js';
import { BridgeClient } from './bridge-client.js';

export interface FeishuMessage {
  channelId: string;
  threadId: string;
  userId: string;
  text: string;
}

export class FeishuHandler {
  constructor(
    private db: Database.Database,
    private bridge: BridgeClient,
  ) {}

  /**
   * 处理一条来自飞书的消息
   */
  handleMessage(msg: FeishuMessage): void {
    const iHash = imHash(msg.channelId, msg.threadId);

    // 查询已有映射
    let mapping = getByIMHash(this.db, iHash);

    if (!mapping) {
      // 新会话：生成 agent session ID 和映射
      const newSessionId = sessionId();
      const projectId = msg.channelId; // 简化：用 channelId 作为 projectId
      const aHash = agentHash(projectId, newSessionId);

      upsertMapping(this.db, {
        im_hash: iHash,
        agent_hash: aHash,
        channel_id: msg.channelId,
        thread_id: msg.threadId,
        project_id: projectId,
        session_id: newSessionId,
        metadata: '{}',
      });

      mapping = getByIMHash(this.db, iHash)!;
      console.log(`[FeishuHandler] New mapping: ${iHash} → ${aHash}`);
    }

    // 发送请求到 Bridge（to 字段需要知道目标 agent ID，这里用 'agent-claude' 示范）
    this.bridge.sendRequest(mapping.session_id, 'agent-claude', msg.text);
    console.log(`[FeishuHandler] Sent request for session ${mapping.session_id}`);
  }

  /**
   * 处理来自 Bridge 的流式响应
   */
  handleStream(frame: Frame<StreamPayload>): void {
    const { payload } = frame;

    switch (payload.status) {
      case 'start':
        console.log(`[FeishuHandler] Stream started: ${frame.id}`);
        // TODO: 在飞书中创建或获取消息卡片
        break;
      case 'chunk':
        // TODO: 追加内容到飞书消息卡片
        console.log(`[FeishuHandler] Chunk: ${payload.chunk?.slice(0, 50)}...`);
        break;
      case 'end':
        console.log(`[FeishuHandler] Stream ended: ${frame.id}`);
        // TODO: 最终渲染飞书消息
        break;
      case 'error':
        console.error(`[FeishuHandler] Stream error: ${payload.error}`);
        // TODO: 在飞书中显示错误消息
        break;
    }
  }
}
