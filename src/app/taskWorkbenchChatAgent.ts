/**
 * App 专属 Agent 组装层（DDD: Application/Composition）
 *
 * 设计原则：
 * - `src/agent/*` 保持通用，不引入任何 app 业务语义
 * - `src/app/*` 依托通用 agent 的能力，通过“系统提示词 + 工具白名单”组装出 app 专用 agent
 * - 表格任务工作台的聊天仅用于“任务澄清与结构化”，因此禁止 edit/write 类工具，避免引导用户进行代码写入
 */

import { createAgent } from '../agent/index.js';
import type { LLMRes } from '../agent/llm.js';
import { getDefaultPrompt } from '../agent/prompts.js';
import type { LLMMessage, Message } from '../agent/types.js';

export interface TaskWorkbenchChatAgent {
  /**
   * 以流式输出的方式运行。
   *
   * 注意：这里故意不暴露 `run` 等更多能力，避免 app 调用方绕过流式协议与会话持久化的约束。
   */
  runWithStream(params: {
    messages: LLMMessage[];
    system?: string;
    maxLoops?: number;
    workspaceDir?: string;
    res?: LLMRes;
    sessionId?: string;
    addMessage?: (message: Message) => Promise<void>;
  }): Promise<{ text: string }>;
}

/**
 * 表格任务工作台聊天允许的最小工具集合。
 *
 * 约束：必须不包含任何写文件/改文件工具。
 * - read/grep：允许在任务工作目录内进行只读检查
 * - csv_inspect/excel_inspect：允许读取用户上传的表格数据做预览与列名推断
 */
export const TASK_WORKBENCH_CHAT_TOOL_IDS = [
  'read',
  'grep',
  'csv_inspect',
  'excel_inspect',
] as const;

export function createTaskWorkbenchChatAgent(): TaskWorkbenchChatAgent {
  // 通过通用 agent 的 `withToolsById` 过滤出最小工具集，保持工具定义与实现仍由 `src/services/toolService.ts` 统一维护。
  return createAgent().withToolsById([...TASK_WORKBENCH_CHAT_TOOL_IDS]) as unknown as TaskWorkbenchChatAgent;
}

export async function buildTaskWorkbenchChatSystemPrompt(params?: {
  overrideSystem?: string;
  /**
   * 当前聊天关联的文件名快照（由 UI 传入，服务端用于要求回复携带文件名上下文）。
   */
  currentFileName?: string;
  /**
   * 当前聊天关联的相对文件路径（相对 workspaceDir）。
   */
  currentRelativeFilePath?: string;
  /**
   * 当前聊天关联的绝对文件路径（后端拼接后的最终定位）。
   */
  currentAbsoluteFilePath?: string;
  /**
   * UI 侧的上下文备注（例如“已上传文件”、“已切换文件”）。
   */
  contextNotes?: string[];
  /**
   * 当前会话绑定的真实工作空间目录（workspaceDir）。
   * 约束：涉及文件的工具调用必须限定在此目录下。
   */
  workspaceDir?: string;
}): Promise<string> {
  const overrideSystem = params?.overrideSystem;
  const currentFileName = params?.currentFileName;
  const currentRelativeFilePath = params?.currentRelativeFilePath;
  const currentAbsoluteFilePath = params?.currentAbsoluteFilePath;
  const contextNotes = Array.isArray(params?.contextNotes) ? params?.contextNotes.filter(Boolean) : [];
  const workspaceDir = params?.workspaceDir;
  const baseSystem = overrideSystem || (await getDefaultPrompt());
  return [
    baseSystem,
    '',
    '你现在是“表格任务工作台”的聊天助手，只帮助用户完成任务创建/编辑时的澄清与结构化。',
    '约束：不要提出写文件、编辑文件的操作建议；只允许读取和检查用户工作目录内的文件。',
    workspaceDir ? `真实工作空间：${workspaceDir}` : '真实工作空间：未知（尚未创建任务工作区）',
    currentFileName ? `当前文件名：${currentFileName}` : '当前文件名：未知（用户尚未选择文件）',
    currentRelativeFilePath ? `涉及文件相对路径：${currentRelativeFilePath}` : '涉及文件相对路径：未知',
    currentAbsoluteFilePath ? `涉及文件绝对路径：${currentAbsoluteFilePath}` : '涉及文件绝对路径：未知',
    currentFileName ? `涉及文件：${currentFileName}（文件名已确认）` : '涉及文件：未知',
    contextNotes.length > 0 ? `上下文备注：\n- ${contextNotes.slice(-8).join('\n- ')}` : '上下文备注：无',
    '回复格式要求：你的每次回复第一行必须包含 `【文件：<当前文件名>】`，用于 UI 展示与后续解析。',
    '工具调用约束：所有涉及文件的查询都必须基于“真实工作空间”；如果已提供“涉及文件绝对路径”，优先直接使用这个确切绝对路径调用工具；其次再使用“涉及文件相对路径”，不要自行猜测别的路径。',
    '表格文件约束：Excel 一律优先使用 `excel_inspect`，CSV 一律优先使用 `csv_inspect`；不要用 `read` 直接读取表格二进制文件。',
    `可用工具（最小化）：${TASK_WORKBENCH_CHAT_TOOL_IDS.join(', ')}`,
  ].join('\n');
}
