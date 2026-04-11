import express, { Request, Response } from 'express';
import type { LLMRes } from '../agent/llm.js';
import { getMessages as getAgentMessages, getSession as getAgentSession } from '../agent/session.js';
import { runTaskWorkbenchChatStream } from './chatStreamService.js';
import {
  appendChatMessage,
  createKnowledge,
  createTask,
  createTool,
  deleteKnowledge,
  deleteTask,
  deleteTool,
  disableTask,
  enableTask,
  executeTask,
  executeTaskWithStream,
  getChatHistory,
  getChatSettings,
  getKnowledgeById,
  getReportById,
  getRunById,
  getTaskById,
  getToolById,
  listKnowledge,
  listReports,
  listRuns,
  listTaskReports,
  listTaskRuns,
  listTasks,
  listTools,
  resolveTaskDraftInput,
  resolveTaskDraftFromSessionId,
  updateChatSettings,
  updateKnowledge,
  updateTask,
  updateTool
} from './service.js';
import { saveTaskUpload } from './taskWorkspace.js';

const router = express.Router();

function getParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] || '';
  }
  return value || '';
}

function sendSuccess<T>(res: Response, data?: T, total?: number): void {
  res.json({
    success: true,
    data,
    total
  });
}

function sendFailure(res: Response, errorMessage: string, status = 400): void {
  res.status(status).json({
    success: false,
    errorMessage
  });
}

function setupSSE(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
}

function flushSSE(res: Response): void {
  res.flushHeaders();
}

function setupChatStreamSSE(res: Response, sessionId: string): void {
  setupSSE(res);
  res.setHeader('X-Session-Id', sessionId);
  flushSSE(res);
}

router.get('/tasks', async (_req: Request, res: Response) => {
  const tasks = await listTasks();
  sendSuccess(res, tasks, tasks.length);
});

router.get('/tasks/:id', async (req: Request, res: Response) => {
  const task = await getTaskById(getParam(req.params.id));
  if (!task) {
    sendFailure(res, '任务不存在', 404);
    return;
  }
  sendSuccess(res, task);
});

router.post('/tasks', async (req: Request, res: Response) => {
  try {
    const task = await createTask(req.body);
    sendSuccess(res, task);
  } catch (error) {
    sendFailure(res, (error as Error).message);
  }
});

router.post('/tasks/draft/resolve', async (req: Request, res: Response) => {
  try {
    // 约定：先调用 `/api/web/chat/stream` 完成会话消息写入，再调用本接口触发草稿解析。
    // 本接口只接收 sessionId，具体对话内容从 session 存储中读取。
    const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId : '';
    const result = await resolveTaskDraftFromSessionId(sessionId);
    sendSuccess(res, result);
  } catch (error) {
    sendFailure(res, (error as Error).message || '任务草稿解析失败', 500);
  }
});

router.post(
  '/tasks/:id/files',
  express.raw({ type: () => true, limit: '50mb' }),
  async (req: Request, res: Response) => {
    try {
      const taskId = getParam(req.params.id);
      const fileNameHeader = req.header('x-file-name');
      const fileName = fileNameHeader ? decodeURIComponent(fileNameHeader) : '';
      if (!taskId) {
        sendFailure(res, '任务 ID 不能为空');
        return;
      }
      if (!fileName) {
        sendFailure(res, '缺少文件名');
        return;
      }
      if (!/\.(csv|xlsx)$/i.test(fileName)) {
        sendFailure(res, '当前仅支持 CSV 或 XLSX 文件');
        return;
      }
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        sendFailure(res, '上传内容不能为空');
        return;
      }

      const result = await saveTaskUpload(taskId, fileName, req.body);
      sendSuccess(res, {
        taskId,
        workspaceDir: result.workspaceDir,
        inputFilePath: result.inputFilePath,
        file: result.file
      });
    } catch (error) {
      sendFailure(res, (error as Error).message || '文件上传失败', 500);
    }
  }
);

router.put('/tasks/:id', async (req: Request, res: Response) => {
  try {
    const task = await updateTask(getParam(req.params.id), req.body);
    sendSuccess(res, task);
  } catch (error) {
    sendFailure(res, (error as Error).message, (error as Error).message === '任务不存在' ? 404 : 400);
  }
});

router.delete('/tasks/:id', async (req: Request, res: Response) => {
  const deleted = await deleteTask(getParam(req.params.id));
  if (!deleted) {
    sendFailure(res, '任务不存在', 404);
    return;
  }
  sendSuccess(res);
});

router.post('/tasks/:id/run', async (req: Request, res: Response) => {
  try {
    const result = await executeTask(getParam(req.params.id));
    sendSuccess(res, result.run);
  } catch (error) {
    sendFailure(res, (error as Error).message || '任务执行失败', 500);
  }
});

router.post('/tasks/:id/run/stream', async (req: Request, res: Response) => {
  try {
    setupSSE(res);
    flushSSE(res);
    const llmRes = {
      write: (data: string) => res.write(data),
      end: () => {
        res.end();
      }
    };
    await executeTaskWithStream(getParam(req.params.id), llmRes);
  } catch (error) {
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: (error as Error).message || '任务执行失败' })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }
    sendFailure(res, (error as Error).message || '任务执行失败', 500);
  }
});

router.post('/tasks/:id/enable', async (req: Request, res: Response) => {
  try {
    const task = await enableTask(getParam(req.params.id));
    sendSuccess(res, task);
  } catch (error) {
    sendFailure(res, (error as Error).message, 404);
  }
});

router.post('/tasks/:id/disable', async (req: Request, res: Response) => {
  try {
    const task = await disableTask(getParam(req.params.id));
    sendSuccess(res, task);
  } catch (error) {
    sendFailure(res, (error as Error).message, 404);
  }
});

router.get('/tasks/:taskId/runs', async (req: Request, res: Response) => {
  const runs = await listTaskRuns(getParam(req.params.taskId));
  sendSuccess(res, runs, runs.length);
});

router.get('/tasks/:taskId/reports', async (req: Request, res: Response) => {
  const reports = await listTaskReports(getParam(req.params.taskId));
  sendSuccess(res, reports, reports.length);
});

router.get('/runs', async (_req: Request, res: Response) => {
  const runs = await listRuns();
  sendSuccess(res, runs, runs.length);
});

router.get('/runs/:id', async (req: Request, res: Response) => {
  const run = await getRunById(getParam(req.params.id));
  if (!run) {
    sendFailure(res, '运行记录不存在', 404);
    return;
  }
  sendSuccess(res, run);
});

router.get('/reports', async (_req: Request, res: Response) => {
  const reports = await listReports();
  sendSuccess(res, reports, reports.length);
});

router.get('/reports/:id', async (req: Request, res: Response) => {
  const report = await getReportById(getParam(req.params.id));
  if (!report) {
    sendFailure(res, '报告不存在', 404);
    return;
  }
  sendSuccess(res, report);
});

router.get('/tools', async (_req: Request, res: Response) => {
  const tools = await listTools();
  sendSuccess(res, tools, tools.length);
});

router.get('/tools/:id', async (req: Request, res: Response) => {
  const tool = await getToolById(getParam(req.params.id));
  if (!tool) {
    sendFailure(res, '工具不存在', 404);
    return;
  }
  sendSuccess(res, tool);
});

router.post('/tools', async (req: Request, res: Response) => {
  try {
    const tool = await createTool(req.body);
    sendSuccess(res, tool);
  } catch (error) {
    sendFailure(res, (error as Error).message);
  }
});

router.put('/tools/:id', async (req: Request, res: Response) => {
  try {
    const tool = await updateTool(getParam(req.params.id), req.body);
    sendSuccess(res, tool);
  } catch (error) {
    sendFailure(res, (error as Error).message, 404);
  }
});

router.delete('/tools/:id', async (req: Request, res: Response) => {
  const deleted = await deleteTool(getParam(req.params.id));
  if (!deleted) {
    sendFailure(res, '工具不存在', 404);
    return;
  }
  sendSuccess(res);
});

router.get('/knowledge', async (_req: Request, res: Response) => {
  const items = await listKnowledge();
  sendSuccess(res, items, items.length);
});

router.get('/knowledge/:id', async (req: Request, res: Response) => {
  const item = await getKnowledgeById(getParam(req.params.id));
  if (!item) {
    sendFailure(res, '知识不存在', 404);
    return;
  }
  sendSuccess(res, item);
});

router.post('/knowledge', async (req: Request, res: Response) => {
  try {
    const item = await createKnowledge(req.body);
    sendSuccess(res, item);
  } catch (error) {
    sendFailure(res, (error as Error).message);
  }
});

router.put('/knowledge/:id', async (req: Request, res: Response) => {
  try {
    const item = await updateKnowledge(getParam(req.params.id), req.body);
    sendSuccess(res, item);
  } catch (error) {
    sendFailure(res, (error as Error).message, 404);
  }
});

router.delete('/knowledge/:id', async (req: Request, res: Response) => {
  const deleted = await deleteKnowledge(getParam(req.params.id));
  if (!deleted) {
    sendFailure(res, '知识不存在', 404);
    return;
  }
  sendSuccess(res);
});

router.post('/chat', async (req: Request, res: Response) => {
  const userContent = typeof req.body?.message === 'string' ? req.body.message : '';
  const reply = '任务聊天已迁移到流式接口，这里只保留兼容占位响应。';

  if (userContent) {
    await appendChatMessage({ role: 'user', content: userContent });
  }
  const message = await appendChatMessage({ role: 'assistant', content: reply });

  sendSuccess(res, {
    reply,
    timestamp: message.timestamp
  });
});

router.get('/chat/history', async (req: Request, res: Response) => {
  const limit = Number(req.query.limit || 20);
  const messages = await getChatHistory(limit);
  sendSuccess(res, messages, messages.length);
});

router.get('/chat/session/:sessionId', async (req: Request, res: Response) => {
  const sessionId = getParam(req.params.sessionId);
  if (!sessionId) {
    sendFailure(res, 'sessionId is required', 400);
    return;
  }

  const session = await getAgentSession(sessionId);
  const messages = await getAgentMessages(sessionId, session);
  sendSuccess(res, {
    sessionId: session.id,
    title: session.title || '新会话',
    messages,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  });
});

router.get('/chat/settings', async (_req: Request, res: Response) => {
  const settings = await getChatSettings();
  sendSuccess(res, settings);
});

router.put('/chat/settings', async (req: Request, res: Response) => {
  const settings = await updateChatSettings(req.body || {});
  sendSuccess(res, settings);
});

router.post('/web/chat/stream', async (req: Request, res: Response) => {
  try {
    const sessionId =
      typeof req.body?.sessionId === 'string' && req.body.sessionId
        ? req.body.sessionId
        : `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const workspaceDir = typeof req.body?.workspaceDir === 'string' ? req.body.workspaceDir : undefined;
    const system = typeof req.body?.system === 'string' ? req.body.system : undefined;
    const useTools = req.body?.useTools !== false;

    if (messages.length === 0) {
      sendFailure(res, 'messages is required', 400);
      return;
    }

    setupChatStreamSSE(res, sessionId);

    const llmRes: LLMRes = {
      write: (data: string) => res.write(data),
      end: () => res.end(),
    };

    // DDD: API 层只处理 HTTP/SSE 细节；编排逻辑由 app application service 承担。
    await runTaskWorkbenchChatStream({
      sessionId,
      messages,
      workspaceDir,
      system,
      useTools,
      llmRes,
    });
  } catch (error) {
    console.error('app chat stream error:', error);
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: (error as Error).message || 'chat stream failed' })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    sendFailure(res, (error as Error).message || 'chat stream failed', 502);
  }
});

export function setupAppApi(app: express.Application): void {
  app.use('/api', router);
}

export default { setup: setupAppApi };
