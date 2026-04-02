/**
 * Process 模块 - React Loop 执行器
 * 
 * 职责：执行多轮 React 循环
 */

import { llmChat } from './llm.js';
import type { LLMRes } from './llm.js';
import { LLMMessage, Message, Part } from './types.js';

interface ProcessTaskParams {
  messages: LLMMessage[];
  system?: string;
  tools?: Parameters<typeof llmChat>[0]['tools'];
  maxLoops?: number;
}

interface ProcessTaskWithStreamParams extends ProcessTaskParams {
  res?: LLMRes;
  sessionId?: string;
  addMessage?: (message: Message) => Promise<void>;
}

export async function processTask({ messages, system, tools, maxLoops = 5 }: ProcessTaskParams) {
  const currentMessages: LLMMessage[] = [...messages];
  let fullText = '';

  for (let loop = 0; loop < maxLoops; loop++) {
    const result = await llmChat({
      messages: currentMessages,
      system,
      tools,
      toolCallStreaming: false
    }) as { fullStream: AsyncIterable<Record<string, unknown>>, finishReason?: string };

    let hasToolCalls = false;
    const toolResults: Array<{ tool: string; result: unknown }> = [];
    let assistantMessage = '';

    for await (const delta of result.fullStream) {
      const d = delta as Record<string, unknown>;
      if (d.type === 'text-delta') {
        assistantMessage += (d.textDelta as string) || (d.text as string) || '';
      } else if (d.type === 'tool-call') {
        hasToolCalls = true;
      } else if (d.type === 'tool-result') {
        const toolName = d.toolName as string;
        toolResults.push({ tool: toolName, result: d.output ?? null });
      }
    }

    fullText += assistantMessage;

    if (!hasToolCalls || toolResults.length === 0) {
      break;
    }

    const toolResultsText = toolResults.map(r => `${r.tool}: ${JSON.stringify(r.result)}`).join('\n');
    currentMessages.push({ role: 'assistant', content: assistantMessage });
    currentMessages.push({ role: 'user', content: `工具执行结果：\n${toolResultsText}` });
  }

  return { text: fullText };
}

export async function processTaskWithStream({
  messages,
  system,
  tools,
  maxLoops = 5,
  res,
  sessionId,
  addMessage
}: ProcessTaskWithStreamParams) {
  const currentMessages: LLMMessage[] = [...messages];
  let finalText = '';
  const assistantMessages: Message[] = [];

  for (let loop = 0; loop < maxLoops; loop++) {
    const result = await llmChat({
      messages: currentMessages,
      system,
      tools,
      toolCallStreaming: true
    }) as { fullStream: AsyncIterable<Record<string, unknown>>, finishReason?: string };

    let hasToolCalls = false;
    const toolCalls: Array<{ tool: string; args: Record<string, unknown> }> = [];
    let assistantMessage = '';
    let finishReason: string | undefined;
    const assistantParts: Part[] = [];
    const deltas: Record<string, unknown>[] = [];

    const textContent: Record<string, string> = {};
    const reasoningContent: Record<string, string> = {};

    const toolResults: Array<{ tool: string; result: unknown }> = [];

    for await (const delta of result.fullStream) {
      deltas.push(delta);
      res?.write(`data: ${JSON.stringify(delta)}\n\n`);

      const d = delta as Record<string, unknown>;

      if (d.type === 'text-delta') {
        const id = d.id as string;
        const text = (d.textDelta as string) || (d.text as string) || '';
        textContent[id] = (textContent[id] || '') + text;
        assistantMessage += text;
      } else if (d.type === 'tool-call') {
        hasToolCalls = true;
        toolCalls.push({
          tool: d.toolName as string,
          args: d.args as Record<string, unknown> || {}
        });
      } else if (d.type === 'tool-result') {
        toolResults.push({
          tool: d.toolName as string,
          result: d.output ?? null
        });
      } else if (d.type === 'reasoning-delta') {
        const id = d.id as string;
        reasoningContent[id] = (reasoningContent[id] || '') + ((d.text as string) || '');
      } else if (d.type === 'finish-step') {
        finishReason = d.finishReason as string;
      }
    }

    for (const d of deltas) {
      if (d.type === 'text-delta' || d.type === 'reasoning-delta') {
        // 这些只是累积标记，跳过
      } else if (d.type === 'tool-call') {
        assistantParts.push({
          type: 'tool-call',
          tool: d.toolName as string,
          args: d.args as Record<string, unknown> || {}
        });
      } else if (d.type === 'tool-input-delta') {
        assistantParts.push({
          type: 'tool-input-delta',
          id: d.id as string,
          delta: d.delta as string || ''
        });
      } else if (d.type === 'tool-result') {
        assistantParts.push({
          type: 'tool-result',
          tool: d.toolName as string,
          result: d.output ?? null
        });
      } else if (d.type === 'finish-step') {
        finishReason = d.finishReason as string;
        assistantParts.push({
          type: 'finish-step',
          finishReason: d.finishReason as string
        });
      } else if (d.type === 'error') {
        assistantParts.push({
          type: 'error',
          error: (d.error as string) || 'Unknown error'
        });
      } else if (d.type === 'start') {
        assistantParts.push({ type: 'start' });
      } else if (d.type === 'text-start') {
        assistantParts.push({ type: 'text-start', id: d.id as string });
      } else if (d.type === 'text-end') {
        const id = d.id as string;
        assistantParts.push({ type: 'text-end', id });
        assistantParts.push({ type: 'text', id, content: textContent[id] || '' });
      } else if (d.type === 'reasoning-start') {
        assistantParts.push({ type: 'reasoning-start', id: d.id as string });
      } else if (d.type === 'reasoning-end') {
        const id = d.id as string;
        assistantParts.push({ type: 'reasoning', id, content: reasoningContent[id] || '' });
      } else if (d.type === 'tool-input-start') {
        assistantParts.push({
          type: 'tool-input-start',
          id: d.id as string,
          toolName: d.toolName as string,
          dynamic: d.dynamic as boolean
        });
      } else if (d.type === 'tool-input-end') {
        assistantParts.push({ type: 'tool-input-end', id: d.id as string });
      } else if (d.type === 'finish') {
        assistantParts.push({
          type: 'finish',
          finishReason: d.finishReason as string,
          totalUsage: d.totalUsage
        });
      }
    }

    finalText = assistantMessage;

    assistantMessages.push({
      role: 'assistant',
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
      parts: assistantParts,
      createdAt: Date.now()
    });

    if (!hasToolCalls || toolResults.length === 0 || finishReason !== 'tool-calls') {
      break;
    }

    const toolResultsText = toolResults.map(r => `${r.tool}: ${JSON.stringify(r.result)}`).join('\n');
    currentMessages.push({ role: 'assistant', content: assistantMessage });
    currentMessages.push({ role: 'user', content: `工具执行结果：\n${toolResultsText}` });
  }

  res?.write('data: [DONE]\n\n');
  res?.end();

  if (addMessage && sessionId) {
    for (const msg of assistantMessages) {
      await addMessage(msg);
    }
  }

  return { text: finalText };
}
