import type { ChatStreamEvent, ChatStreamRequest } from './types';

export const chatStreamRequestSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['sessionId', 'messages', 'useTools'],
  properties: {
    sessionId: {
      type: 'string',
      description: '前端生成并复用的会话 ID',
    },
    messages: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['role', 'content'],
        properties: {
          role: {
            type: 'string',
            enum: ['user', 'assistant'],
          },
          content: {
            type: 'string',
          },
        },
      },
    },
    useTools: {
      type: 'boolean',
      description: '是否允许后端在本轮对话中调用工具',
    },
  },
} as const satisfies Record<string, unknown>;

export const chatStreamEventSchema = {
  type: 'object',
  required: ['type'],
  properties: {
    type: {
      type: 'string',
      enum: [
        'start',
        'start-step',
        'reasoning-start',
        'reasoning-delta',
        'reasoning-end',
        'text-start',
        'text-delta',
        'text-end',
        'tool-input-start',
        'tool-input-delta',
        'tool-input-end',
        'tool-call',
        'tool-result',
        'finish-step',
        'finish',
      ],
    },
    id: {
      type: 'string',
    },
    text: {
      type: 'string',
    },
    toolName: {
      type: 'string',
    },
    delta: {
      type: 'string',
    },
    toolCallId: {
      type: 'string',
    },
    finishReason: {
      type: 'string',
      description: '只有 finishReason === stop 才能视为本次请求真正完成',
    },
  },
} as const satisfies Record<string, unknown>;

export type { ChatStreamRequest, ChatStreamEvent };
