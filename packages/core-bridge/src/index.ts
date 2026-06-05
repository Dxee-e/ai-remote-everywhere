/**
 * ARE Core Bridge — 主进程入口
 *
 * 启动 WebSocket Server，初始化 Registry 和 Router，
 * 处理客户端连接、断连和消息路由。
 */

import { WebSocketServer, WebSocket } from 'ws';
import { Registry } from './registry.js';
import { Router } from './router.js';

const PORT = Number(process.env.ARE_BRIDGE_PORT ?? 9100);

function main() {
  const registry = new Registry();
  const router = new Router(registry);

  const wss = new WebSocketServer({ port: PORT });

  wss.on('listening', () => {
    console.log(`[Bridge] WebSocket Server listening on ws://0.0.0.0:${PORT}`);
  });

  wss.on('connection', (ws: WebSocket) => {
    console.log(`[Bridge] New connection (total: ${wss.clients.size})`);

    ws.on('message', (data: Buffer) => {
      router.handleMessage(data.toString(), ws);
    });

    ws.on('close', () => {
      // 反向查找并注销对应的客户端
      // TODO: 可优化为 ws → clientId 的反向映射
      for (const client of registry.getAgents().concat(registry.getIMs())) {
        if (client.ws === ws) {
          registry.unregister(client.id);
          break;
        }
      }
      console.log(`[Bridge] Connection closed (remaining: ${wss.clients.size})`);
    });

    ws.on('error', (err) => {
      console.error('[Bridge] WebSocket error:', err.message);
    });
  });

  // 优雅退出
  process.on('SIGINT', () => {
    console.log('\n[Bridge] Shutting down...');
    wss.close(() => process.exit(0));
  });
  process.on('SIGTERM', () => {
    wss.close(() => process.exit(0));
  });
}

main();
