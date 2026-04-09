/**
 * 任务执行专用 Agent（DDD: Application/Composition）
 *
 * 背景：
 * - `src/agent/*` 是通用 agent 引擎与工具编排层，不应引入任何 app 语义
 * - `src/app/*` 负责把“通用 agent”按业务场景组装成专属 agent
 *
 * 本文件负责“任务执行”场景的 agent 组装：
 * - 通过工具白名单控制能力边界（默认不暴露 write/edit/bass/webfetch 等高风险工具）
 * - 统一构建任务执行的 system prompt / user prompt，确保 agent 的工作目录与任务维度一致
 */

import { createAgent } from '../agent/index.js';
import { getDefaultPrompt } from '../agent/prompts.js';
import type { Task } from './types.js';

export interface TaskExecutionAgent {
  runWithStream(params: Parameters<ReturnType<typeof createAgent>['runWithStream']>[0]): ReturnType<
    ReturnType<typeof createAgent>['runWithStream']
  >;
}

/**
 * 任务执行允许的工具集合。
 *
 * 说明：
 * - read/grep：只读检查任务工作目录内的文件
 * - csv_inspect/excel_inspect：读取用户上传表格的列名与预览数据
 * - csv_write/excel_write：允许在任务工作目录内生成派生文件（可选能力，避免使用通用 write/edit）
 *
 * 注意：不包含 `write`/`edit`/`bash`/`webfetch`，避免修改任意文件或执行任意命令。
 */
export const TASK_EXECUTION_TOOL_IDS = [
  'read',
  'grep',
  'csv_inspect',
  'excel_inspect',
  'csv_write',
  'excel_write',
] as const;

export function createTaskExecutionAgent(): TaskExecutionAgent {
  return createAgent().withToolsById([...TASK_EXECUTION_TOOL_IDS]) as unknown as TaskExecutionAgent;
}

function getToolHintByInputFilePath(inputFilePath: string): string {
  const lower = (inputFilePath || '').toLowerCase();
  const fileType = lower.endsWith('.xlsx') ? 'excel' : 'csv';
  return fileType === 'excel'
    ? '请优先使用 excel_inspect 读取 sheet、列名和预览数据。'
    : '请优先使用 csv_inspect 读取列名和预览数据。';
}

/**
 * user prompt: 任务的可变部分（具体任务字段）。
 */
export function buildTaskExecutionPrompt(task: Task): string {
  return [
    '你现在是任务执行器，只负责完成当前表格分析任务。',
    `任务名称：${task.name}`,
    `任务工作目录：${task.workspaceDir}`,
    `输入文件：${task.inputFilePath}`,
    `执行方式：${task.schedule} / ${task.scheduleTime}`,
    `分析目标：${task.analysisGoal || '生成结构化分析摘要'}`,
    '要求：',
    `- ${getToolHintByInputFilePath(task.inputFilePath)}`,
    '- 所有相对路径都以任务工作目录为根目录。',
    `- 可用工具仅限：${TASK_EXECUTION_TOOL_IDS.join(', ')}`,
    '- 最终回复必须是 Markdown，不要输出前言和工具调用解释。',
    '- Markdown 至少包含：一级标题、执行概览、关键发现、建议动作。',
    '- 如果识别到结构化数据，优先给出 Markdown 表格或列表摘要。',
    '- 如果文件不存在或内容无法解析，明确说明失败原因。'
  ].join('\n');
}

/**
 * system prompt: 通用规则 + 任务执行约束（稳定部分）。
 *
 * 说明：
 * - 这里把 base system 与任务执行约束拼接，避免在 app service 内分散拼接逻辑
 * - 仍允许上层通过 overrideSystem 注入更强约束（例如多租户、合规等）
 */
export async function buildTaskExecutionSystemPrompt(
  task: Task,
  overrideSystem?: string
): Promise<string> {
  const baseSystem = overrideSystem || (await getDefaultPrompt());
  return [
    baseSystem,
    '',
    '你现在运行在“表格任务工作台”的任务执行模式。',
    '边界：仅可操作任务工作目录内的文件；禁止修改仓库代码、禁止写入任务目录以外的路径。',
    `任务工作目录：${task.workspaceDir}`,
    `可用工具（白名单）：${TASK_EXECUTION_TOOL_IDS.join(', ')}`,
  ].join('\n');
}

