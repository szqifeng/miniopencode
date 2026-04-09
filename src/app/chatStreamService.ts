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
  /**
   * 当前聊天关联的输入文件路径（用于在回复里携带文件名上下文）。
   * 这是 UI 层的“当前选择文件”快照，允许每次请求都更新它。
   */
  inputFilePath?: string;
  absoluteFilePath?: string;
  /**
   * UI 侧的上下文备注（例如“已上传文件并设为当前输入”、“已切换到文件”）。
   * 这些备注不会落入 session 存储，而是作为 system prompt 的补充上下文注入本次对话。
   */
  notes?: string[];
};

function getFileNameFromPath(inputFilePath?: string): string | undefined {
  if (!inputFilePath) {
    return undefined;
  }
  const normalized = String(inputFilePath);
  const parts = normalized.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] || normalized;
}

function resolveAbsoluteFilePath(workspaceDir?: string, inputFilePath?: string): string | undefined {
  if (!workspaceDir || !inputFilePath) {
    return undefined;
  }
  const path = inputFilePath.startsWith('/') ? inputFilePath : `${workspaceDir}/${inputFilePath}`.replace(/\/+/g, '/');
  return path;
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

  // 1) 会话持久化：把本次请求里的 user 消息写入 session store（用于多轮编辑的上下文累积）
  const session = await getAgentSession(sessionId);

  const userMessageParts = messages
    .filter((messageItem) => messageItem?.role === 'user')
    .map((messageItem, index) => createAgentTextPart(`user_${index}`, String(messageItem?.content || '')));

  if (userMessageParts.length > 0) {
    const userMessage = createAgentMessage('user', userMessageParts);
    await addAgentMessage(sessionId, userMessage, session);
  }

  // 2) 读取历史并转为 LLM 需要的消息格式
  const historyMessages = await getAgentMessages(sessionId, session);
  const llmMessages = agentMessagesToLLMFormat(historyMessages);

  // 3) 选择 app 专属 agent（默认最小工具集）
  const actualWorkspaceDir = context?.actualWorkspaceDir || workspaceDir;
  const agent = useTools ? createTaskWorkbenchChatAgent() : createAgent({});
  const currentFileName = getFileNameFromPath(context?.inputFilePath);
  const currentRelativeFilePath = context?.inputFilePath;
  const currentAbsoluteFilePath =
    context?.absoluteFilePath || resolveAbsoluteFilePath(actualWorkspaceDir, context?.inputFilePath);
  const taskSystem = await buildTaskWorkbenchChatSystemPrompt({
    overrideSystem: system,
    currentFileName,
    currentRelativeFilePath,
    currentAbsoluteFilePath,
    contextNotes: context?.notes,
    workspaceDir: actualWorkspaceDir,
  });

  // 4) 驱动通用 agent 引擎进行流式输出
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
