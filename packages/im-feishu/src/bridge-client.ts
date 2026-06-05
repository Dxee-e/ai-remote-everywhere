/**
 * Bridge WebSocket 客户端
 *
 * 连接到主进程 Bridge，负责：
 * 1. 发送 register 帧注册自身
 * 2. 发送 request 帧（用户消息 → Agent）
 * 3. 接收 stream 帧（Agent 响应 → 渲染）
 */

import WebSocket from 'ws';
import type { Frame, StreamPayload } from '@are/protocol';
import { encodeFrame, decodeFrame, frameId } from '@are/protocol';

export interface BridgeClientOptions {
  bridgeUrl: string;
  clientId: string;
  clientName: string;
  onStream?: (frame: Frame<StreamPayload>) => void;
  onSystem?: (frame: Frame) => void;
}

export class BridgeClient {
  private ws: WebSocket | null = null;
  private opts: BridgeClientOptions;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(opts: BridgeClientOptions) {
    this.opts = opts;
  }

  /** 连接到 Bridge */
  connect(): void {
    this.ws = new WebSocket(this.opts.bridgeUrl);

    this.ws.on('open', () => {
      console.log(`[BridgeClient] Connected to ${this.opts.bridgeUrl}`);
      this.register();
    });

    this.ws.on('message', (data: Buffer) => {
      const raw = data.toString();
      try {
        const frame = decodeFrame(raw);
        this.handleFrame(frame);
      } catch (err) {
        console.error('[BridgeClient] Failed to decode frame:', err);
      }
    });

    this.ws.on('close', () => {
      console.log('[BridgeClient] Disconnected, reconnecting in 3s...');
      this.scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      console.error('[BridgeClient] Error:', err.message);
    });
  }

  /** 发送请求帧到 Agent */
  sendRequest(agentSessionId: string, targetId: string, text: string): string {
    const id = frameId();
    const frame: Frame = {
      id,
      type: 'request',
      from: this.opts.clientId,
      to: targetId,
      agent_session_id: agentSessionId,
      payload: { text, message_type: 'text' },
    };
    this.send(frame);
    return id;
  }

  /** 发送帧 */
  private send(frame: Frame): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(encodeFrame(frame));
    } else {
      console.warn('[BridgeClient] Cannot send, not connected');
    }
  }

  /** 注册自身 */
  private register(): void {
    const frame: Frame = {
      id: frameId(),
      type: 'register',
      from: this.opts.clientId,
      to: 'bridge',
      agent_session_id: '',
      payload: {
        role: 'im',
        name: this.opts.clientName,
        capabilities: ['text'],
      },
    };
    this.send(frame);
  }

  /** 处理收到的帧 */
  private handleFrame(frame: Frame): void {
    switch (frame.type) {
      case 'stream':
        this.opts.onStream?.(frame as Frame<StreamPayload>);
        break;
      case 'system':
        this.opts.onSystem?.(frame);
        break;
      case 'request':
        // IM 适配器一般不接收 request，忽略或记录
        console.log(`[BridgeClient] Unexpected request frame: ${frame.id}`);
        break;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 3000);
  }

  /** 断开连接 */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
  }
}
