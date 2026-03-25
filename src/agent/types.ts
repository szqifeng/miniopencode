/**
 * Agent 模块 - 类型定义
 */

import type { ToolSet, Tool as AITool } from 'ai';

// ============ Part 类型 ============

export interface TextPart {
  type: 'text';
  content: string;
}

export interface ToolCallPart {
  type: 'tool-call';
  tool: string;
  args: Record<string, unknown>;
}

export interface ToolResultPart {
  type: 'tool-result';
  tool: string;
  result: unknown;
}

export type Part = TextPart | ToolCallPart | ToolResultPart;

// ============ Message 类型 ============

export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  role: MessageRole;
  parts: Part[];
  createdAt: number;
}

// ============ Session 类型 ============

export interface Session {
  id: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

// ============ LLM 类型 ============

export interface LLMMessage {
  role: MessageRole;
  content: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

// 使用 AI SDK 的 ToolSet 类型
export type { ToolSet };

// ============ Process 回调类型 ============

export interface ProcessCallbacks {
  onText?: (text: string) => void;
  onToolCall?: (tool: string, args: Record<string, unknown>) => void;
  onToolResult?: (tool: string, result: unknown) => void;
  onReasoning?: (text: string) => void;
}

// ============ API 请求类型 ============

export interface ChatRequest {
  sessionId?: string;
  messages: Array<{
    role: MessageRole;
    content: string;
  }>;
  system?: string;
  useTools?: boolean;
}

// ============ API 响应类型 ============

export type SSEEventType = 'text' | 'tool-call' | 'tool-result' | 'reasoning' | 'session';

export interface SSEEvent {
  type: SSEEventType;
  content?: string;
  tool?: string;
  args?: Record<string, unknown>;
  result?: unknown;
  text?: string;
  sessionId?: string;
}
