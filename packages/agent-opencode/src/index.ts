/**
 * ARE Agent OpenCode — OpenCode 适配器入口
 *
 * 作为协议转换网关：
 * 1. 连接 Bridge，注册为 agent 角色
 * 2. 接收 request 帧，翻译为 OpenCode API 调用
 * 3. 将 OpenCode 的流式响应转为 stream 帧发回 Bridge
 *
 * 如果未配置 OpenCode 服务器地址，可自行启动维护。
 */

import WebSocket from 'ws';
import type { Frame, RequestPayload, StreamPayload } from '@are/protocol';
import { encodeFrame, decodeFrame, frameId } from '@are/protocol';

const BRIDGE_URL = process.env.ARE_BRIDGE_URL ?? 'ws://127.0.0.1:9100';
const CLIENT_ID = process.env.ARE_OPENCODE_CLIENT_ID ?? 'agent-opencode-1';
const OPENCODE_SERVER = process.env.ARE_OPENCODE_SERVER; // 可选：外部 OpenCode 服务器地址

class OpenCodeAgent {
  private ws: WebSocket | null = null;

  connect(): void {
    this.ws = new WebSocket(BRIDGE_URL);

    this.ws.on('open', () => {
      console.log('[OpenCode] Connected to Bridge');
      this.register();
    });

    this.ws.on('message', (data: Buffer) => {
      try {
        const frame = decodeFrame(data.toString());
        this.handleFrame(frame);
      } catch (err) {
        console.error('[OpenCode] Frame decode error:', err);
      }
    });

    this.ws.on('close', () => {
      console.log('[OpenCode] Disconnected, reconnecting in 3s...');
      setTimeout(() => this.connect(), 3000);
    });

    this.ws.on('error', (err) => {
      console.error('[OpenCode] Error:', err.message);
    });
  }

  private register(): void {
    const frame: Frame = {
      id: frameId(),
      type: 'register',
      from: CLIENT_ID,
      to: 'bridge',
      agent_session_id: '',
      payload: {
        role: 'agent',
        name: 'opencode',
        capabilities: ['text', 'code'],
      },
    };
    this.send(frame);
  }

  private handleFrame(frame: Frame): void {
    if (frame.type === 'request') {
      this.handleRequest(frame);
    } else if (frame.type === 'system') {
      console.log(`[OpenCode] System: ${frame.payload.event}`);
    }
  }

  /**
   * 处理请求：翻译为 OpenCode API 调用
   *
   * TODO: 实际实现需要：
   * 1. 调用 OpenCode server API（或自行启动 OpenCode 进程）
   * 2. 转发用户消息
   * 3. 流式接收响应并转为 stream 帧
   */
  private async handleRequest(frame: Frame<RequestPayload>): Promise<void> {
    const { id, from, agent_session_id, payload } = frame;
    console.log(`[OpenCode] Request from ${from}: ${payload.text.slice(0, 50)}...`);

    // 发送 stream start
    this.sendStream(id, from, agent_session_id, { status: 'start' });

    // TODO: 替换为实际的 OpenCode API 调用
    // 模拟流式响应
    const response = `[OpenCode placeholder] Echo: ${payload.text}`;
    const chunks = response.match(/.{1,20}/gs) ?? [response];

    for (const chunk of chunks) {
      await new Promise(r => setTimeout(r, 50));
      this.sendStream(id, from, agent_session_id, { status: 'chunk', chunk });
    }

    // 发送 stream end
    this.sendStream(id, from, agent_session_id, { status: 'end', full_text: response });
  }

  private sendStream(
    requestId: string,
    to: string,
    agentSessionId: string,
    payload: StreamPayload
  ): void {
    const frame: Frame<StreamPayload> = {
      id: requestId,
      type: 'stream',
      from: CLIENT_ID,
      to,
      agent_session_id: agentSessionId,
      payload,
    };
    this.send(frame);
  }

  private send(frame: Frame): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(encodeFrame(frame));
    }
  }
}

const agent = new OpenCodeAgent();
agent.connect();

process.on('SIGINT', () => {
  console.log('\n[OpenCode] Shutting down...');
  process.exit(0);
});
