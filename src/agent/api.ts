/**
 * API 模块 - HTTP 接口层
 * 
 * 职责：接收 HTTP 请求，调用 Agent 处理
 */

import express, { Request, Response } from 'express';
import { createAgent } from './index.js';
import { authMiddleware } from '../middleware/auth.js';
import { getSession, addMessage, getMessages, createMessage, createTextPart, messagesToLLMFormat, clearSession, updateSessionTitle } from './session.js';
import { ChatRequest } from './types.js';
import type { LLMRes } from './llm.js';
import { generateTitle } from './llm.js';
import { getPrompt, getDefaultPrompt } from './prompts.js';
import { getDataSubdir } from '../utils/paths.js';

const router = express.Router();

function setupSSE(res: Response, sessionId: string) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Session-Id', sessionId);
  res.flushHeaders();
}

router.post('/chat/stream', async (req: Request, res: Response) => {
  try {
    const { sessionId, messages, workspaceDir, system, useTools } = req.body as ChatRequest;

    if (!messages?.length) {
      res.status(400).json({ error: 'messages is required' });
      return;
    }

    const sid = sessionId || `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const session = await getSession(sid);

    const userMessageParts = messages
      .filter(m => m.role === 'user')
      .map((m, i) => createTextPart(`user_${i}`, m.content));

    if (userMessageParts.length > 0) {
      const userMessage = createMessage('user', userMessageParts);
      const isFirstMessage = session.messages.length === 0;
      await addMessage(sid, userMessage, session);

      (res as any)._isFirstMessage = isFirstMessage;
      if (isFirstMessage) {
        const firstUserContent = (userMessageParts[0] as { type: 'text'; content: string }).content;
        (res as any)._userContent = firstUserContent.slice(0, 100);
      }
    }

    const historyMessages = await getMessages(sid, session);
    const llmMessages = messagesToLLMFormat(historyMessages);

    setupSSE(res, sid);

    const agent = useTools === false ? createAgent({}) : createAgent();

    const llmRes: LLMRes = {
      write: (data: string) => res.write(data),
      end: () => {
        res.end();
      }
    };

    const defaultSystem = system || await getDefaultPrompt();

    await agent.runWithStream({
      messages: llmMessages,
      system: defaultSystem,
      res: llmRes,
      maxLoops: 100,
      sessionId: sid,
      workspaceDir,
      addMessage: async (msg) => {
        await addMessage(sid, msg, session);
      }
    });

    const isFirstMessage = (res as any)._isFirstMessage;
    const userContent = (res as any)._userContent;
    if (isFirstMessage && userContent) {
      const title = userContent.slice(0, 20) || '新会话';
      await updateSessionTitle(sid, title);
      console.log(`✓ Title set for session ${sid}: ${title}`);
    }
  } catch (error) {
    console.error('chat stream error:', error);
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: (error as Error).message || 'chat stream failed' })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    res.status(502).json({
      error: 'chat stream failed',
      message: (error as Error).message || 'chat stream failed'
    });
  }
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
    title: session.title || '新会话',
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
  const DATA_DIR = getDataSubdir('sessions');

  console.log('DATA_DIR:', DATA_DIR);

  try {
    await fs.access(DATA_DIR);
  } catch {
    console.log('Directory does not exist, creating it');
    await fs.mkdir(DATA_DIR, { recursive: true });
  }

  try {
    const files = await fs.readdir(DATA_DIR);
    console.log('Found files:', files.length);
    const sessions = await Promise.all(
      files
        .filter(f => f.endsWith('.json'))
        .map(async (file) => {
          const filePath = path.join(DATA_DIR, file);
          const data = await fs.readFile(filePath, 'utf-8');
          const session = JSON.parse(data);

          // 兼容旧版本：从 parts[0].content 获取，或者从 messages[0].content 获取
          let content = session.title;
          if (!content) {
            const firstMsg = session.messages?.[0];
            if (firstMsg?.parts?.[0]?.content) {
              content = firstMsg.parts[0].content;
            } else if (firstMsg?.content) {
              content = firstMsg.content;
            }
          }

          return {
            id: session.id,
            title: content?.slice(0, 20) || '新会话',
            createdAt: session.createdAt,
            updatedAt: session.updatedAt
          };
        })
    );

    sessions.sort((a, b) => b.updatedAt - a.updatedAt);
    console.log('Sessions:', sessions.length);
    res.json(sessions);
  } catch (e) {
    console.error('Error reading sessions:', e);
    res.json([]);
  }
});

export function setupApi(app: express.Application) {
  app.use('/api/web', authMiddleware, router);
}

export default { setup: setupApi };
