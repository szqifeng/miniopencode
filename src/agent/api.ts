/**
 * API 模块 - HTTP 接口层
 * 
 * 职责：接收 HTTP 请求，调用 Agent 处理
 */

import express, { Request, Response } from 'express';
import { createAgent } from './index.js';
import { authMiddleware } from '../middleware/auth.js';
import { getSession, addMessage, getMessages, createMessage, createTextPart, messagesToLLMFormat } from './session.js';
import { ChatRequest, Part } from './types.js';
import type { LLMRes } from './llm.js';

const router = express.Router();

function setupSSE(res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
}

router.post('/chat/stream', async (req: Request, res: Response) => {
  const { sessionId, messages, system, useTools = false } = req.body as ChatRequest;

  if (!messages?.length) {
    res.status(400).json({ error: 'messages is required' });
    return;
  }

  const sid = sessionId || `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  await getSession(sid);

  // 将用户消息存储
  const userMessageParts = messages
    .filter(m => m.role === 'user')
    .map(m => createTextPart(m.content));

  if (userMessageParts.length > 0) {
    const userMessage = createMessage('user', userMessageParts);
    await addMessage(sid, userMessage);
  }

  // 获取完整对话历史
  const historyMessages = await getMessages(sid);
  const llmMessages = messagesToLLMFormat(historyMessages);

  setupSSE(res);

  const agent = createAgent();
  const assistantParts: Part[] = [];

  // 直接传递 res，让 llm 处理所有流式输出
  const llmRes: LLMRes = {
    write: (data: string) => res.write(data),
    end: () => res.end()
  };

  await agent.runWithStream({
    messages: llmMessages,
    system,
    res: llmRes,
    maxLoops: 5
  });

  // 存储 assistant 消息
  if (assistantParts.length > 0) {
    const assistantMessage = createMessage('assistant', assistantParts);
    await addMessage(sid, assistantMessage);
  }
});

export function setupApi(app: express.Application) {
  app.use('/api/web', authMiddleware, router);
}

export default { setup: setupApi };
