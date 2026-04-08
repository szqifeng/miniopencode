/**
 * LLM 模块 - 与大模型交互
 *
 * 职责：单次 LLM 调用，完成对话生成和工具调用触发
 */
import { streamText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
const API_KEY = process.env.MINIMAX_CN_API_KEY;
const MODEL = 'MiniMax-M2.7-highspeed';
function createProvider() {
    return createAnthropic({
        apiKey: API_KEY,
        baseURL: 'https://api.minimaxi.com/anthropic/v1'
    });
}
export async function llmChat(params) {
    const { messages, system, tools, res, toolCallStreaming = false } = params;
    const provider = createProvider();
    const result = streamText({
        model: provider(MODEL),
        system,
        messages,
        tools,
        toolCallStreaming,
        maxOutputTokens: 8192
    });
    // 如果有 res，直接流式输出所有事件
    if (res) {
        for await (const delta of result.fullStream) {
            res.write(`data: ${JSON.stringify(delta)}\n\n`);
        }
        return;
    }
    return result;
}
export async function generateTitle(userMessage, systemPrompt) {
    try {
        const provider = createProvider();
        const result = streamText({
            model: provider(MODEL),
            system: systemPrompt,
            messages: [{ role: 'user', content: userMessage }],
            maxOutputTokens: 50
        });
        let text = '';
        for await (const delta of result.fullStream) {
            if (delta.type === 'text-delta' && delta.text) {
                text += delta.text;
            }
        }
        return text || '新会话';
    }
    catch (error) {
        console.error('generateTitle error:', error);
        return '新会话';
    }
}
