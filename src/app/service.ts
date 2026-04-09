import type {
  AppState,
  ChatMessage,
  ChatSettings,
  KnowledgeItem,
  Report,
  Run,
  Task,
  ToolRecord
} from './types.js';
import { generateId, readAppState, updateAppState } from './store.js';
import type { LLMRes } from '../agent/llm.js';
import { deleteTaskWorkspace, ensureTaskWorkspace } from './taskWorkspace.js';
import { formatScheduleTime, resolveTaskDraft as resolveTaskDraftWithAI } from './taskDraft.js';
import {
  buildTaskExecutionPrompt,
  buildTaskExecutionSystemPrompt,
  createTaskExecutionAgent
} from './taskExecutionAgent.js';
import { resolveTaskDraftBySessionId } from './taskDraftResolveService.js';

type TaskPayload = Partial<Omit<Task, 'createdAt' | 'updatedAt'>>;
type ToolPayload = Partial<Omit<ToolRecord, 'id' | 'createdAt' | 'updatedAt'>>;
type KnowledgePayload = Partial<Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'>>;

function isTaskEnabledStatus(status: Task['status']): boolean {
  return status === 'active' || status === 'completed';
}

function computeNextRunAt(task: Task, from = new Date()): string | undefined {
  if (!isTaskEnabledStatus(task.status) || task.schedule === 'manual') {
    return undefined;
  }

  const next = new Date(from);
  next.setSeconds(0, 0);

  if (task.schedule === 'hourly') {
    const minute = task.scheduleConfig?.minute ?? 0;
    next.setMinutes(minute, 0, 0);
    if (next.getTime() <= from.getTime()) {
      next.setHours(next.getHours() + 1);
    }
    return next.toISOString();
  }

  const [hoursText, minutesText] = (task.scheduleConfig?.time || '09:00').split(':');
  const hours = Number(hoursText || '9');
  const minutes = Number(minutesText || '0');
  next.setHours(hours, minutes, 0, 0);

  if (task.schedule === 'daily') {
    if (next.getTime() <= from.getTime()) {
      next.setDate(next.getDate() + 1);
    }
    return next.toISOString();
  }

  const targetDay = task.scheduleConfig?.weekday ?? 1;
  const currentDay = next.getDay();
  let daysToAdd = (targetDay - currentDay + 7) % 7;
  if (daysToAdd === 0 && next.getTime() <= from.getTime()) {
    daysToAdd = 7;
  }
  next.setDate(next.getDate() + daysToAdd);

  return next.toISOString();
}

function assertTaskPayload(payload: TaskPayload, partial = false): void {
  const requiredFields = ['name', 'inputFilePath', 'analysisGoal'] as const;

  for (const field of requiredFields) {
    if (!partial && !payload[field]) {
      throw new Error(`缺少必填字段: ${field}`);
    }
  }

  if (payload.inputFilePath && !/\.(csv|xlsx)$/i.test(payload.inputFilePath)) {
    throw new Error('当前仅支持 CSV 或 XLSX 文件');
  }
}

function sortByDateDesc<T extends { createdAt?: string; updatedAt?: string; startedAt?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const left = a.updatedAt || a.createdAt || a.startedAt || '';
    const right = b.updatedAt || b.createdAt || b.startedAt || '';
    return new Date(right).getTime() - new Date(left).getTime();
  });
}

function getTaskExecutionPrompt(task: Task): string {
  // 兼容历史调用：本函数保留但委托给 app 级 prompt builder。
  // 新逻辑应优先使用 `buildTaskExecutionPrompt`，避免 service 内部拼接 prompt。
  const normalized: Task = {
    ...task,
    scheduleTime: task.scheduleTime || formatScheduleTime(task.schedule, task.scheduleConfig || {})
  };
  return buildTaskExecutionPrompt(normalized);
}

async function runTaskWithAgent(task: Task, runId: string): Promise<string> {
  if (process.env.MOCK_TASK_RUN_RESULT) {
    return process.env.MOCK_TASK_RUN_RESULT;
  }

  // 使用 app 模块下的“任务执行专用 agent”，避免直接依赖通用 agent 的默认全量工具集。
  const agent = createTaskExecutionAgent();
  const sink: LLMRes = {
    write: () => true,
    end: () => {}
  };
  const systemPrompt = await buildTaskExecutionSystemPrompt(task);
  const result = await agent.runWithStream({
    messages: [
      {
        role: 'user',
        content: getTaskExecutionPrompt(task)
      }
    ],
    system: `${systemPrompt}\n\n${getTaskExecutionPrompt(task)}`,
    res: sink,
    maxLoops: 30,
    sessionId: `task_run_${runId}`,
    workspaceDir: task.workspaceDir,
    addMessage: async () => {}
  });

  if (!result.text.trim()) {
    throw new Error('模型没有返回可用的 Markdown 报告');
  }

  return result.text.trim();
}

export async function listTasks(): Promise<Task[]> {
  const state = await readAppState();
  return sortByDateDesc(state.tasks);
}

export async function getTaskById(id: string): Promise<Task | null> {
  const state = await readAppState();
  return state.tasks.find((task) => task.id === id) || null;
}

export async function createTask(payload: TaskPayload): Promise<Task> {
  assertTaskPayload(payload);

  return updateAppState(async (state) => {
    const now = new Date().toISOString();
    const id = payload.id || generateId('task');
    const schedule = payload.schedule || 'manual';
    const workspaceDir = payload.workspaceDir || await ensureTaskWorkspace(id);
    const task: Task = {
      id,
      name: payload.name || '',
      inputFilePath: payload.inputFilePath || '',
      workspaceDir,
      uploadedFiles: payload.uploadedFiles || [],
      schedule,
      scheduleConfig: payload.scheduleConfig || {},
      scheduleTime: payload.scheduleTime || formatScheduleTime(schedule, payload.scheduleConfig || {}),
      status: payload.status || 'active',
      analysisGoal: payload.analysisGoal || '',
      outputFormat: payload.outputFormat || 'markdown',
      createdAt: now,
      updatedAt: now
    };

    task.nextRunAt = isTaskEnabledStatus(task.status) ? computeNextRunAt(task) : undefined;
    state.tasks.unshift(task);
    return task;
  });
}

export async function resolveTaskDraftInput(params: Parameters<typeof resolveTaskDraftWithAI>[0]) {
  return resolveTaskDraftWithAI(params);
}

/**
 * 任务草稿解析（基于会话存储）
 *
 * 设计：
 * - 前端调用聊天流接口后，服务端会把消息写入通用 session 存储（`src/agent/session.ts`）
 * - 前端随后只需携带 `sessionId` 调用 resolve 接口即可完成草稿解析
 */
export async function resolveTaskDraftFromSessionId(sessionId: string) {
  if (!sessionId) {
    throw new Error('sessionId is required');
  }
  // 当前先按“只传 sessionId”的协议实现；如需把 UI 草稿字段也纳入解析，可在此处补充 draft 入参（保持向后兼容）。
  return resolveTaskDraftBySessionId({ sessionId });
}

export async function updateTask(id: string, payload: TaskPayload): Promise<Task> {
  assertTaskPayload(payload, true);

  return updateAppState(async (state) => {
    const task = state.tasks.find((item) => item.id === id);
    if (!task) {
      throw new Error('任务不存在');
    }

    const nextSchedule = payload.schedule || task.schedule;
    const nextScheduleConfig = payload.scheduleConfig ?? task.scheduleConfig ?? {};
    task.workspaceDir = payload.workspaceDir ?? task.workspaceDir ?? await ensureTaskWorkspace(task.id);
    task.name = payload.name ?? task.name;
    task.inputFilePath = payload.inputFilePath ?? task.inputFilePath;
    task.uploadedFiles = payload.uploadedFiles ?? task.uploadedFiles ?? [];
    task.schedule = nextSchedule;
    task.scheduleConfig = nextScheduleConfig;
    task.scheduleTime = payload.scheduleTime ?? formatScheduleTime(nextSchedule, nextScheduleConfig);
    task.status = payload.status ?? task.status;
    task.analysisGoal = payload.analysisGoal ?? task.analysisGoal;
    task.outputFormat = payload.outputFormat ?? task.outputFormat ?? 'markdown';
    task.updatedAt = new Date().toISOString();
    task.nextRunAt = isTaskEnabledStatus(task.status) ? computeNextRunAt(task) : undefined;
    return task;
  });
}

export async function deleteTask(id: string): Promise<boolean> {
  const deleted = await updateAppState((state) => {
    const taskIndex = state.tasks.findIndex((task) => task.id === id);
    if (taskIndex === -1) {
      return false;
    }

    state.tasks.splice(taskIndex, 1);
    state.runs = state.runs.filter((run) => run.taskId !== id);
    state.reports = state.reports.filter((report) => report.taskId !== id);
    return true;
  });

  if (deleted) {
    await deleteTaskWorkspace(id);
  }

  return deleted;
}

export async function enableTask(id: string): Promise<Task> {
  return updateAppState((state) => {
    const task = state.tasks.find((item) => item.id === id);
    if (!task) {
      throw new Error('任务不存在');
    }

    task.status = 'active';
    task.updatedAt = new Date().toISOString();
    task.nextRunAt = computeNextRunAt(task);
    return task;
  });
}

export async function disableTask(id: string): Promise<Task> {
  return updateAppState((state) => {
    const task = state.tasks.find((item) => item.id === id);
    if (!task) {
      throw new Error('任务不存在');
    }

    task.status = 'paused';
    task.updatedAt = new Date().toISOString();
    task.nextRunAt = undefined;
    return task;
  });
}

export async function executeTask(id: string): Promise<{ run: Run; report: Report }> {
  const startedAt = new Date().toISOString();
  let taskSnapshot: Task | null = null;

  const runningRun = await updateAppState((state) => {
    const task = state.tasks.find((item) => item.id === id);
    if (!task) {
      throw new Error('任务不存在');
    }

    taskSnapshot = { ...task };

    const run: Run = {
      id: generateId('run'),
      taskId: task.id,
      status: 'running',
      startedAt
    };

    task.lastRunAt = startedAt;
    task.updatedAt = startedAt;
    state.runs.unshift(run);
    return run;
  });

  try {
    const reportMarkdown = await runTaskWithAgent(taskSnapshot as Task, runningRun.id);
    const finishedAt = new Date().toISOString();
    const report: Report = {
      id: generateId('report'),
      taskId: id,
      runId: runningRun.id,
      contentMarkdown: reportMarkdown,
      createdAt: finishedAt
    };

    const run = await updateAppState((state) => {
      const task = state.tasks.find((item) => item.id === id);
      const savedRun = state.runs.find((item) => item.id === runningRun.id);
      if (!task || !savedRun) {
        throw new Error('任务运行状态丢失');
      }

      savedRun.status = 'success';
      savedRun.reportId = report.id;
      savedRun.finishedAt = finishedAt;
      task.status = 'completed';
      task.lastRunAt = startedAt;
      task.nextRunAt = computeNextRunAt(task, new Date(finishedAt));
      task.updatedAt = finishedAt;
      state.reports.unshift(report);
      return savedRun;
    });

    return { run, report };
  } catch (error) {
    const finishedAt = new Date().toISOString();
    const errorMessage = (error as Error).message || '任务执行失败';

    await updateAppState((state) => {
      const task = state.tasks.find((item) => item.id === id);
      const savedRun = state.runs.find((item) => item.id === runningRun.id);
      if (task) {
        task.status = 'error';
        task.lastRunAt = startedAt;
        task.updatedAt = finishedAt;
      }
      if (savedRun) {
        savedRun.status = 'failed';
        savedRun.finishedAt = finishedAt;
        savedRun.errorMessage = errorMessage;
      }
    });

    throw error;
  }
}

export async function executeTaskWithStream(
  id: string,
  res: LLMRes
): Promise<{ run: Run; report: Report }> {
  const startedAt = new Date().toISOString();
  let taskSnapshot: Task | null = null;

  const runningRun = await updateAppState((state) => {
    const task = state.tasks.find((item) => item.id === id);
    if (!task) {
      throw new Error('任务不存在');
    }

    taskSnapshot = { ...task };

    const run: Run = {
      id: generateId('run'),
      taskId: task.id,
      status: 'running',
      startedAt
    };

    task.lastRunAt = startedAt;
    task.updatedAt = startedAt;
    state.runs.unshift(run);
    return run;
  });

  try {
    const agent = createTaskExecutionAgent();
    const systemPrompt = await buildTaskExecutionSystemPrompt(taskSnapshot as Task);
    const result = await agent.runWithStream({
      messages: [
        {
          role: 'user',
          content: getTaskExecutionPrompt(taskSnapshot as Task)
        }
      ],
      system: `${systemPrompt}\n\n${getTaskExecutionPrompt(taskSnapshot as Task)}`,
      res,
      maxLoops: 30,
      sessionId: `task_run_${runningRun.id}`,
      workspaceDir: (taskSnapshot as Task).workspaceDir,
      addMessage: async () => {}
    });

    if (!result.text.trim()) {
      throw new Error('模型没有返回可用的 Markdown 报告');
    }

    const finishedAt = new Date().toISOString();
    const report: Report = {
      id: generateId('report'),
      taskId: id,
      runId: runningRun.id,
      contentMarkdown: result.text.trim(),
      createdAt: finishedAt
    };

    const run = await updateAppState((state) => {
      const task = state.tasks.find((item) => item.id === id);
      const savedRun = state.runs.find((item) => item.id === runningRun.id);
      if (!task || !savedRun) {
        throw new Error('任务运行状态丢失');
      }

      savedRun.status = 'success';
      savedRun.reportId = report.id;
      savedRun.finishedAt = finishedAt;
      task.status = 'completed';
      task.lastRunAt = startedAt;
      task.nextRunAt = computeNextRunAt(task, new Date(finishedAt));
      task.updatedAt = finishedAt;
      state.reports.unshift(report);
      return savedRun;
    });

    return { run, report };
  } catch (error) {
    const finishedAt = new Date().toISOString();
    const errorMessage = (error as Error).message || '任务执行失败';

    await updateAppState((state) => {
      const task = state.tasks.find((item) => item.id === id);
      const savedRun = state.runs.find((item) => item.id === runningRun.id);
      if (task) {
        task.status = 'error';
        task.lastRunAt = startedAt;
        task.updatedAt = finishedAt;
      }
      if (savedRun) {
        savedRun.status = 'failed';
        savedRun.finishedAt = finishedAt;
        savedRun.errorMessage = errorMessage;
      }
    });

    throw error;
  }
}

export async function listRuns(): Promise<Run[]> {
  const state = await readAppState();
  return sortByDateDesc(state.runs);
}

export async function getRunById(id: string): Promise<Run | null> {
  const state = await readAppState();
  return state.runs.find((run) => run.id === id) || null;
}

export async function listTaskRuns(taskId: string): Promise<Run[]> {
  const state = await readAppState();
  return sortByDateDesc(state.runs.filter((run) => run.taskId === taskId));
}

export async function listReports(): Promise<Report[]> {
  const state = await readAppState();
  return sortByDateDesc(state.reports);
}

export async function getReportById(id: string): Promise<Report | null> {
  const state = await readAppState();
  return state.reports.find((report) => report.id === id) || null;
}

export async function listTaskReports(taskId: string): Promise<Report[]> {
  const state = await readAppState();
  return sortByDateDesc(state.reports.filter((report) => report.taskId === taskId));
}

export async function listTools(): Promise<ToolRecord[]> {
  const state = await readAppState();
  return sortByDateDesc(state.tools);
}

export async function getToolById(id: string): Promise<ToolRecord | null> {
  const state = await readAppState();
  return state.tools.find((tool) => tool.id === id) || null;
}

export async function createTool(payload: ToolPayload): Promise<ToolRecord> {
  if (!payload.name || !payload.type) {
    throw new Error('工具名称和类型不能为空');
  }

  return updateAppState((state) => {
    const now = new Date().toISOString();
    const tool: ToolRecord = {
      id: generateId('tool'),
      name: payload.name || '',
      type: payload.type || 'script',
      description: payload.description || '',
      status: payload.status || 'active',
      createdAt: now,
      updatedAt: now
    };

    state.tools.unshift(tool);
    return tool;
  });
}

export async function updateTool(id: string, payload: ToolPayload): Promise<ToolRecord> {
  return updateAppState((state) => {
    const tool = state.tools.find((item) => item.id === id);
    if (!tool) {
      throw new Error('工具不存在');
    }

    tool.name = payload.name ?? tool.name;
    tool.type = payload.type ?? tool.type;
    tool.description = payload.description ?? tool.description;
    tool.status = payload.status ?? tool.status;
    tool.updatedAt = new Date().toISOString();
    return tool;
  });
}

export async function deleteTool(id: string): Promise<boolean> {
  return updateAppState((state) => {
    const index = state.tools.findIndex((tool) => tool.id === id);
    if (index === -1) {
      return false;
    }
    state.tools.splice(index, 1);
    return true;
  });
}

export async function listKnowledge(): Promise<KnowledgeItem[]> {
  const state = await readAppState();
  return sortByDateDesc(state.knowledge);
}

export async function getKnowledgeById(id: string): Promise<KnowledgeItem | null> {
  const state = await readAppState();
  return state.knowledge.find((item) => item.id === id) || null;
}

export async function createKnowledge(payload: KnowledgePayload): Promise<KnowledgeItem> {
  if (!payload.title || !payload.content) {
    throw new Error('标题和内容不能为空');
  }

  return updateAppState((state) => {
    const now = new Date().toISOString();
    const item: KnowledgeItem = {
      id: generateId('knowledge'),
      title: payload.title || '',
      content: payload.content || '',
      category: payload.category,
      tags: payload.tags || [],
      createdAt: now,
      updatedAt: now
    };

    state.knowledge.unshift(item);
    return item;
  });
}

export async function updateKnowledge(id: string, payload: KnowledgePayload): Promise<KnowledgeItem> {
  return updateAppState((state) => {
    const item = state.knowledge.find((entry) => entry.id === id);
    if (!item) {
      throw new Error('知识不存在');
    }

    item.title = payload.title ?? item.title;
    item.content = payload.content ?? item.content;
    item.category = payload.category ?? item.category;
    item.tags = payload.tags ?? item.tags;
    item.updatedAt = new Date().toISOString();
    return item;
  });
}

export async function deleteKnowledge(id: string): Promise<boolean> {
  return updateAppState((state) => {
    const index = state.knowledge.findIndex((item) => item.id === id);
    if (index === -1) {
      return false;
    }
    state.knowledge.splice(index, 1);
    return true;
  });
}

export async function getChatHistory(limit = 20): Promise<ChatMessage[]> {
  const state = await readAppState();
  return state.chatHistory.slice(-limit);
}

export async function appendChatMessage(message: Omit<ChatMessage, 'id' | 'timestamp'>): Promise<ChatMessage> {
  return updateAppState((state) => {
    const item: ChatMessage = {
      id: generateId('chat'),
      role: message.role,
      content: message.content,
      timestamp: new Date().toISOString()
    };
    state.chatHistory.push(item);
    return item;
  });
}

export async function getChatSettings(): Promise<ChatSettings> {
  const state = await readAppState();
  return state.chatSettings;
}

export async function updateChatSettings(payload: Partial<ChatSettings>): Promise<ChatSettings> {
  return updateAppState((state) => {
    state.chatSettings = {
      ...state.chatSettings,
      ...payload
    };
    return state.chatSettings;
  });
}

export async function getAppSnapshot(): Promise<AppState> {
  return readAppState();
}
