/**
 * Agent 模块 - 类型定义
 */

import type { ToolSet, Tool as AITool } from 'ai';

// ============ Part 类型 ============

export interface TextPart {
  type: 'text';
  id: string;
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

export interface ToolInputDeltaPart {
  type: 'tool-input-delta';
  id: string;
  delta: string;
}

export interface ReasoningPart {
  type: 'reasoning';
  id: string;
  content: string;
}

export interface FinishStepPart {
  type: 'finish-step';
  finishReason: string;
}

export interface ErrorPart {
  type: 'error';
  error: string;
}

export interface StartPart {
  type: 'start';
}

export interface StartStepPart {
  type: 'start-step';
  request: unknown;
}

export interface TextStartPart {
  type: 'text-start';
  id: string;
}

export interface TextEndPart {
  type: 'text-end';
  id: string;
}

export interface ReasoningStartPart {
  type: 'reasoning-start';
  id: string;
}

export interface ReasoningEndPart {
  type: 'reasoning-end';
  id: string;
  providerMetadata?: Record<string, unknown>;
}

export interface ToolInputStartPart {
  type: 'tool-input-start';
  id: string;
  toolName: string;
  dynamic: boolean;
}

export interface ToolInputEndPart {
  type: 'tool-input-end';
  id: string;
}

export interface FinishPart {
  type: 'finish';
  finishReason: string;
  totalUsage?: unknown;
}

export type Part = TextPart | ToolCallPart | ToolResultPart | ToolInputDeltaPart | ReasoningPart | FinishStepPart | ErrorPart
  | StartPart | StartStepPart | TextStartPart | TextEndPart
  | ReasoningStartPart | ReasoningEndPart
  | ToolInputStartPart | ToolInputEndPart
  | FinishPart;

// ============ Message 类型 ============

export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  role: MessageRole;
  id: string;
  parts: Part[];
  createdAt: number;
}

// ============ Session 类型 ============

export interface Session {
  id: string;
  title?: string;
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
