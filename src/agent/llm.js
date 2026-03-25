/**
 * LLM 模块 - 与大模型交互
 * 
 * 职责：单次 LLM 调用，完成对话生成和工具调用触发
 * 不处理业务逻辑，只负责与 AI 模型通信
 */

import { streamText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';

const API_KEY = process.env.MINIMAX_CN_API_KEY;
const MODEL = 'MiniMax-M2.7-highspeed';

/**
 * 创建 Anthropic 模型 provider
 */
function createProvider() {
  return createAnthropic({
    apiKey: API_KEY,
    baseURL: 'https://api.minimaxi.com/anthropic/v1'
  });
}

/**
 * LLM 对话接口
 * 
 * @param {Object} params - 参数
 * @param {Array} params.messages - 消息列表
 * @param {string} params.system - 系统提示词
 * @param {Array} params.tools - 可用工具列表
 * @param {Object} params.res - Express Response 对象，用于 SSE 流式输出
 * @param {boolean} params.toolCallStreaming - 是否开启工具调用流式输出
 * @returns {Object} 非流式时返回解析后的结果，流式时直接写入 res
 */
export async function llmChat({ messages, system, tools, res, toolCallStreaming = false }) {
  const provider = createProvider();

  const result = await streamText({
    model: provider(MODEL),
    maxTokens: 8192,
    system,
    messages,
    tools,
    toolCallStreaming
  });

  // 如果传入了 res，则进行 SSE 流式输出
  if (res) {
    for await (const delta of result.fullStream) {
      res.write(`data: ${JSON.stringify(delta)}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();
    return;
  }

  // 非流式返回原始 result，由调用方处理
  return result;
}
