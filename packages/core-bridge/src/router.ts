/**
 * 消息路由器
 *
 * 接收来自任意客户端的帧，根据 `to` 字段转发给目标客户端。
 * register 帧由 Registry 处理；其余帧走路由逻辑。
 */

import type { WebSocket } from 'ws';
import type { Frame } from '@are/protocol';
import { encodeFrame, decodeFrame } from '@are/protocol';
import { Registry } from './registry.js';

export class Router {
  constructor(private registry: Registry) {}

  /**
   * 处理一条来自客户端的原始消息
   */
  handleMessage(raw: string, senderWs: WebSocket): void {
    let frame: Frame;
    try {
      frame = decodeFrame(raw);
    } catch (err) {
      console.error(`[Router] Failed to decode frame:`, err);
      return;
    }

    // register 帧：注册客户端
    if (frame.type === 'register') {
      this.registry.register(frame, senderWs);
      // 回复注册确认
      const ack: Frame = {
        id: frame.id,
        type: 'system',
        from: 'bridge',
        to: frame.from,
        agent_session_id: frame.agent_session_id,
        payload: { event: 'status', message: 'registered' },
      };
      senderWs.send(encodeFrame(ack));
      return;
    }

    // 其他帧：路由转发
    this.route(frame);
  }

  /**
   * 将帧转发给目标客户端
   */
  route(frame: Frame): void {
    const target = this.registry.get(frame.to);
    if (!target) {
      console.warn(`[Router] Target not found: ${frame.to} (from=${frame.from}, type=${frame.type})`);
      // 回发 system 错误帧给发送方
      const sender = this.registry.get(frame.from);
      if (sender) {
        const errFrame: Frame = {
          id: frame.id,
          type: 'system',
          from: 'bridge',
          to: frame.from,
          agent_session_id: frame.agent_session_id,
          payload: { event: 'error', message: `Target ${frame.to} not connected` },
        };
        sender.ws.send(encodeFrame(errFrame));
      }
      return;
    }

    try {
      target.ws.send(encodeFrame(frame));
    } catch (err) {
      console.error(`[Router] Failed to send to ${frame.to}:`, err);
    }
  }

  /**
   * 广播给所有指定角色的客户端
   */
  broadcast(frame: Frame, role: 'im' | 'agent'): void {
    const targets = role === 'im' ? this.registry.getIMs() : this.registry.getAgents();
    const raw = encodeFrame(frame);
    for (const client of targets) {
      try {
        client.ws.send(raw);
      } catch (err) {
        console.error(`[Router] Broadcast failed for ${client.id}:`, err);
      }
    }
  }
}
