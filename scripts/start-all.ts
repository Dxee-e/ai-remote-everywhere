/**
 * ARE 启动脚本 — 同时拉起所有进程
 *
 * 启动顺序：
 * 1. Core Bridge (WebSocket Server)
 * 2. Agent 适配器 (claude, opencode)
 * 3. IM 适配器 (feishu)
 *
 * 所有进程通过 Bridge 的 WebSocket 端口协调。
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

interface ProcessDef {
  name: string;
  cwd: string;
  cmd: string;
  args: string[];
  env?: Record<string, string>;
  delay?: number; // 启动延迟（ms），等待 Bridge 就绪
}

const processes: ProcessDef[] = [
  {
    name: 'core-bridge',
    cwd: resolve(ROOT, 'packages/core-bridge'),
    cmd: 'npx',
    args: ['tsx', 'src/index.ts'],
    env: { ARE_BRIDGE_PORT: '9100' },
  },
  {
    name: 'agent-claude',
    cwd: resolve(ROOT, 'packages/agent-claude'),
    cmd: 'npx',
    args: ['tsx', 'src/index.ts'],
    env: { ARE_BRIDGE_URL: 'ws://127.0.0.1:9100' },
    delay: 1000,
  },
  {
    name: 'agent-opencode',
    cwd: resolve(ROOT, 'packages/agent-opencode'),
    cmd: 'npx',
    args: ['tsx', 'src/index.ts'],
    env: { ARE_BRIDGE_URL: 'ws://127.0.0.1:9100' },
    delay: 1000,
  },
  {
    name: 'im-feishu',
    cwd: resolve(ROOT, 'packages/im-feishu'),
    cmd: 'npx',
    args: ['tsx', 'src/index.ts'],
    env: {
      ARE_BRIDGE_URL: 'ws://127.0.0.1:9100',
      ARE_FEISHU_PORT: '9200',
    },
    delay: 1500,
  },
];

const running: ChildProcess[] = [];

function launch(def: ProcessDef): Promise<void> {
  return new Promise((resolve) => {
    const start = () => {
      console.log(`[start-all] Launching ${def.name}...`);

      const child = spawn(def.cmd, def.args, {
        cwd: def.cwd,
        stdio: 'inherit',
        env: { ...process.env, ...def.env },
        shell: true,
      });

      running.push(child);

      child.on('error', (err) => {
        console.error(`[start-all] ${def.name} error:`, err.message);
      });

      child.on('exit', (code, signal) => {
        console.log(`[start-all] ${def.name} exited (code=${code}, signal=${signal})`);
      });

      resolve();
    };

    if (def.delay) {
      setTimeout(start, def.delay);
    } else {
      start();
    }
  });
}

async function main() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║   AI Remote Everywhere — Starting    ║');
  console.log('╚══════════════════════════════════════╝');
  console.log();

  for (const def of processes) {
    await launch(def);
  }

  console.log();
  console.log('[start-all] All processes launched. Press Ctrl+C to stop.');
  console.log();

  // 优雅退出：终止所有子进程
  const shutdown = () => {
    console.log('\n[start-all] Shutting down all processes...');
    for (const child of running) {
      child.kill('SIGTERM');
    }
    setTimeout(() => process.exit(0), 2000);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main();
