/**
 * ARE 统一通信协议帧定义
 *
 * 所有组件（Bridge、IM 适配器、Agent 适配器）通过此帧格式通信。
 * payload 为 any 类型，支持按需扩展（文本、图片、文件等）。
 */

// ─── 帧类型枚举 ───────────────────────────────────────────────────────────────

export type FrameType = 'register' | 'request' | 'stream' | 'system';

// ─── 核心帧结构 ───────────────────────────────────────────────────────────────

export interface Frame<T = any> {
  /** 帧唯一 ID，用于请求-响应关联 */
  id: string;
  /** 帧类型 */
  type: FrameType;
  /** 发送方标识 */
  from: string;
  /** 目标方标识 */
  to: string;
  /** Agent 会话 ID */
  agent_session_id: string;
  /** 业务数据载荷 */
  payload: T;
}

// ─── 各类型 Payload 定义 ──────────────────────────────────────────────────────

/** register — 客户端注册 */
export interface RegisterPayload {
  /** 客户端角色：'im' | 'agent' */
  role: 'im' | 'agent';
  /** 客户端名称，如 'feishu', 'claude' */
  name: string;
  /** 支持的能力列表（可选） */
  capabilities?: string[];
}

/** request — 用户请求（IM → Agent） */
export interface RequestPayload {
  /** 用户消息文本 */
  text: string;
  /** 消息类型（可扩展：image, file 等） */
  message_type?: 'text' | 'image' | 'file' | 'mixed';
  /** 额外元数据 */
  metadata?: Record<string, any>;
}

/** stream — 流式数据（Agent → IM） */
export interface StreamPayload {
  /** 流式块内容 */
  chunk?: string;
  /** 流状态 */
  status: 'start' | 'chunk' | 'end' | 'error';
  /** 错误信息（仅 status=error 时） */
  error?: string;
  /** 最终完整内容（仅 status=end 时，可选） */
  full_text?: string;
}

/** system — 系统控制消息 */
export interface SystemPayload {
  /** 系统事件类型 */
  event: 'heartbeat' | 'error' | 'status' | 'disconnect';
  /** 事件消息 */
  message?: string;
  /** 附加数据 */
  data?: any;
}

// ─── 序列化 / 反序列化 ────────────────────────────────────────────────────────

export function encodeFrame(frame: Frame): string {
  return JSON.stringify(frame);
}

export function decodeFrame(raw: string): Frame {
  const parsed = JSON.parse(raw);
  if (!parsed.id || !parsed.type || !parsed.from || !parsed.to) {
    throw new Error(`Invalid frame: missing required fields. Raw: ${raw.slice(0, 200)}`);
  }
  return parsed as Frame;
}
