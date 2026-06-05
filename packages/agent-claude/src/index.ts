/**
 * ARE Agent Claude — Claude Code 适配器入口
 *
 * 利用 Claude Code 自带的 Hook 机制实现 Agent 功能：
 * 1. 连接 Bridge，注册为 agent 角色
 * 2. 接收 request 帧，通过 Hook 机制驱动 Claude Code
 * 3. 拦截 Claude Code 的输出，转为 stream 帧发回 Bridge
 *
 * Hook 机制说明：
 * - Claude Code 支持 PreToolUse / PostToolUse / Notification 等 Hook
 * - Hook 通过 stdin 接收 JSON，通过 stdout 返回决策
 * - 本适配器通过子进程管理 Claude Code 实例，拦截其 I/O
 *
 * 同时可以维护多个 Claude Code 实例（多 session 并行）。
 */

import { spawn, type ChildProcess } from 'node:child_process';
import WebSocket from 'ws';
import type { Frame, RequestPayload, StreamPayload } from '@are/protocol';
import { encodeFrame, decodeFrame, frameId, sessionId } from '@are/protocol';

const BRIDGE_URL = process.env.ARE_BRIDGE_URL ?? 'ws://127.0.0.1:9100';
const CLIENT_ID = process.env.ARE_CLAUDE_CLIENT_ID ?? 'agent-claude-1';
const CLAUDE_CMD = process.env.ARE_CLAUDE_CMD ?? 'claude';

// ─── Session 管理 ─────────────────────────────────────────────────────────────

interface ClaudeSession {
  id: string;
  process: ChildProcess;
  outputBuffer: string;
  createdAt: number;
}

class ClaudeAgent {
  private ws: WebSocket | null = null;
  /** sessionId → ClaudeSession */
  private sessions = new Map<string, ClaudeSession>();

  connect(): void {
    this.ws = new WebSocket(BRIDGE_URL);

    this.ws.on('open', () => {
      console.log('[Claude] Connected to Bridge');
      this.register();
    });

    this.ws.on('message', (data: Buffer) => {
      try {
        const frame = decodeFrame(data.toString());
        this.handleFrame(frame);
      } catch (err) {
        console.error('[Claude] Frame decode error:', err);
      }
    });

    this.ws.on('close', () => {
      console.log('[Claude] Disconnected, reconnecting in 3s...');
      setTimeout(() => this.connect(), 3000);
    });

    this.ws.on('error', (err) => {
      console.error('[Claude] Error:', err.message);
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
        name: 'claude',
        capabilities: ['text', 'code', 'tool-use'],
      },
    };
    this.send(frame);
  }

  private handleFrame(frame: Frame): void {
    if (frame.type === 'request') {
      this.handleRequest(frame);
    } else if (frame.type === 'system') {
      console.log(`[Claude] System: ${frame.payload.event}`);
    }
  }

  /**
   * 处理请求：驱动 Claude Code 子进程
   *
   * 根据 agent_session_id 复用或创建 Claude Code 会话。
   * 通过 --resume 参数实现会话延续。
   */
  private handleRequest(frame: Frame<RequestPayload>): void {
    const { id, from, agent_session_id, payload } = frame;
    console.log(`[Claude] Request from ${from} (session=${agent_session_id}): ${payload.text.slice(0, 50)}...`);

    // 获取或创建 session
    let session = this.sessions.get(agent_session_id);
    if (!session) {
      session = this.createSession(agent_session_id);
    }

    // 发送 stream start
    this.sendStream(id, from, agent_session_id, { status: 'start' });

    // TODO: 实际实现需要：
    // 1. 通过 Claude Code 的 Hook stdin 发送用户消息
    // 2. 拦截 stdout 获取 Agent 输出
    // 3. 解析输出并转为 stream chunk

    // 模拟响应
    const response = `[Claude placeholder] Session ${agent_session_id} received: ${payload.text}`;
    this.sendStream(id, from, agent_session_id, {
      status: 'chunk',
      chunk: response,
    });
    this.sendStream(id, from, agent_session_id, {
      status: 'end',
      full_text: response,
    });
  }

  /**
   * 创建一个新的 Claude Code 会话
   *
   * TODO: 实际实现需要：
   * 1. spawn Claude Code 子进程
   * 2. 设置 Hook 拦截 I/O
   * 3. 管理进程生命周期
   */
  private createSession(sid: string): ClaudeSession {
    console.log(`[Claude] Creating session: ${sid}`);

    // 占位：实际应 spawn claude 进程
    // const proc = spawn(CLAUDE_CMD, ['--print', '--output-format', 'stream-json'], {
    //   stdio: ['pipe', 'pipe', 'pipe'],
    //   env: { ...process.env, ARE_SESSION_ID: sid },
    // });

    const session: ClaudeSession = {
      id: sid,
      process: null as any, // TODO: 替换为实际进程
      outputBuffer: '',
      createdAt: Date.now(),
    };

    this.sessions.set(sid, session);
    return session;
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

  /** 关闭所有会话 */
  shutdown(): void {
    for (const [sid, session] of this.sessions) {
      if (session.process) {
        session.process.kill();
      }
      console.log(`[Claude] Session closed: ${sid}`);
    }
    this.sessions.clear();
  }
}

const agent = new ClaudeAgent();
agent.connect();

process.on('SIGINT', () => {
  console.log('\n[Claude] Shutting down...');
  agent.shutdown();
  process.exit(0);
});
