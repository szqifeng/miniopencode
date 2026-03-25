import express from 'express';
import { streamText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createRecord } from '../models/textRecord.js';
import { getStorage } from '../services/storageFactory.js';
import { TOOLS, executeTool } from '../services/toolService.js';

const router = express.Router();

const API_KEY = process.env.MINIMAX_CN_API_KEY;
const MODEL = 'MiniMax-M2.7-highspeed';

function createProvider() {
  return createAnthropic({
    apiKey: API_KEY,
    baseURL: 'https://api.minimaxi.com/anthropic/v1'
  });
}

router.post('/summarize', async (req, res) => {
  try {
    const { text, maxLength, useTools } = req.body;

    if (!text) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'text is required'
      });
    }

    const provider = createProvider();
    let fullText = '';

    if (!useTools) {
      const result = await streamText({
        model: provider(MODEL),
        maxTokens: 8192,
        system: `请将以下文本总结为不超过 ${maxLength || 200} 个字符的简短摘要，保持核心含义。
请直接输出摘要，不要额外的解释。`,
        messages: [{ role: 'user', content: text }]
      });

      for await (const delta of result.fullStream) {
        if (delta.type === 'text-delta') {
          fullText += delta.text;
        }
      }
    } else {
      const result = await streamText({
        model: provider(MODEL),
        maxTokens: 8192,
        system: `你是一个智能助手，可以调用工具来完成任务。`,
        messages: [{ role: 'user', content: text }],
        tools: TOOLS,
        toolCallStreaming: true
      });

      let hasToolCalls = false;
      let toolResults = [];

      for await (const delta of result.fullStream) {
        if (delta.type === 'text-delta') {
          fullText += delta.text;
        } else if (delta.type === 'tool-call') {
          hasToolCalls = true;
        } else if (delta.type === 'tool-result') {
          const toolName = TOOLS[delta.toolName]?.id || delta.toolName;
          toolResults.push({ tool: toolName, result: delta.output });
        }
      }

      if (hasToolCalls && toolResults.length > 0) {
        const toolResultsText = toolResults.map(r => `${r.tool}: ${JSON.stringify(r.result)}`).join('\n');
        const finalResult = await streamText({
          model: provider(MODEL),
          maxTokens: 8192,
          system: `工具执行结果：
${toolResultsText}

基于工具执行结果，回答用户问题。`,
          messages: [
            { role: 'user', content: text },
            { role: 'assistant', content: fullText },
            { role: 'user', content: `工具执行结果：\n${toolResultsText}` }
          ],
          tools: TOOLS,
          toolCallStreaming: true
        });

        fullText = '';
        for await (const delta of finalResult.fullStream) {
          if (delta.type === 'text-delta') {
            fullText += delta.text;
          }
        }
      }
    }

    const record = createRecord({
      originalText: text,
      summary: fullText,
      operation: 'summarize'
    });

    const storage = await getStorage();
    await storage.save(record);

    res.json({
      id: record.id,
      summary: fullText,
      originalLength: text.length,
      operation: record.operation,
      createdAt: record.createdAt
    });
  } catch (error) {
    console.error('SDK Summarize error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to summarize text'
    });
  }
});

router.post('/summarize/stream', async (req, res) => {
  try {
    const { text, maxLength, useTools } = req.body;

    if (!text) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'text is required'
      });
    }

    const provider = createProvider();

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    let fullText = '';

    if (!useTools) {
      const result = await streamText({
        model: provider(MODEL),
        maxTokens: 8192,
        system: `请将以下文本总结为不超过 ${maxLength || 200} 个字符的简短摘要，保持核心含义。
请直接输出摘要，不要额外的解释。`,
        messages: [{ role: 'user', content: text }]
      });

      for await (const delta of result.fullStream) {
        if (delta.type === 'text-delta') {
          fullText += delta.text;
          res.write(`data: ${JSON.stringify({ type: 'text', text: delta.text })}\n\n`);
        }
      }
    } else {
      let messages = [{ role: 'user', content: text }];

      for (let loop = 0; loop < 5; loop++) {
        const result = await streamText({
          model: provider(MODEL),
          maxTokens: 8192,
          system: `你是一个智能助手，可以调用工具来完成任务。如果需要查询天气，先获取用户位置(城市)，再查询该城市的天气。`,
          messages,
          tools: TOOLS,
          toolCallStreaming: true
        });

        let hasToolCalls = false;
        let toolResults = [];
        let assistantMessage = '';
        let finishReason = null;

        for await (const delta of result.fullStream) {
          if (delta.type === 'text-delta') {
            const txt = delta.textDelta || delta.text || '';
            assistantMessage += txt;
            fullText += txt;
          }else if (delta.type === 'text-end') {
            res.write(`data: ${JSON.stringify({ type: 'text', text: fullText })}\n\n`);
          }
          else if (delta.type === 'tool-call') {
            hasToolCalls = true;
            const toolName = TOOLS[delta.toolName]?.id || delta.toolName;
            res.write(`data: ${JSON.stringify({ type: 'tool_call', tool: toolName, args: delta.input })}\n\n`);
          } else if (delta.type === 'tool-result') {
            const toolName = TOOLS[delta.toolName]?.id || delta.toolName;
            toolResults.push({ tool: toolName, result: delta.output });
            res.write(`data: ${JSON.stringify({ type: 'tool_result', tool: toolName, result: delta.output })}\n\n`);
          } else if (delta.type === 'reasoning') {
            res.write(`data: ${JSON.stringify({ type: 'reasoning', text: delta.textDelta || delta.text || '' })}\n\n`);
          } else if (delta.type === 'finish-step') {
            finishReason = delta.finishReason;
          } else {
            res.write(`data: ${JSON.stringify({ type: delta.type, ...delta })}\n\n`);
          }
        }

        if (!hasToolCalls || toolResults.length === 0 || finishReason !== 'tool-calls') {
          break;
        }

        const toolResultsText = toolResults.map(r => `${r.tool}: ${JSON.stringify(r.result)}`).join('\n');
        messages.push({ role: 'assistant', content: assistantMessage });
        messages.push({ role: 'user', content: `工具执行结果：\n${toolResultsText}` });
      }
    }

    const record = createRecord({
      originalText: text,
      summary: fullText,
      operation: 'summarize'
    });

    const storage = await getStorage();
    await storage.save(record);

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('SDK Stream error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to stream'
    });
  }
});

router.post('/classify', async (req, res) => {
  try {
    const { text, categories = ['科技', '娱乐', '新闻', '生活', '其他'], useTools } = req.body;

    if (!text) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'text is required'
      });
    }

    const categoriesStr = categories.join('、');
    const provider = createProvider();
    let fullText = '';

    if (!useTools) {
      const result = await streamText({
        model: provider(MODEL),
        maxTokens: 1024,
        system: `请分析以下文本，从给定类别中选择最合适的一个。
可选类别：${categoriesStr}
请按以下 JSON 格式输出（只输出 JSON，不要其他内容）：
{
  "category": "选择的类别",
  "confidence": 0.95
}`,
        messages: [{ role: 'user', content: `文本：${text}` }]
      });

      for await (const delta of result.fullStream) {
        if (delta.type === 'text-delta') {
          fullText += delta.text;
        }
      }
    } else {
      const result = await streamText({
        model: provider(MODEL),
        maxTokens: 1024,
        system: `你是一个智能助手，可以调用工具来完成任务。`,
        messages: [{ role: 'user', content: `文本：${text}\n可选类别：${categoriesStr}` }],
        tools: TOOLS,
        toolCallStreaming: true
      });

      let hasToolCalls = false;
      let toolResults = [];

      for await (const delta of result.fullStream) {
        if (delta.type === 'text-delta') {
          fullText += delta.text;
        } else if (delta.type === 'tool-call') {
          hasToolCalls = true;
        } else if (delta.type === 'tool-result') {
          const toolName = TOOLS[delta.toolName]?.id || delta.toolName;
          toolResults.push({ tool: toolName, result: delta.output });
        }
      }

      if (hasToolCalls && toolResults.length > 0) {
        const toolResultsText = toolResults.map(r => `${r.tool}: ${JSON.stringify(r.result)}`).join('\n');
        const finalResult = await streamText({
          model: provider(MODEL),
          maxTokens: 1024,
          system: `请分析以下文本，从给定类别中选择最合适的一个。
可选类别：${categoriesStr}
请按以下 JSON 格式输出（只输出 JSON，不要其他内容）：
{
  "category": "选择的类别",
  "confidence": 0.95
}`,
          messages: [
            { role: 'user', content: `文本：${text}\n可选类别：${categoriesStr}` },
            { role: 'assistant', content: fullText },
            { role: 'user', content: `工具执行结果：\n${toolResultsText}` }
          ],
          tools: TOOLS,
          toolCallStreaming: true
        });

        fullText = '';
        for await (const delta of finalResult.fullStream) {
          if (delta.type === 'text-delta') {
            fullText += delta.text;
          }
        }
      }
    }

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
    console.error('SDK Classify error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to classify text'
    });
  }
});

router.post('/classify/stream', async (req, res) => {
  try {
    const { text, categories = ['科技', '娱乐', '新闻', '生活', '其他'], useTools } = req.body;

    if (!text) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'text is required'
      });
    }

    const categoriesStr = categories.join('、');
    const provider = createProvider();

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    let fullText = '';

    if (!useTools) {
      const result = await streamText({
        model: provider(MODEL),
        maxTokens: 1024,
        system: `请分析以下文本，从给定类别中选择最合适的一个。
可选类别：${categoriesStr}
请按以下 JSON 格式输出（只输出 JSON，不要其他内容）：
{
  "category": "选择的类别",
  "confidence": 0.95
}`,
        messages: [{ role: 'user', content: `文本：${text}` }]
      });

      for await (const delta of result.fullStream) {
        if (delta.type === 'text-delta') {
          res.write(`data: ${JSON.stringify({ type: 'text', text: delta.text })}\n\n`);
        }
      }
    } else {
      const result = await streamText({
        model: provider(MODEL),
        maxTokens: 1024,
        system: `你是一个智能助手，可以调用工具来完成任务。`,
        messages: [{ role: 'user', content: `文本：${text}\n可选类别：${categoriesStr}` }],
        tools: TOOLS,
        toolCallStreaming: true
      });

      let hasToolCalls = false;
      let toolResults = [];

      for await (const delta of result.fullStream) {
        if (delta.type === 'text-delta') {
          const txt = delta.textDelta || delta.text || '';
          fullText += txt;
          res.write(`data: ${JSON.stringify({ type: 'text', text: txt })}\n\n`);
        } else if (delta.type === 'tool-call') {
          hasToolCalls = true;
          const toolName = TOOLS[delta.toolName]?.id || delta.toolName;
          res.write(`data: ${JSON.stringify({ type: 'tool_call', tool: toolName, args: delta.input })}\n\n`);
        } else if (delta.type === 'tool-result') {
          const toolName = TOOLS[delta.toolName]?.id || delta.toolName;
          toolResults.push({ tool: toolName, result: delta.output });
          res.write(`data: ${JSON.stringify({ type: 'tool_result', tool: toolName, result: delta.output })}\n\n`);
        } else if (delta.type === 'reasoning') {
          res.write(`data: ${JSON.stringify({ type: 'reasoning', text: delta.textDelta || delta.text || '' })}\n\n`);
        } else {
          res.write(`data: ${JSON.stringify({ type: delta.type, ...delta })}\n\n`);
        }
      }

      if (hasToolCalls && toolResults.length > 0) {
        const toolResultsText = toolResults.map(r => `${r.tool}: ${JSON.stringify(r.result)}`).join('\n');
        const finalResult = await streamText({
          model: provider(MODEL),
          maxTokens: 1024,
          system: `请分析以下文本，从给定类别中选择最合适的一个。
可选类别：${categoriesStr}
请按以下 JSON 格式输出（只输出 JSON，不要其他内容）：
{
  "category": "选择的类别",
  "confidence": 0.95
}`,
          messages: [
            { role: 'user', content: `文本：${text}\n可选类别：${categoriesStr}` },
            { role: 'assistant', content: fullText },
            { role: 'user', content: `工具执行结果：\n${toolResultsText}` }
          ],
          tools: TOOLS,
          toolCallStreaming: true
        });

        for await (const delta of finalResult.fullStream) {
          if (delta.type === 'text-delta') {
            const txt = delta.textDelta || delta.text || '';
            res.write(`data: ${JSON.stringify({ type: 'text', text: txt })}\n\n`);
          } else if (delta.type === 'tool-call') {
            const toolName = TOOLS[delta.toolName]?.id || delta.toolName;
            res.write(`data: ${JSON.stringify({ type: 'tool_call', tool: toolName, args: delta.input })}\n\n`);
          } else if (delta.type === 'tool-result') {
            const toolName = TOOLS[delta.toolName]?.id || delta.toolName;
            res.write(`data: ${JSON.stringify({ type: 'tool_result', tool: toolName, result: delta.output })}\n\n`);
          } else if (delta.type === 'reasoning') {
            res.write(`data: ${JSON.stringify({ type: 'reasoning', text: delta.textDelta || delta.text || '' })}\n\n`);
          } else {
            res.write(`data: ${JSON.stringify({ type: delta.type, ...delta })}\n\n`);
          }
        }
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('SDK Stream error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to stream'
    });
  }
});

export default router;