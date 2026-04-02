/**
 * Agent 模块 - Agent 核心控制层
 * 
 * 职责：编排工具，调用 process 执行 React loop
 */

import { TOOLS } from '../services/toolService.js';
import { processTask, processTaskWithStream } from './process.js';
import { LLMMessage, Message } from './types.js';
import type { LLMRes } from './llm.js';
import type { ToolSet } from 'ai';
import { getDefaultPrompt } from './prompts.js';

interface AgentRunParams {
  messages: LLMMessage[];
  system?: string;
  maxLoops?: number;
}

interface AgentRunWithStreamParams extends AgentRunParams {
  res?: LLMRes;
  sessionId?: string;
  addMessage?: (message: Message) => Promise<void>;
}

interface Agent {
  tools: unknown;
  run(params: AgentRunParams): Promise<{ text: string }>;
  runWithStream(params: AgentRunWithStreamParams): Promise<{ text: string }>;
  withTools(additionalTools: unknown): Agent;
  withToolsById(toolIds: string[]): Agent;
}

export function createAgent(tools: ToolSet = TOOLS): Agent {
  return {
    tools,

    async run({ messages, system, maxLoops = 5 }: AgentRunParams) {
      const systemPrompt = system || await getDefaultPrompt();
      return processTask({
        messages,
        system: systemPrompt,
        tools: tools as Parameters<typeof processTask>[0]['tools'],
        maxLoops
      });
    },

    async runWithStream({ messages, system, maxLoops = 5, res, sessionId, addMessage }: AgentRunWithStreamParams) {
      const systemPrompt = system || await getDefaultPrompt();
      return processTaskWithStream({
        messages,
        system: systemPrompt,
        tools: tools as Parameters<typeof processTask>[0]['tools'],
        maxLoops,
        res,
        sessionId,
        addMessage
      });
    },

    withTools(additionalTools: ToolSet) {
      return createAgent(additionalTools);
    },

    withToolsById(toolIds: string[]) {
      const filtered: ToolSet = {};
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
