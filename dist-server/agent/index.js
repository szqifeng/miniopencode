/**
 * Agent 模块 - Agent 核心控制层
 *
 * 职责：编排工具，调用 process 执行 React loop
 */
import { TOOLS } from '../services/toolService.js';
import { processTask, processTaskWithStream } from './process.js';
import { getDefaultPrompt } from './prompts.js';
export function createAgent(tools = TOOLS) {
    return {
        tools,
        async run({ messages, system, maxLoops = 5, workspaceDir }) {
            const systemPrompt = system || await getDefaultPrompt();
            return processTask({
                messages,
                system: systemPrompt,
                tools: tools,
                maxLoops,
                workspaceDir
            });
        },
        async runWithStream({ messages, system, maxLoops = 5, res, sessionId, addMessage, workspaceDir }) {
            const systemPrompt = system || await getDefaultPrompt();
            return processTaskWithStream({
                messages,
                system: systemPrompt,
                tools: tools,
                maxLoops,
                res,
                sessionId,
                workspaceDir,
                addMessage
            });
        },
        withTools(additionalTools) {
            return createAgent(additionalTools);
        },
        withToolsById(toolIds) {
            const filtered = {};
            for (const id of toolIds) {
                if (TOOLS[id]) {
                    filtered[id] = TOOLS[id];
                }
            }
            return createAgent(filtered);
        }
    };
}
export const defaultAgent = createAgent();
