/**
 * Process 模块 - React Loop 执行器
 * 
 * 职责：执行多轮 React 循环
 * - 调用 LLM 获取响应
 * - 检测并处理工具调用
 * - 管理对话上下文
 * 
 * 架构：api -> agent -> process -> llm
 */

import { llmChat } from './llm.js';

/**
 * 执行一轮 React 任务（非流式）
 * 
 * @param {Object} params - 参数
 * @param {Array} params.messages - 消息列表
 * @param {string} params.system - 系统提示词
 * @param {Array} params.tools - 可用工具列表
 * @param {number} params.maxLoops - 最大循环次数，默认 5
 * @returns {Object} { text: string } 最终响应文本
 */
export async function processTask({ messages, system, tools, maxLoops = 5 }) {
  let currentMessages = [...messages];
  let fullText = '';

  for (let loop = 0; loop < maxLoops; loop++) {
    const result = await llmChat({
      messages: currentMessages,
      system,
      tools,
      toolCallStreaming: false
    });

    let hasToolCalls = false;
    let toolResults = [];
    let assistantMessage = '';

    for await (const delta of result.fullStream) {
      if (delta.type === 'text-delta') {
        assistantMessage += delta.textDelta || delta.text || '';
      } else if (delta.type === 'tool-call') {
        hasToolCalls = true;
      } else if (delta.type === 'tool-result') {
        toolResults.push({ tool: delta.toolName, result: delta.output });
      }
    }

    fullText += assistantMessage;

    // 没有工具调用或无可用工具结果，结束循环
    if (!hasToolCalls || toolResults.length === 0) {
      break;
    }

    // 将工具结果注入对话上下文，继续下一轮
    const toolResultsText = toolResults.map(r => `${r.tool}: ${JSON.stringify(r.result)}`).join('\n');
    currentMessages.push({ role: 'assistant', content: assistantMessage });
    currentMessages.push({ role: 'user', content: `工具执行结果：\n${toolResultsText}` });
  }

  return { text: fullText };
}

/**
 * 执行一轮 React 任务（流式）
 * 
 * @param {Object} params - 参数
 * @param {Array} params.messages - 消息列表
 * @param {string} params.system - 系统提示词
 * @param {Array} params.tools - 可用工具列表
 * @param {number} params.maxLoops - 最大循环次数，默认 5
 * @param {Function} params.onChunk - 文本片段回调
 * @param {Function} params.onToolCall - 工具调用开始回调
 * @param {Function} params.onToolResult - 工具结果回调
 * @param {Function} params.onReasoning - 推理过程回调
 * @returns {Object} { text: string } 最终响应文本
 */
export async function processTaskWithStream({ messages, system, tools, maxLoops = 5, onChunk, onToolCall, onToolResult, onReasoning }) {
  let currentMessages = [...messages];
  let fullText = '';

  for (let loop = 0; loop < maxLoops; loop++) {
    const result = await llmChat({
      messages: currentMessages,
      system,
      tools,
      toolCallStreaming: true
    });

    let hasToolCalls = false;
    let toolResults = [];
    let assistantMessage = '';

    for await (const delta of result.fullStream) {
      if (delta.type === 'text-delta') {
        const txt = delta.textDelta || delta.text || '';
        assistantMessage += txt;
        fullText += txt;
        onChunk?.(txt);
      } else if (delta.type === 'tool-call') {
        hasToolCalls = true;
        const toolName = tools?.find(t => t.id === delta.toolName)?.id || delta.toolName;
        onToolCall?.(toolName, delta.input);
      } else if (delta.type === 'tool-result') {
        const toolName = tools?.find(t => t.id === delta.toolName)?.id || delta.toolName;
        toolResults.push({ tool: toolName, result: delta.output });
        onToolResult?.(toolName, delta.output);
      } else if (delta.type === 'reasoning') {
        onReasoning?.(delta.textDelta || delta.text || '');
      }
    }

    // 没有工具调用或无可用工具结果，结束循环
    if (!hasToolCalls || toolResults.length === 0) {
      break;
    }

    // 将工具结果注入对话上下文，继续下一轮
    const toolResultsText = toolResults.map(r => `${r.tool}: ${JSON.stringify(r.result)}`).join('\n');
    currentMessages.push({ role: 'assistant', content: assistantMessage });
    currentMessages.push({ role: 'user', content: `工具执行结果：\n${toolResultsText}` });
  }

  return { text: fullText };
}
