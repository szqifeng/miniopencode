import type { Tool, Task, Run, Report, ChatMessage, ChatSettings, KnowledgeItem } from '../services/types';

const mockTools: Tool[] = [
  { id: '1', name: '表格质量检查器', type: 'script', description: '扫描 CSV / XLSX 的空值、重复值与异常列。', status: 'active', createdAt: '2026-03-10T01:00:00Z', updatedAt: '2026-03-18T01:00:00Z' },
  { id: '2', name: '销售归因摘要器', type: 'script', description: '按区域与渠道汇总销售波动并输出摘要。', status: 'active', createdAt: '2026-03-11T01:00:00Z', updatedAt: '2026-03-20T01:00:00Z' },
  { id: '3', name: '库存波动比对器', type: 'script', description: '比对昨日与今日库存快照，生成差异报告。', status: 'active', createdAt: '2026-03-12T01:00:00Z', updatedAt: '2026-03-21T01:00:00Z' },
  { id: '4', name: '财务异常标注器', type: 'script', description: '定位金额波动与重复支出记录。', status: 'active', createdAt: '2026-03-13T01:00:00Z', updatedAt: '2026-03-24T01:00:00Z' },
];

const mockTasks: Task[] = [
  {
    id: '1',
    name: '销售周报摘要',
    inputFilePath: '/workspace/reports/sales-weekly.xlsx',
    schedule: 'weekly',
    scheduleTime: '周一 09:00',
    status: 'active',
    analysisGoal: '输出销售摘要、区域波动和重点异常门店。',
    outputFormat: 'markdown',
    lastRunAt: '2026-04-07T01:00:00Z',
    nextRunAt: '2026-04-14T01:00:00Z',
    createdAt: '2026-03-20T08:00:00Z',
    updatedAt: '2026-04-07T01:12:00Z',
  },
  {
    id: '2',
    name: '库存日报巡检',
    inputFilePath: '/workspace/reports/inventory-daily.csv',
    schedule: 'daily',
    scheduleTime: '18:00',
    status: 'active',
    analysisGoal: '输出缺货风险、积压 SKU 和仓库异常波动。',
    outputFormat: 'markdown',
    lastRunAt: '2026-04-07T10:00:00Z',
    nextRunAt: '2026-04-08T10:00:00Z',
    createdAt: '2026-03-21T08:00:00Z',
    updatedAt: '2026-04-07T10:05:00Z',
  },
  {
    id: '3',
    name: '财务快照复核',
    inputFilePath: '/workspace/reports/finance-snapshot.xlsx',
    schedule: 'once',
    scheduleTime: '立即执行',
    status: 'paused',
    analysisGoal: '输出费用异常、重复付款和大额偏差说明。',
    outputFormat: 'markdown',
    lastRunAt: '2026-04-05T03:30:00Z',
    createdAt: '2026-03-24T08:00:00Z',
    updatedAt: '2026-04-05T03:50:00Z',
  },
  {
    id: '4',
    name: '客诉归因追踪',
    inputFilePath: '/workspace/reports/complaints.csv',
    schedule: 'weekly',
    scheduleTime: '周三 14:00',
    status: 'error',
    analysisGoal: '归纳投诉主题、重复问题和需要人工复盘的案例。',
    outputFormat: 'markdown',
    lastRunAt: '2026-04-06T06:00:00Z',
    nextRunAt: '2026-04-13T06:00:00Z',
    createdAt: '2026-03-26T08:00:00Z',
    updatedAt: '2026-04-06T06:20:00Z',
  },
];

const mockRuns: Run[] = [
  { id: 'run-101', taskId: '1', status: 'success', reportId: 'report-101', startedAt: '2026-04-07T01:00:00Z', finishedAt: '2026-04-07T01:03:00Z' },
  { id: 'run-102', taskId: '1', status: 'success', reportId: 'report-102', startedAt: '2026-03-31T01:00:00Z', finishedAt: '2026-03-31T01:04:00Z' },
  { id: 'run-201', taskId: '2', status: 'success', reportId: 'report-201', startedAt: '2026-04-07T10:00:00Z', finishedAt: '2026-04-07T10:02:00Z' },
  { id: 'run-202', taskId: '2', status: 'failed', startedAt: '2026-04-06T10:00:00Z', finishedAt: '2026-04-06T10:01:20Z', errorMessage: '发现库存表缺少 `warehouse_id` 列。' },
  { id: 'run-301', taskId: '3', status: 'success', reportId: 'report-301', startedAt: '2026-04-05T03:30:00Z', finishedAt: '2026-04-05T03:37:00Z' },
  { id: 'run-401', taskId: '4', status: 'failed', startedAt: '2026-04-06T06:00:00Z', finishedAt: '2026-04-06T06:02:30Z', errorMessage: '原始文件编码异常，未能解析投诉内容列。' },
];

const mockReports: Report[] = [
  {
    id: 'report-101',
    taskId: '1',
    runId: 'run-101',
    contentMarkdown: '## 本周销售结论\n\n- 华东区销售额环比上涨 **12.4%**。\n- 3 家门店连续两周低于目标值，建议优先复盘促销节奏。\n- 渠道投放中，短视频渠道转化最好，但退货率也偏高。\n\n### 建议动作\n\n1. 复盘华南区退货率异常门店。\n2. 对低于目标值门店追加线下活动检查。\n3. 检查短视频活动的 SKU 组合是否过度促销。',
    createdAt: '2026-04-07T01:03:00Z',
  },
  {
    id: 'report-102',
    taskId: '1',
    runId: 'run-102',
    contentMarkdown: '## 上周销售结论\n\n- 区域销售基本稳定，北区客单价小幅回升。\n- 两个渠道的投放成本上涨，但未带来对应转化增量。\n- 建议下周重点观察新客转化链路。',
    createdAt: '2026-03-31T01:04:00Z',
  },
  {
    id: 'report-201',
    taskId: '2',
    runId: 'run-201',
    contentMarkdown: '## 库存日报\n\n- 今日新增缺货风险 SKU **18 个**。\n- 华北 2 号仓出现异常积压，主要集中在家清品类。\n- 运输延迟订单较昨日下降 **9%**。\n\n### 需要关注\n\n- SKU `HD-2031` 连续 3 天低于安全库存。\n- 建议同步采购侧确认补货节奏。',
    createdAt: '2026-04-07T10:02:00Z',
  },
  {
    id: 'report-301',
    taskId: '3',
    runId: 'run-301',
    contentMarkdown: '## 财务复核摘要\n\n- 识别到 4 笔可能重复付款。\n- 2 条费用记录与预算差异超过 **20%**。\n- 未发现新的大额异常支出。',
    createdAt: '2026-04-05T03:37:00Z',
  },
];

const mockKnowledge: KnowledgeItem[] = [
  { id: '1', title: '表格任务约束', content: '桌面 Agent 首版仅支持 CSV / XLSX 输入，并统一输出 Markdown 报告。', category: '产品约束', tags: ['Task First', 'Markdown'], createdAt: '2026-03-20T00:00:00Z', updatedAt: '2026-04-01T00:00:00Z' },
  { id: '2', title: '报告规范', content: '报告需包含结论、异常、建议动作三部分，避免输出冗长流水账。', category: '报告规范', tags: ['报告', '规范'], createdAt: '2026-03-22T00:00:00Z', updatedAt: '2026-04-01T00:00:00Z' },
];

const mockMessages: ChatMessage[] = [
  { id: '1', role: 'assistant', content: '我是任务编辑助手，只帮助你创建和修改表格分析任务。', timestamp: '2026-04-07T10:00:00Z' },
];

let chatSettings: ChatSettings = { model: 'gpt-4.1-mini', temperature: 0.2, maxTokens: 1200 };

const aiReplies = [
  '我已经把你的描述整理成结构化任务草稿了。',
  '收到，我会继续围绕任务配置更新预览。',
  '可以，当前聊天只会服务于任务创建和编辑。',
];

function addDuration(base: Date, minutes: number) {
  return new Date(base.getTime() + minutes * 60 * 1000).toISOString();
}

function getNextRunAt(task: Task, from = new Date()) {
  if (task.schedule === 'once') {
    return undefined;
  }

  const next = new Date(from);
  if (task.schedule === 'daily') {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  if (task.schedule === 'weekly') {
    next.setUTCDate(next.getUTCDate() + 7);
  }

  return next.toISOString();
}

function buildReportMarkdown(task: Task, runAt: Date) {
  return `## ${task.name}\n\n- 输入文件：\`${task.inputFilePath}\`\n- 任务目标：${task.analysisGoal || '生成结构化分析摘要'}\n- 输出格式：Markdown\n- 执行时间：${runAt.toISOString()}\n\n### 结论\n\n1. 本次任务已按配置完成扫描。\n2. 重点异常已被归纳为结构化摘要。\n3. 建议结合原始表格继续复核高风险记录。`;
}

export const mockHandlers = {
  'GET /api/tools': () => ({ success: true, data: mockTools, total: mockTools.length }),
  'GET /api/tools/:id': (params: { id: string }) => ({ success: true, data: mockTools.find(t => t.id === params.id) }),
  'POST /api/tools': (body: Partial<Tool>) => { const t: Tool = { id: String(mockTools.length + 1), name: body.name || '', type: body.type || 'script', description: body.description || '', status: body.status || 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; mockTools.push(t); return { success: true, data: t }; },
  'PUT /api/tools/:id': (params: { id: string }, body: Partial<Tool>) => { const idx = mockTools.findIndex(t => t.id === params.id); if (idx !== -1) { mockTools[idx] = { ...mockTools[idx], ...body, updatedAt: new Date().toISOString() }; return { success: true, data: mockTools[idx] }; } return { success: false, errorMessage: '工具不存在' }; },
  'DELETE /api/tools/:id': (params: { id: string }) => { const idx = mockTools.findIndex(t => t.id === params.id); if (idx !== -1) { mockTools.splice(idx, 1); return { success: true }; } return { success: false, errorMessage: '工具不存在' }; },

  'GET /api/tasks': () => ({ success: true, data: mockTasks, total: mockTasks.length }),
  'GET /api/tasks/:id': (params: { id: string }) => { const t = mockTasks.find(t => t.id === params.id); return t ? { success: true, data: t } : { success: false, errorMessage: '任务不存在' }; },
  'POST /api/tasks': (body: Partial<Task>) => {
    const now = new Date().toISOString();
    const t: Task = {
      id: String(mockTasks.length + 1),
      name: body.name || '',
      inputFilePath: body.inputFilePath || '',
      schedule: body.schedule || 'once',
      scheduleTime: body.scheduleTime || (body.schedule === 'weekly' ? '周一 09:00' : body.schedule === 'daily' ? '09:00' : '立即执行'),
      status: body.status || 'active',
      analysisGoal: body.analysisGoal || '生成结构化分析摘要',
      outputFormat: 'markdown',
      createdAt: now,
      updatedAt: now,
    };
    t.nextRunAt = getNextRunAt(t);
    mockTasks.unshift(t);
    return { success: true, data: t };
  },
  'PUT /api/tasks/:id': (params: { id: string }, body: Partial<Task>) => {
    const idx = mockTasks.findIndex(t => t.id === params.id);
    if (idx !== -1) {
      mockTasks[idx] = {
        ...mockTasks[idx],
        ...body,
        outputFormat: 'markdown',
        updatedAt: new Date().toISOString(),
      };
      mockTasks[idx].nextRunAt = getNextRunAt(mockTasks[idx]);
      return { success: true, data: mockTasks[idx] };
    }
    return { success: false, errorMessage: '任务不存在' };
  },
  'DELETE /api/tasks/:id': (params: { id: string }) => { const idx = mockTasks.findIndex(t => t.id === params.id); if (idx !== -1) { mockTasks.splice(idx, 1); return { success: true }; } return { success: false, errorMessage: '任务不存在' }; },
  'POST /api/tasks/:id/run': (params: { id: string }) => {
    const task = mockTasks.find(t => t.id === params.id);
    if (!task) {
      return { success: false, errorMessage: '任务不存在' };
    }

    const runAt = new Date();
    const runId = `run-${Date.now()}`;
    const reportId = `report-${Date.now()}`;
    const finishedAt = addDuration(runAt, 2);
    const run: Run = {
      id: runId,
      taskId: task.id,
      status: 'success',
      reportId,
      startedAt: runAt.toISOString(),
      finishedAt,
    };
    const report: Report = {
      id: reportId,
      taskId: task.id,
      runId,
      contentMarkdown: buildReportMarkdown(task, runAt),
      createdAt: finishedAt,
    };

    task.lastRunAt = run.startedAt;
    task.nextRunAt = getNextRunAt(task, new Date(finishedAt));
    task.updatedAt = finishedAt;
    if (task.status === 'error') {
      task.status = 'active';
    }

    mockRuns.unshift(run);
    mockReports.unshift(report);
    return { success: true, data: run };
  },
  'POST /api/tasks/:id/enable': (params: { id: string }) => { const t = mockTasks.find(t => t.id === params.id); if (t) { t.status = 'active'; t.nextRunAt = getNextRunAt(t); t.updatedAt = new Date().toISOString(); return { success: true, data: t }; } return { success: false, errorMessage: '任务不存在' }; },
  'POST /api/tasks/:id/disable': (params: { id: string }) => { const t = mockTasks.find(t => t.id === params.id); if (t) { t.status = 'paused'; t.updatedAt = new Date().toISOString(); return { success: true, data: t }; } return { success: false, errorMessage: '任务不存在' }; },

  'GET /api/runs': () => ({ success: true, data: mockRuns, total: mockRuns.length }),
  'GET /api/runs/:id': (params: { id: string }) => { const r = mockRuns.find(r => r.id === params.id); return r ? { success: true, data: r } : { success: false, errorMessage: '运行记录不存在' }; },
  'GET /api/tasks/:taskId/runs': (params: { taskId: string }) => ({ success: true, data: mockRuns.filter(r => r.taskId === params.taskId) }),

  'GET /api/reports': () => ({ success: true, data: mockReports, total: mockReports.length }),
  'GET /api/reports/:id': (params: { id: string }) => { const r = mockReports.find(r => r.id === params.id); return r ? { success: true, data: r } : { success: false, errorMessage: '报告不存在' }; },
  'GET /api/tasks/:taskId/reports': (params: { taskId: string }) => ({ success: true, data: mockReports.filter(r => r.taskId === params.taskId) }),

  'GET /api/knowledge': () => ({ success: true, data: mockKnowledge, total: mockKnowledge.length }),
  'GET /api/knowledge/:id': (params: { id: string }) => { const k = mockKnowledge.find(k => k.id === params.id); return k ? { success: true, data: k } : { success: false, errorMessage: '知识不存在' }; },
  'POST /api/knowledge': (body: Partial<KnowledgeItem>) => { const k: KnowledgeItem = { id: String(mockKnowledge.length + 1), title: body.title || '', content: body.content || '', category: body.category, tags: body.tags || [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; mockKnowledge.push(k); return { success: true, data: k }; },
  'PUT /api/knowledge/:id': (params: { id: string }, body: Partial<KnowledgeItem>) => { const idx = mockKnowledge.findIndex(k => k.id === params.id); if (idx !== -1) { mockKnowledge[idx] = { ...mockKnowledge[idx], ...body, updatedAt: new Date().toISOString() }; return { success: true, data: mockKnowledge[idx] }; } return { success: false, errorMessage: '知识不存在' }; },
  'DELETE /api/knowledge/:id': (params: { id: string }) => { const idx = mockKnowledge.findIndex(k => k.id === params.id); if (idx !== -1) { mockKnowledge.splice(idx, 1); return { success: true }; } return { success: false, errorMessage: '知识不存在' }; },

  'POST /api/chat': (_body: { message: string }) => { const reply = aiReplies[Math.floor(Math.random() * aiReplies.length)]; const m: ChatMessage = { id: String(mockMessages.length + 1), role: 'assistant', content: reply, timestamp: new Date().toISOString() }; mockMessages.push(m); return { success: true, data: { reply, timestamp: m.timestamp } }; },
  'GET /api/chat/history': (params: { limit?: number }) => { const limit = params.limit || 20; return { success: true, data: mockMessages.slice(-limit) }; },
  'GET /api/chat/settings': () => ({ success: true, data: chatSettings }),
  'PUT /api/chat/settings': (body: Partial<ChatSettings>) => { chatSettings = { ...chatSettings, ...body }; return { success: true, data: chatSettings }; },
};

export function setupMockServer() {
  const handleRequest = async (path: string, method: string, body?: any) => {
    const params: Record<string, string> = {};
    for (const pattern of Object.keys(mockHandlers)) {
      const [m, p] = pattern.split(' ');
      if (m !== method) continue;
      const regex = new RegExp('^' + p.replace(/:(\w+)/g, (_, key) => '(?<' + key + '>[^/]+)') + '$');
      const match = path.match(regex);
      if (match) {
        Object.assign(params, match.groups || {});
        const handler = (mockHandlers as any)[pattern];
        return handler(params, body);
      }
    }
    return { success: false, errorMessage: 'Not found' };
  };

  (window as any).mockFetch = async (url: string, options: RequestInit = {}) => {
    const urlObj = new URL(url, window.location.origin);
    const path = urlObj.pathname;
    const method = options.method || 'GET';
    const body = options.body ? JSON.parse(options.body as string) : undefined;
    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
    const result = await handleRequest(path, method, body);
    return { json: () => Promise.resolve(result) };
  };
}
