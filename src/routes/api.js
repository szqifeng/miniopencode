import express from 'express';
import { getStorage } from '../services/storageFactory.js';
import { createRecord, toPublicRecord } from '../models/textRecord.js';

const router = express.Router();

const API_KEY = process.env.MINIMAX_CN_API_KEY;
const BASE_URL = 'https://api.minimaxi.com/anthropic/v1';
const MODEL = 'MiniMax-M2.7-highspeed';

async function chat(messages, { system, tools, stream = false }) {
  const body = {
    model: MODEL,
    max_tokens: 8192,
    stream,
    messages: []
  };

  if (system) {
    body.messages.push({ role: 'user', content: system });
    body.messages.push({ role: 'assistant', content: '' });
  }

  body.messages.push(...messages);

  if (tools && tools.length > 0) {
    body.tools = tools.map(t => ({
      name: t.id,
      description: t.description,
      input_schema: t.inputSchema
    }));
  }

  const response = await fetch(`${BASE_URL}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(body)
  });

  return response;
}

function extractTextFromContent(content) {
  for (const item of content) {
    if (item.type === 'text' && item.text) {
      return item.text.trim();
    }
  }
  return '';
}

router.post('/summarize', async (req, res) => {
  try {
    const { text, maxLength } = req.body;

    if (!text) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'text is required'
      });
    }

    const system = `请将以下文本总结为不超过 ${maxLength || 200} 个字符的简短摘要，保持核心含义。
请直接输出摘要，不要额外的解释。`;

    const response = await chat([{ role: 'user', content: text }], { system });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'AI request failed');
    }

    const data = await response.json();
    const summary = extractTextFromContent(data.content);

    const record = createRecord({
      originalText: text,
      summary,
      operation: 'summarize'
    });

    const storage = await getStorage();
    await storage.save(record);

    res.json({
      id: record.id,
      summary,
      originalLength: text.length,
      operation: record.operation,
      createdAt: record.createdAt
    });
  } catch (error) {
    console.error('Summarize error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to summarize text'
    });
  }
});

router.post('/summarize/stream', async (req, res) => {
  try {
    const { text, maxLength } = req.body;

    if (!text) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'text is required'
      });
    }

    const system = `请将以下文本总结为不超过 ${maxLength || 200} 个字符的简短摘要，保持核心含义。
请直接输出摘要，不要额外的解释。`;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const response = await chat([{ role: 'user', content: text }], { system, stream: true });

    if (!response.ok) {
      const error = await response.json();
      res.write(`data: ${JSON.stringify({ error: error.error?.message || 'AI request failed' })}\n\n`);
      res.end();
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            res.write('data: [DONE]\n\n');
          } else {
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
                res.write(`data: ${JSON.stringify({ type: 'text', text: parsed.delta.text })}\n\n`);
              } else if (parsed.type === 'message_delta') {
                // finish
              }
            } catch (e) {
              // skip invalid JSON
            }
          }
        }
      }
    }

    res.end();
  } catch (error) {
    console.error('Stream error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to stream'
    });
  }
});

router.post('/classify', async (req, res) => {
  try {
    const { text, categories = ['科技', '娱乐', '新闻', '生活', '其他'] } = req.body;

    if (!text) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'text is required'
      });
    }

    const categoriesStr = categories.join('、');
    const system = `请分析以下文本，从给定类别中选择最合适的一个。
可选类别：${categoriesStr}
请按以下 JSON 格式输出（只输出 JSON，不要其他内容）：
{
  "category": "选择的类别",
  "confidence": 0.95
}`;

    const response = await chat([{ role: 'user', content: `文本：${text}` }], { system });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'AI request failed');
    }

    const data = await response.json();
    const fullText = extractTextFromContent(data.content);

    let parsed = { category: categories[0], confidence: 0.5 };
    try {
      parsed = JSON.parse(fullText);
    } catch (e) {
      // Use default
    }

    const record = createRecord({
      originalText: text,
      category: parsed.category || categories[0],
      confidence: Math.min(Math.max(parsed.confidence || 0.5, 0), 1),
      operation: 'classify'
    });

    const storage = await getStorage();
    await storage.save(record);

    res.json({
      id: record.id,
      predictedCategory: record.category,
      confidence: record.confidence,
      categories,
      operation: record.operation,
      createdAt: record.createdAt
    });
  } catch (error) {
    console.error('Classify error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to classify text'
    });
  }
});

router.post('/classify/stream', async (req, res) => {
  try {
    const { text, categories = ['科技', '娱乐', '新闻', '生活', '其他'] } = req.body;

    if (!text) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'text is required'
      });
    }

    const categoriesStr = categories.join('、');
    const system = `请分析以下文本，从给定类别中选择最合适的一个。
可选类别：${categoriesStr}
请按以下 JSON 格式输出（只输出 JSON，不要其他内容）：
{
  "category": "选择的类别",
  "confidence": 0.95
}`;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const response = await chat([{ role: 'user', content: `文本：${text}` }], { system, stream: true });

    if (!response.ok) {
      const error = await response.json();
      res.write(`data: ${JSON.stringify({ error: error.error?.message || 'AI request failed' })}\n\n`);
      res.end();
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            res.write('data: [DONE]\n\n');
          } else {
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
                res.write(`data: ${JSON.stringify({ type: 'text', text: parsed.delta.text })}\n\n`);
              }
            } catch (e) {
              // skip invalid JSON
            }
          }
        }
      }
    }

    res.end();
  } catch (error) {
    console.error('Stream error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to stream'
    });
  }
});

router.get('/records', async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);

    const storage = await getStorage();
    const result = await storage.list(limit, offset);

    res.json({
      records: result.records.map(toPublicRecord),
      total: result.total,
      limit: result.limit,
      offset: result.offset
    });
  } catch (error) {
    console.error('List records error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to list records'
    });
  }
});

router.get('/records/:id', async (req, res) => {
  try {
    const storage = await getStorage();
    const record = await storage.get(req.params.id);

    if (!record) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Record not found'
      });
    }

    res.json(record);
  } catch (error) {
    console.error('Get record error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get record'
    });
  }
});

router.delete('/records/:id', async (req, res) => {
  try {
    const storage = await getStorage();
    const success = await storage.delete(req.params.id);

    if (!success) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Record not found'
      });
    }

    res.json({
      message: 'Record deleted successfully',
      id: req.params.id
    });
  } catch (error) {
    console.error('Delete record error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete record'
    });
  }
});

export default router;
