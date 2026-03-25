/**
 * API 模块 - HTTP 接口层
 * 
 * 职责：接收 HTTP 请求，调用 Agent 处理
 * 
 * 架构：api -> agent -> process -> llm
 */

import express from 'express';
import { createAgent } from './index.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

/**
 * 设置 SSE 响应头
 */
function setupSSE(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
}

/**
 * 流式对话接口
 * 
 * POST /api/web/chat/stream
 * 
 * 请求体：
 * {
 *   messages: [{ role: 'user', content: '...' }],
 *   system?: '你是助手',
 *   useTools?: false
 * }
 */
router.post('/chat/stream', async (req, res) => {
  const { messages, system, useTools = false } = req.body;

  if (!messages?.length) {
    return res.status(400).json({ error: 'messages is required' });
  }

  setupSSE(res);

  const agent = createAgent();

  await agent.runWithStream({
    messages,
    system,
    maxLoops: 5,
    onChunk: (txt) => {
      res.write(`data: ${JSON.stringify({ type: 'text-delta', textDelta: txt })}\n\n`);
    },
    onToolCall: (toolName, args) => {
      res.write(`data: ${JSON.stringify({ type: 'tool-call', tool: toolName, args })}\n\n`);
    },
    onToolResult: (toolName, result) => {
      res.write(`data: ${JSON.stringify({ type: 'tool-result', tool: toolName, result })}\n\n`);
    },
    onReasoning: (text) => {
      res.write(`data: ${JSON.stringify({ type: 'reasoning', text })}\n\n`);
    }
  });

  res.write('data: [DONE]\n\n');
  res.end();
});

/**
 * 注册路由到 Express app
 */
export function setupApi(app) {
  app.use('/api/web', authMiddleware, router);
}

export default { setup: setupApi };
