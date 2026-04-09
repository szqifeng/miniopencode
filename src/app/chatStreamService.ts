/**
 * 表格任务工作台的流式聊天编排（DDD: Application Service）
 *
 * 责任边界：
 * - 不负责 HTTP/SSE 细节（由 `src/app/api.ts` 处理）
 * - 负责会话持久化、消息格式转换、选择 app 专属 agent、并驱动 agent 流式运行
 *
 * 设计原则：
 * - `src/agent/*` 保持通用
 * - `src/app/*` 通过系统提示词 + 工具白名单组装专属 agent，控制能力边界
 */

import { createAgent } from '../agent/index.js';
import type { LLMRes } from '../agent/llm.js';
import {
  addMessage as addAgentMessage,
  createMessage as createAgentMessage,
  createTextPart as createAgentTextPart,
  getMessages as getAgentMessages,
  getSession as getAgentSession,
  messagesToLLMFormat as agentMessagesToLLMFormat,
} from '../agent/session.js';
import {
  buildTaskWorkbenchChatSystemPrompt,
  createTaskWorkbenchChatAgent,
} from './taskWorkbenchChatAgent.js';

export type TaskWorkbenchChatStreamMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type TaskWorkbenchChatContext = {
  actualWorkspaceDir?: string;
};

type TaskWorkbenchPromptContext = Parameters<typeof buildTaskWorkbenchChatSystemPrompt>[0];

async function persistUserMessages(
  sessionId: string,
  session: Awaited<ReturnType<typeof getAgentSession>>,
  messages: TaskWorkbenchChatStreamMessage[]
): Promise<void> {
  const userMessageParts = messages
    .filter((messageItem) => messageItem?.role === 'user')
    .map((messageItem, index) => createAgentTextPart(`user_${index}`, String(messageItem?.content || '')));

  if (userMessageParts.length === 0) {
    return;
  }

  const userMessage = createAgentMessage('user', userMessageParts);
  await addAgentMessage(sessionId, userMessage, session);
}

function buildPromptContext(
  workspaceDir: string | undefined,
  system: string | undefined,
  context: TaskWorkbenchChatContext | undefined
): { actualWorkspaceDir?: string; promptContext: TaskWorkbenchPromptContext } {
  const actualWorkspaceDir = context?.actualWorkspaceDir || workspaceDir;

  return {
    actualWorkspaceDir,
    promptContext: {
      overrideSystem: system,
      workspaceDir: actualWorkspaceDir,
    },
  };
}

export async function runTaskWorkbenchChatStream(params: {
  sessionId: string;
  messages: TaskWorkbenchChatStreamMessage[];
  workspaceDir?: string;
  system?: string;
  useTools: boolean;
  llmRes: LLMRes;
  context?: TaskWorkbenchChatContext;
}): Promise<void> {
  const { sessionId, messages, workspaceDir, system, useTools, llmRes, context } = params;
  const session = await getAgentSession(sessionId);
  await persistUserMessages(sessionId, session, messages);
  const historyMessages = await getAgentMessages(sessionId, session);
  const llmMessages = agentMessagesToLLMFormat(historyMessages);
  const { actualWorkspaceDir, promptContext } = buildPromptContext(workspaceDir, system, context);
  const agent = useTools ? createTaskWorkbenchChatAgent() : createAgent({});
  const taskSystem = await buildTaskWorkbenchChatSystemPrompt(promptContext);
  await agent.runWithStream({
    messages: llmMessages,
    system: taskSystem,
    res: llmRes,
    maxLoops: 100,
    sessionId,
    workspaceDir: actualWorkspaceDir,
    addMessage: async (message) => {
      await addAgentMessage(sessionId, message, session);
    },
  });
}
