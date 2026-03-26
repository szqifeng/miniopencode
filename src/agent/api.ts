/**
 * API 模块 - HTTP 接口层
 * 
 * 职责：接收 HTTP 请求，调用 Agent 处理
 */

import express, { Request, Response } from 'express';
import { createAgent } from './index.js';
import { authMiddleware } from '../middleware/auth.js';
import { getSession, addMessage, getMessages, createMessage, createTextPart, messagesToLLMFormat } from './session.js';
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
  const { sessionId, messages, system, useTools = false } = req.body as ChatRequest;

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

export function setupApi(app: express.Application) {
  app.use('/api/web', authMiddleware, router);
}

export default { setup: setupApi };
