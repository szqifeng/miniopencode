import { generateId, readAppState, updateAppState } from './store.js';
import { createAgent } from '../agent/index.js';
import { getDefaultPrompt } from '../agent/prompts.js';
import { deleteTaskWorkspace, ensureTaskWorkspace } from './taskWorkspace.js';
import { formatScheduleTime, resolveTaskDraft as resolveTaskDraftWithAI } from './taskDraft.js';
function isTaskEnabledStatus(status) {
    return status === 'active' || status === 'completed';
}
function computeNextRunAt(task, from = new Date()) {
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
function assertTaskPayload(payload, partial = false) {
    const requiredFields = ['name', 'inputFilePath', 'analysisGoal'];
    for (const field of requiredFields) {
        if (!partial && !payload[field]) {
            throw new Error(`缺少必填字段: ${field}`);
        }
    }
    if (payload.inputFilePath && !/\.(csv|xlsx)$/i.test(payload.inputFilePath)) {
        throw new Error('当前仅支持 CSV 或 XLSX 文件');
    }
}
function sortByDateDesc(items) {
    return [...items].sort((a, b) => {
        const left = a.updatedAt || a.createdAt || a.startedAt || '';
        const right = b.updatedAt || b.createdAt || b.startedAt || '';
        return new Date(right).getTime() - new Date(left).getTime();
    });
}
function getTaskExecutionPrompt(task) {
    const fileType = task.inputFilePath.toLowerCase().endsWith('.xlsx') ? 'excel' : 'csv';
    const toolHint = fileType === 'excel'
        ? '请优先使用 excel_inspect 读取 sheet、列名和预览数据。'
        : '请优先使用 csv_inspect 读取列名和预览数据。';
    return [
        '你现在是任务执行器，只负责完成当前表格分析任务。',
        `任务名称：${task.name}`,
        `任务工作目录：${task.workspaceDir}`,
        `输入文件：${task.inputFilePath}`,
        `执行方式：${task.schedule} / ${task.scheduleTime || formatScheduleTime(task.schedule, task.scheduleConfig)}`,
        `分析目标：${task.analysisGoal || '生成结构化分析摘要'}`,
        '要求：',
        `- ${toolHint}`,
        '- 所有相对路径都以任务工作目录为根目录。',
        '- 可以在必要时使用 read、grep、excel_write、csv_write 等工具补充检查或输出结果。',
        '- 最终回复必须是 Markdown，不要输出前言和工具调用解释。',
        '- Markdown 至少包含：一级标题、执行概览、关键发现、建议动作。',
        '- 如果识别到结构化数据，优先给出 Markdown 表格或列表摘要。',
        '- 如果文件不存在或内容无法解析，明确说明失败原因。'
    ].join('\n');
}
async function runTaskWithAgent(task, runId) {
    if (process.env.MOCK_TASK_RUN_RESULT) {
        return process.env.MOCK_TASK_RUN_RESULT;
    }
    const agent = createAgent();
    const sink = {
        write: () => true,
        end: () => { }
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
        workspaceDir: task.workspaceDir,
        addMessage: async () => { }
    });
    if (!result.text.trim()) {
        throw new Error('模型没有返回可用的 Markdown 报告');
    }
    return result.text.trim();
}
export async function listTasks() {
    const state = await readAppState();
    return sortByDateDesc(state.tasks);
}
export async function getTaskById(id) {
    const state = await readAppState();
    return state.tasks.find((task) => task.id === id) || null;
}
export async function createTask(payload) {
    assertTaskPayload(payload);
    return updateAppState(async (state) => {
        const now = new Date().toISOString();
        const id = payload.id || generateId('task');
        const schedule = payload.schedule || 'manual';
        const workspaceDir = payload.workspaceDir || await ensureTaskWorkspace(id);
        const task = {
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
            outputFormat: 'markdown',
            createdAt: now,
            updatedAt: now
        };
        task.nextRunAt = isTaskEnabledStatus(task.status) ? computeNextRunAt(task) : undefined;
        state.tasks.unshift(task);
        return task;
    });
}
export async function resolveTaskDraftInput(params) {
    return resolveTaskDraftWithAI(params);
}
export async function updateTask(id, payload) {
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
        task.outputFormat = 'markdown';
        task.updatedAt = new Date().toISOString();
        task.nextRunAt = isTaskEnabledStatus(task.status) ? computeNextRunAt(task) : undefined;
        return task;
    });
}
export async function deleteTask(id) {
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
export async function enableTask(id) {
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
export async function disableTask(id) {
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
export async function executeTask(id) {
    const startedAt = new Date().toISOString();
    let taskSnapshot = null;
    const runningRun = await updateAppState((state) => {
        const task = state.tasks.find((item) => item.id === id);
        if (!task) {
            throw new Error('任务不存在');
        }
        taskSnapshot = { ...task };
        const run = {
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
        const reportMarkdown = await runTaskWithAgent(taskSnapshot, runningRun.id);
        const finishedAt = new Date().toISOString();
        const report = {
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
    }
    catch (error) {
        const finishedAt = new Date().toISOString();
        const errorMessage = error.message || '任务执行失败';
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
export async function executeTaskWithStream(id, res) {
    const startedAt = new Date().toISOString();
    let taskSnapshot = null;
    const runningRun = await updateAppState((state) => {
        const task = state.tasks.find((item) => item.id === id);
        if (!task) {
            throw new Error('任务不存在');
        }
        taskSnapshot = { ...task };
        const run = {
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
        const agent = createAgent();
        const baseSystem = await getDefaultPrompt();
        const result = await agent.runWithStream({
            messages: [
                {
                    role: 'user',
                    content: getTaskExecutionPrompt(taskSnapshot)
                }
            ],
            system: `${baseSystem}\n\n${getTaskExecutionPrompt(taskSnapshot)}`,
            res,
            maxLoops: 30,
            sessionId: `task_run_${runningRun.id}`,
            workspaceDir: taskSnapshot.workspaceDir,
            addMessage: async () => { }
        });
        if (!result.text.trim()) {
            throw new Error('模型没有返回可用的 Markdown 报告');
        }
        const finishedAt = new Date().toISOString();
        const report = {
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
    }
    catch (error) {
        const finishedAt = new Date().toISOString();
        const errorMessage = error.message || '任务执行失败';
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
export async function listRuns() {
    const state = await readAppState();
    return sortByDateDesc(state.runs);
}
export async function getRunById(id) {
    const state = await readAppState();
    return state.runs.find((run) => run.id === id) || null;
}
export async function listTaskRuns(taskId) {
    const state = await readAppState();
    return sortByDateDesc(state.runs.filter((run) => run.taskId === taskId));
}
export async function listReports() {
    const state = await readAppState();
    return sortByDateDesc(state.reports);
}
export async function getReportById(id) {
    const state = await readAppState();
    return state.reports.find((report) => report.id === id) || null;
}
export async function listTaskReports(taskId) {
    const state = await readAppState();
    return sortByDateDesc(state.reports.filter((report) => report.taskId === taskId));
}
export async function listTools() {
    const state = await readAppState();
    return sortByDateDesc(state.tools);
}
export async function getToolById(id) {
    const state = await readAppState();
    return state.tools.find((tool) => tool.id === id) || null;
}
export async function createTool(payload) {
    if (!payload.name || !payload.type) {
        throw new Error('工具名称和类型不能为空');
    }
    return updateAppState((state) => {
        const now = new Date().toISOString();
        const tool = {
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
export async function updateTool(id, payload) {
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
export async function deleteTool(id) {
    return updateAppState((state) => {
        const index = state.tools.findIndex((tool) => tool.id === id);
        if (index === -1) {
            return false;
        }
        state.tools.splice(index, 1);
        return true;
    });
}
export async function listKnowledge() {
    const state = await readAppState();
    return sortByDateDesc(state.knowledge);
}
export async function getKnowledgeById(id) {
    const state = await readAppState();
    return state.knowledge.find((item) => item.id === id) || null;
}
export async function createKnowledge(payload) {
    if (!payload.title || !payload.content) {
        throw new Error('标题和内容不能为空');
    }
    return updateAppState((state) => {
        const now = new Date().toISOString();
        const item = {
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
export async function updateKnowledge(id, payload) {
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
export async function deleteKnowledge(id) {
    return updateAppState((state) => {
        const index = state.knowledge.findIndex((item) => item.id === id);
        if (index === -1) {
            return false;
        }
        state.knowledge.splice(index, 1);
        return true;
    });
}
export async function getChatHistory(limit = 20) {
    const state = await readAppState();
    return state.chatHistory.slice(-limit);
}
export async function appendChatMessage(message) {
    return updateAppState((state) => {
        const item = {
            id: generateId('chat'),
            role: message.role,
            content: message.content,
            timestamp: new Date().toISOString()
        };
        state.chatHistory.push(item);
        return item;
    });
}
export async function getChatSettings() {
    const state = await readAppState();
    return state.chatSettings;
}
export async function updateChatSettings(payload) {
    return updateAppState((state) => {
        state.chatSettings = {
            ...state.chatSettings,
            ...payload
        };
        return state.chatSettings;
    });
}
export async function getAppSnapshot() {
    return readAppState();
}
