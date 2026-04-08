/**
 * Process 模块 - React Loop 执行器
 *
 * 职责：执行多轮 React 循环
 */
import { llmChat } from './llm.js';
import { AsyncLocalStorage } from 'node:async_hooks';
const executionContextStorage = new AsyncLocalStorage();
export function getCurrentSessionId() {
    return executionContextStorage.getStore()?.sessionId;
}
export function getCurrentWorkspaceDir() {
    return executionContextStorage.getStore()?.workspaceDir;
}
function wrapToolsWithExecutionContext(tools, context) {
    if (!tools)
        return undefined;
    const wrapped = {};
    for (const [name, tool] of Object.entries(tools)) {
        if (typeof tool === 'object' && tool.execute) {
            wrapped[name] = {
                ...tool,
                execute: async (args) => {
                    return executionContextStorage.run(context, () => {
                        return tool.execute(args);
                    });
                }
            };
        }
        else {
            wrapped[name] = tool;
        }
    }
    return wrapped;
}
export async function processTask({ messages, system, tools, maxLoops = 5, workspaceDir }) {
    const currentMessages = [...messages];
    let fullText = '';
    const wrappedTools = wrapToolsWithExecutionContext(tools, { workspaceDir });
    for (let loop = 0; loop < maxLoops; loop++) {
        const result = await llmChat({
            messages: currentMessages,
            system,
            tools: wrappedTools,
            toolCallStreaming: false
        });
        let hasToolCalls = false;
        const toolResults = [];
        let assistantMessage = '';
        for await (const delta of result.fullStream) {
            const d = delta;
            if (d.type === 'text-delta') {
                assistantMessage += d.textDelta || d.text || '';
            }
            else if (d.type === 'tool-call') {
                hasToolCalls = true;
            }
            else if (d.type === 'tool-result') {
                const toolName = d.toolName;
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
export async function processTaskWithStream({ messages, system, tools, maxLoops = 5, res, sessionId, workspaceDir, addMessage }) {
    const currentMessages = [...messages];
    let finalText = '';
    const assistantMessages = [];
    const wrappedTools = wrapToolsWithExecutionContext(tools, {
        sessionId,
        workspaceDir
    });
    for (let loop = 0; loop < maxLoops; loop++) {
        const result = await llmChat({
            messages: currentMessages,
            system,
            tools: wrappedTools,
            toolCallStreaming: true
        });
        let hasToolCalls = false;
        const toolCalls = [];
        let assistantMessage = '';
        let finishReason;
        const assistantParts = [];
        const deltas = [];
        const textContent = {};
        const reasoningContent = {};
        const toolResults = [];
        for await (const delta of result.fullStream) {
            deltas.push(delta);
            res?.write(`data: ${JSON.stringify(delta)}\n\n`);
            const d = delta;
            if (d.type === 'text-delta') {
                const id = d.id;
                const text = d.textDelta || d.text || '';
                textContent[id] = (textContent[id] || '') + text;
                assistantMessage += text;
            }
            else if (d.type === 'tool-call') {
                hasToolCalls = true;
                toolCalls.push({
                    tool: d.toolName,
                    args: d.args || {}
                });
            }
            else if (d.type === 'tool-result') {
                toolResults.push({
                    tool: d.toolName,
                    result: d.output ?? null
                });
            }
            else if (d.type === 'reasoning-delta') {
                const id = d.id;
                reasoningContent[id] = (reasoningContent[id] || '') + (d.text || '');
            }
            else if (d.type === 'finish-step') {
                finishReason = d.finishReason;
            }
        }
        for (const d of deltas) {
            if (d.type === 'text-delta' || d.type === 'reasoning-delta') {
                // 这些只是累积标记，跳过
            }
            else if (d.type === 'tool-call') {
                assistantParts.push({
                    type: 'tool-call',
                    tool: d.toolName,
                    args: d.args || {}
                });
            }
            else if (d.type === 'tool-input-delta') {
                assistantParts.push({
                    type: 'tool-input-delta',
                    id: d.id,
                    delta: d.delta || ''
                });
            }
            else if (d.type === 'tool-result') {
                assistantParts.push({
                    type: 'tool-result',
                    tool: d.toolName,
                    result: d.output ?? null
                });
            }
            else if (d.type === 'finish-step') {
                finishReason = d.finishReason;
                assistantParts.push({
                    type: 'finish-step',
                    finishReason: d.finishReason
                });
            }
            else if (d.type === 'error') {
                assistantParts.push({
                    type: 'error',
                    error: d.error || 'Unknown error'
                });
            }
            else if (d.type === 'start') {
                assistantParts.push({ type: 'start' });
            }
            else if (d.type === 'text-start') {
                assistantParts.push({ type: 'text-start', id: d.id });
            }
            else if (d.type === 'text-end') {
                const id = d.id;
                assistantParts.push({ type: 'text-end', id });
                assistantParts.push({ type: 'text', id, content: textContent[id] || '' });
            }
            else if (d.type === 'reasoning-start') {
                assistantParts.push({ type: 'reasoning-start', id: d.id });
            }
            else if (d.type === 'reasoning-end') {
                const id = d.id;
                assistantParts.push({ type: 'reasoning', id, content: reasoningContent[id] || '' });
            }
            else if (d.type === 'tool-input-start') {
                assistantParts.push({
                    type: 'tool-input-start',
                    id: d.id,
                    toolName: d.toolName,
                    dynamic: d.dynamic
                });
            }
            else if (d.type === 'tool-input-end') {
                assistantParts.push({ type: 'tool-input-end', id: d.id });
            }
            else if (d.type === 'finish') {
                assistantParts.push({
                    type: 'finish',
                    finishReason: d.finishReason,
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
