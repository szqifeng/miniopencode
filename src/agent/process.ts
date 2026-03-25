/**
 * Process 模块 - React Loop 执行器
 * 
 * 职责：执行多轮 React 循环
 */

import { llmChat } from './llm.js';
import type { LLMRes } from './llm.js';
import { LLMMessage } from './types.js';

interface ProcessTaskParams {
  messages: LLMMessage[];
  system?: string;
  tools?: Parameters<typeof llmChat>[0]['tools'];
  maxLoops?: number;
}

interface ProcessTaskWithStreamParams extends ProcessTaskParams {
  res?: LLMRes;
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
  res
}: ProcessTaskWithStreamParams) {
  const currentMessages: LLMMessage[] = [...messages];

  for (let loop = 0; loop < maxLoops; loop++) {
    const result = await llmChat({
      messages: currentMessages,
      system,
      tools,
      toolCallStreaming: true
    }) as { fullStream: AsyncIterable<Record<string, unknown>>, finishReason?: string };

    let hasToolCalls = false;
    const toolResults: Array<{ tool: string; result: unknown }> = [];
    let assistantMessage = '';
    let finishReason: string | undefined;

    for await (const delta of result.fullStream) {
      const d = delta as Record<string, unknown>;
      res?.write(`data: ${JSON.stringify(d)}\n\n`);

      if (d.type === 'text-delta') {
        assistantMessage += (d.textDelta as string) || (d.text as string) || '';
      } else if (d.type === 'tool-call') {
        hasToolCalls = true;
      } else if (d.type === 'tool-result') {
        const toolName = d.toolName as string;
        toolResults.push({ tool: toolName, result: d.output ?? null });
      } else if (d.type === 'finish-step') {
        finishReason = d.finishReason as string;
      }
    }

    if (!hasToolCalls || toolResults.length === 0 || finishReason !== 'tool-calls') {
      break;
    }

    const toolResultsText = toolResults.map(r => `${r.tool}: ${JSON.stringify(r.result)}`).join('\n');
    currentMessages.push({ role: 'assistant', content: assistantMessage });
    currentMessages.push({ role: 'user', content: `工具执行结果：\n${toolResultsText}` });
  }

  return { text: '' };
}
