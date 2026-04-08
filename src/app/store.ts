import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppState, ChatMessage, KnowledgeItem, Task, ToolRecord } from './types.js';
import { BUILTIN_TOOL_CATALOG } from '../services/toolService.js';
import { getDataSubdir } from '../utils/paths.js';
import { formatScheduleTime } from './taskDraft.js';
import { getTaskWorkspaceDir } from './taskWorkspace.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.APP_DATA_DIR
  ? path.resolve(process.env.APP_DATA_DIR)
  : getDataSubdir('app');
const STATE_FILE = path.join(DATA_DIR, 'state.json');

function buildDefaultTools(now: string): ToolRecord[] {
  return BUILTIN_TOOL_CATALOG.map((tool) => ({
    id: tool.id,
    name: tool.name,
    type: tool.type,
    description: tool.description,
    status: 'active',
    createdAt: now,
    updatedAt: now
  }));
}

function buildDefaultKnowledge(now: string): KnowledgeItem[] {
  return [
    {
      id: 'knowledge-task-first',
      title: '表格任务约束',
      content: '当前桌面 Agent 支持 CSV 与 Excel 输入，统一输出 Markdown 报告。',
      category: '产品约束',
      tags: ['task-first', 'markdown'],
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'knowledge-report-spec',
      title: '报告结构建议',
      content: '报告至少包含执行概览、关键发现和建议动作，必要时补充数据预览表格。',
      category: '报告规范',
      tags: ['report', 'markdown'],
      createdAt: now,
      updatedAt: now
    }
  ];
}

function buildDefaultChatHistory(now: string): ChatMessage[] {
  return [
    {
      id: 'chat-bootstrap-assistant',
      role: 'assistant',
      content: '我是任务编辑助手，只帮助你创建和修改表格分析任务。',
      timestamp: now
    }
  ];
}

function createDefaultState(): AppState {
  const now = new Date().toISOString();
  return {
    tasks: [],
    runs: [],
    reports: [],
    tools: buildDefaultTools(now),
    knowledge: buildDefaultKnowledge(now),
    chatHistory: buildDefaultChatHistory(now),
    chatSettings: {
      model: 'MiniMax-M2.7-highspeed',
      temperature: 0.2,
      maxTokens: 4096
    }
  };
}

async function ensureStateFile(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(STATE_FILE);
  } catch {
    await fs.writeFile(STATE_FILE, JSON.stringify(createDefaultState(), null, 2), 'utf-8');
  }
}

function mergeBuiltinTools(existingTools: ToolRecord[]): ToolRecord[] {
  const now = new Date().toISOString();
  const toolMap = new Map(existingTools.map((tool) => [tool.id, tool]));

  for (const builtin of buildDefaultTools(now)) {
    if (!toolMap.has(builtin.id)) {
      toolMap.set(builtin.id, builtin);
    }
  }

  return Array.from(toolMap.values());
}

function normalizeState(partial: Partial<AppState> | null | undefined): AppState {
  const defaults = createDefaultState();
  return {
    tasks: (partial?.tasks ?? defaults.tasks).map((task) => normalizeTask(task)),
    runs: partial?.runs ?? defaults.runs,
    reports: partial?.reports ?? defaults.reports,
    tools: mergeBuiltinTools(partial?.tools ?? defaults.tools),
    knowledge: partial?.knowledge ?? defaults.knowledge,
    chatHistory: partial?.chatHistory ?? defaults.chatHistory,
    chatSettings: {
      ...defaults.chatSettings,
      ...(partial?.chatSettings || {})
    }
  };
}

function normalizeTask(task: Task): Task {
  const legacySchedule = (task as { schedule?: string }).schedule;
  const normalizedSchedule = (
    legacySchedule === 'once' ? 'manual' : (legacySchedule || 'manual')
  ) as Task['schedule'];
  const scheduleConfig = task.scheduleConfig || {};

  return {
    ...task,
    schedule: normalizedSchedule,
    workspaceDir: task.workspaceDir || getTaskWorkspaceDir(task.id),
    uploadedFiles: task.uploadedFiles || [],
    scheduleConfig,
    scheduleTime: task.scheduleTime || formatScheduleTime(normalizedSchedule, scheduleConfig)
  };
}

export async function readAppState(): Promise<AppState> {
  await ensureStateFile();
  try {
    const content = await fs.readFile(STATE_FILE, 'utf-8');
    return normalizeState(JSON.parse(content) as Partial<AppState>);
  } catch {
    const fallback = createDefaultState();
    await writeAppState(fallback);
    return fallback;
  }
}

export async function writeAppState(state: AppState): Promise<void> {
  await ensureStateFile();
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

export async function updateAppState<T>(updater: (state: AppState) => T | Promise<T>): Promise<T> {
  const state = await readAppState();
  const result = await updater(state);
  await writeAppState(state);
  return result;
}

export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
