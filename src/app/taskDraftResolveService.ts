/**
 * 任务草稿解析编排（DDD: Application Service）
 *
 * 目标：
 * - 前端先调用流式聊天 `/api/web/chat/stream`，由后端将对话落到通用 session 存储中（`src/agent/session.ts`）
 * - 聊天完成后，前端再调用 `/api/tasks/draft/resolve`，此接口只传 `sessionId`
 * - 解析所需的对话内容从 session 存储中读取，避免前端重复传输消息正文
 */

import {
  getSession as getAgentSession,
  getMessages as getAgentMessages,
} from '../agent/session.js';
import type { Message, Part } from '../agent/types.js';
import type { TaskDraftResolveResult, TaskDraftResolveParams, ChatStreamMessage } from './taskDraft.js';
import { resolveTaskDraft } from './taskDraft.js';

function joinTextParts(parts: Part[] | undefined): string {
  if (!parts || parts.length === 0) {
    return '';
  }
  return parts
    .filter((part) => part.type === 'text')
    .map((part) => (part as { type: 'text'; content: string }).content || '')
    .join('');
}

function toChatStreamMessages(messages: Message[]): ChatStreamMessage[] {
  return messages
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .map((message) => ({
      role: message.role as 'user' | 'assistant',
      content: joinTextParts(message.parts),
    }))
    .filter((message) => message.content.trim().length > 0);
}

export async function resolveTaskDraftBySessionId(params: {
  sessionId: string;
  draft?: TaskDraftResolveParams['draft'];
}): Promise<TaskDraftResolveResult> {
  const session = await getAgentSession(params.sessionId);
  const agentMessages = await getAgentMessages(params.sessionId, session);

  return resolveTaskDraft({
    messages: toChatStreamMessages(agentMessages),
    draft: params.draft,
  });
}

