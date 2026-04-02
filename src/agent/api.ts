/**
 * API 模块 - HTTP 接口层
 * 
 * 职责：接收 HTTP 请求，调用 Agent 处理
 */

import express, { Request, Response } from 'express';
import { createAgent } from './index.js';
import { authMiddleware } from '../middleware/auth.js';
import { getSession, addMessage, getMessages, createMessage, createTextPart, messagesToLLMFormat, clearSession } from './session.js';
import { ChatRequest } from './types.js';
import type { LLMRes } from './llm.js';

const router = express.Router();

function setupSSE(res: Response, sessionId: string) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Session-Id', sessionId);
  res.flushHeaders();
}

router.post('/chat/stream', async (req: Request, res: Response) => {
  const { sessionId, messages, system } = req.body as ChatRequest;

  if (!messages?.length) {
    res.status(400).json({ error: 'messages is required' });
    return;
  }

  const sid = sessionId || `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const session = await getSession(sid);

  // 将用户消息存储
  const userMessageParts = messages
    .filter(m => m.role === 'user')
    .map((m, i) => createTextPart(`user_${i}`, m.content));

  if (userMessageParts.length > 0) {
    const userMessage = createMessage('user', userMessageParts);
    await addMessage(sid, userMessage, session);
  }

  // 获取完整对话历史
  const historyMessages = await getMessages(sid, session);
  const llmMessages = messagesToLLMFormat(historyMessages);

  setupSSE(res, sid);

  const agent = createAgent();

  const llmRes: LLMRes = {
    write: (data: string) => res.write(data),
    end: () => res.end()
  };

  await agent.runWithStream({
    messages: llmMessages,
    system,
    res: llmRes,
    maxLoops: 5,
    sessionId: sid,
    addMessage: async (msg) => {
      await addMessage(sid, msg, session);
    }
  });
});

router.get('/chat/session/:sessionId', async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;
  
  if (!sessionId) {
    res.status(400).json({ error: 'sessionId is required' });
    return;
  }

  const session = await getSession(sessionId);
  const messages = await getMessages(sessionId, session);
  
  res.json({
    sessionId: session.id,
    messages: messages,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt
  });
});

router.delete('/chat/session/:sessionId', async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;
  
  if (!sessionId) {
    res.status(400).json({ error: 'sessionId is required' });
    return;
  }

  await clearSession(sessionId);
  res.json({ success: true });
});

router.get('/sessions', async (_req: Request, res: Response) => {
  const fs = await import('fs/promises');
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const DATA_DIR = path.join(__dirname, '../../data/sessions');
  
  try {
    const files = await fs.readdir(DATA_DIR);
    const sessions = await Promise.all(
      files
        .filter(f => f.endsWith('.json'))
        .map(async (file) => {
          const filePath = path.join(DATA_DIR, file);
          const data = await fs.readFile(filePath, 'utf-8');
          const session = JSON.parse(data);
          return {
            id: session.id,
            title: session.messages[0]?.parts?.[0]?.content?.slice(0, 20) || '新会话',
            createdAt: session.createdAt,
            updatedAt: session.updatedAt
          };
        })
    );
    
    sessions.sort((a, b) => b.updatedAt - a.updatedAt);
    res.json(sessions);
  } catch {
    res.json([]);
  }
});

export function setupApi(app: express.Application) {
  app.use('/api/web', authMiddleware, router);
}

export default { setup: setupApi };
