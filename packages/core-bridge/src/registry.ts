/**
 * 适配器注册管理器
 *
 * 维护已连接的 IM 和 Agent 客户端映射。
 * 每个客户端通过 register 帧声明自己的角色和名称。
 */

import type { WebSocket } from 'ws';
import type { Frame } from '@are/protocol';

export interface ClientEntry {
  id: string;
  role: 'im' | 'agent';
  name: string;
  ws: WebSocket;
  capabilities: string[];
  connectedAt: number;
}

export class Registry {
  /** clientId → ClientEntry */
  private clients = new Map<string, ClientEntry>();

  /** 注册一个客户端 */
  register(frame: Frame, ws: WebSocket): ClientEntry {
    const { from, payload } = frame;
    const entry: ClientEntry = {
      id: from,
      role: payload.role,
      name: payload.name,
      ws,
      capabilities: payload.capabilities ?? [],
      connectedAt: Date.now(),
    };
    this.clients.set(from, entry);
    console.log(`[Registry] Registered: ${from} (role=${entry.role}, name=${entry.name})`);
    return entry;
  }

  /** 注销一个客户端 */
  unregister(clientId: string): void {
    const entry = this.clients.get(clientId);
    if (entry) {
      this.clients.delete(clientId);
      console.log(`[Registry] Unregistered: ${clientId} (role=${entry.role})`);
    }
  }

  /** 根据 ID 获取客户端 */
  get(clientId: string): ClientEntry | undefined {
    return this.clients.get(clientId);
  }

  /** 获取所有 Agent 客户端 */
  getAgents(): ClientEntry[] {
    return [...this.clients.values()].filter(c => c.role === 'agent');
  }

  /** 获取所有 IM 客户端 */
  getIMs(): ClientEntry[] {
    return [...this.clients.values()].filter(c => c.role === 'im');
  }

  /** 客户端总数 */
  get size(): number {
    return this.clients.size;
  }
}
