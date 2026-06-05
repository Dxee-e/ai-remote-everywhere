/**
 * ARE IM Feishu — 飞书适配器入口
 *
 * 初始化数据库、Bridge 客户端和飞书消息处理器。
 * 提供 HTTP 端点接收飞书 webhook（演示用）。
 */

import http from 'node:http';
import { initDB } from './db.js';
import { BridgeClient } from './bridge-client.js';
import { FeishuHandler, type FeishuMessage } from './feishu-handler.js';

const BRIDGE_URL = process.env.ARE_BRIDGE_URL ?? 'ws://127.0.0.1:9100';
const CLIENT_ID = process.env.ARE_FEISHU_CLIENT_ID ?? 'im-feishu-1';
const HTTP_PORT = Number(process.env.ARE_FEISHU_PORT ?? 9200);

function main() {
  // 1. 初始化数据库
  const db = initDB();

  // 2. 连接 Bridge
  const bridge = new BridgeClient({
    bridgeUrl: BRIDGE_URL,
    clientId: CLIENT_ID,
    clientName: 'feishu',
    onStream: (frame) => handler.handleStream(frame),
    onSystem: (frame) => console.log(`[Feishu] System: ${frame.payload.event} - ${frame.payload.message}`),
  });
  bridge.connect();

  // 3. 初始化处理器
  const handler = new FeishuHandler(db, bridge);

  // 4. HTTP 端点接收飞书 webhook（演示）
  const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/webhook') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const msg: FeishuMessage = JSON.parse(body);
          handler.handleMessage(msg);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (err) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  server.listen(HTTP_PORT, () => {
    console.log(`[Feishu] HTTP webhook listening on http://0.0.0.0:${HTTP_PORT}/webhook`);
  });

  // 优雅退出
  process.on('SIGINT', () => {
    console.log('\n[Feishu] Shutting down...');
    bridge.disconnect();
    server.close(() => process.exit(0));
  });
}

main();
