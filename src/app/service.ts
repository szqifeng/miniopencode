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
import { createAgent } from '../agent/index.js';
import { getDefaultPrompt } from '../agent/prompts.js';
import type { LLMRes } from '../agent/llm.js';

type TaskPayload = Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'outputFormat'>>;
type ToolPayload = Partial<Omit<ToolRecord, 'id' | 'createdAt' | 'updatedAt'>>;
type KnowledgePayload = Partial<Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt'>>;

function defaultScheduleTime(schedule: Task['schedule']): string {
  if (schedule === 'weekly') {
    return '周一 09:00';
  }
  if (schedule === 'daily') {
    return '09:00';
  }
  return '立即执行';
}

function computeNextRunAt(task: Task, from = new Date()): string | undefined {
  if (task.schedule === 'once') {
    return undefined;
  }

  const next = new Date(from);
  if (task.schedule === 'daily') {
    next.setUTCDate(next.getUTCDate() + 1);
  } else if (task.schedule === 'weekly') {
    next.setUTCDate(next.getUTCDate() + 7);
  }

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
  const fileType = task.inputFilePath.toLowerCase().endsWith('.xlsx') ? 'excel' : 'csv';
  const toolHint = fileType === 'excel'
    ? '请优先使用 excel_inspect 读取 sheet、列名和预览数据。'
    : '请优先使用 csv_inspect 读取列名和预览数据。';

  return [
    '你现在是任务执行器，只负责完成当前表格分析任务。',
    `任务名称：${task.name}`,
    `输入文件：${task.inputFilePath}`,
    `执行方式：${task.schedule} / ${task.scheduleTime || defaultScheduleTime(task.schedule)}`,
    `分析目标：${task.analysisGoal || '生成结构化分析摘要'}`,
    '要求：',
    `- ${toolHint}`,
    '- 可以在必要时使用 read、grep、excel_write、csv_write 等工具补充检查或输出结果。',
    '- 最终回复必须是 Markdown，不要输出前言和工具调用解释。',
    '- Markdown 至少包含：一级标题、执行概览、关键发现、建议动作。',
    '- 如果识别到结构化数据，优先给出 Markdown 表格或列表摘要。',
    '- 如果文件不存在或内容无法解析，明确说明失败原因。'
  ].join('\n');
}

async function runTaskWithAgent(task: Task, runId: string): Promise<string> {
  if (process.env.MOCK_TASK_RUN_RESULT) {
    return process.env.MOCK_TASK_RUN_RESULT;
  }

  const agent = createAgent();
  const sink: LLMRes = {
    write: () => true,
    end: () => {}
  };
  const baseSystem = await getDefaultPrompt();
  const result = await agent.runWithStream({
    messages: [
      {
        role: 'user',
        content: getTaskExecutionPrompt(task)
      }
    ],
    system: `${baseSystem}\n\n${getTaskExecutionPrompt(task)}`,
    res: sink,
    maxLoops: 30,
    sessionId: `task_run_${runId}`,
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

  return updateAppState((state) => {
    const now = new Date().toISOString();
    const schedule = payload.schedule || 'once';
    const task: Task = {
      id: generateId('task'),
      name: payload.name || '',
      inputFilePath: payload.inputFilePath || '',
      schedule,
      scheduleTime: payload.scheduleTime || defaultScheduleTime(schedule),
      status: payload.status || 'active',
      analysisGoal: payload.analysisGoal || '',
      outputFormat: 'markdown',
      createdAt: now,
      updatedAt: now
    };

    task.nextRunAt = task.status === 'active' ? computeNextRunAt(task) : undefined;
    state.tasks.unshift(task);
    return task;
  });
}

export async function updateTask(id: string, payload: TaskPayload): Promise<Task> {
  assertTaskPayload(payload, true);

  return updateAppState((state) => {
    const task = state.tasks.find((item) => item.id === id);
    if (!task) {
      throw new Error('任务不存在');
    }

    const nextSchedule = payload.schedule || task.schedule;
    task.name = payload.name ?? task.name;
    task.inputFilePath = payload.inputFilePath ?? task.inputFilePath;
    task.schedule = nextSchedule;
    task.scheduleTime = payload.scheduleTime ?? task.scheduleTime ?? defaultScheduleTime(nextSchedule);
    task.status = payload.status ?? task.status;
    task.analysisGoal = payload.analysisGoal ?? task.analysisGoal;
    task.outputFormat = 'markdown';
    task.updatedAt = new Date().toISOString();
    task.nextRunAt = task.status === 'active' ? computeNextRunAt(task) : undefined;
    return task;
  });
}

export async function deleteTask(id: string): Promise<boolean> {
  return updateAppState((state) => {
    const taskIndex = state.tasks.findIndex((task) => task.id === id);
    if (taskIndex === -1) {
      return false;
    }

    state.tasks.splice(taskIndex, 1);
    state.runs = state.runs.filter((run) => run.taskId !== id);
    state.reports = state.reports.filter((report) => report.taskId !== id);
    return true;
  });
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
      task.status = 'active';
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
