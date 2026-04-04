/**
 * LLM 模块 - 与大模型交互
 * 
 * 职责：单次 LLM 调用，完成对话生成和工具调用触发
 */

import { streamText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { LLMMessage } from './types.js';

const API_KEY = process.env.MINIMAX_CN_API_KEY;
const MODEL = 'MiniMax-M2.7-highspeed';

function createProvider() {
  return createAnthropic({
    apiKey: API_KEY,
    baseURL: 'https://api.minimaxi.com/anthropic/v1'
  });
}

export interface LLMRes {
  write: (data: string) => boolean;
  end?: () => void;
}

interface LLMChatParams {
  messages: LLMMessage[];
  system?: string;
  tools?: Parameters<typeof streamText>[0]['tools'];
  res?: LLMRes;
  toolCallStreaming?: boolean;
}

export async function llmChat(params: LLMChatParams) {
  const { messages, system, tools, res, toolCallStreaming = false } = params;

  const provider = createProvider();

  const result = streamText({
    model: provider(MODEL),
    system,
    messages,
    tools,
    toolCallStreaming,
    maxOutputTokens: 8192
  } as Parameters<typeof streamText>[0]);

  // 如果有 res，直接流式输出所有事件
  if (res) {
    for await (const delta of result.fullStream) {
      res.write(`data: ${JSON.stringify(delta)}\n\n`);
    }
    return;
  }

  return result as unknown;
}

export async function generateTitle(userMessage: string, systemPrompt: string): Promise<string> {
  try {
    const provider = createProvider();

    const result = streamText({
      model: provider(MODEL),
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      maxOutputTokens: 50
    } as Parameters<typeof streamText>[0]);

    let text = '';
    for await (const delta of result.fullStream) {
      if (delta.type === 'text-delta' && (delta as any).text) {
        text += (delta as any).text;
      }
    }
    return text || '新会话';
  } catch (error) {
    console.error('generateTitle error:', error);
    return '新会话';
  }
}
