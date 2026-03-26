/**
 * Agent 模块 - Agent 核心控制层
 * 
 * 职责：编排工具，调用 process 执行 React loop
 */

import { TOOLS } from '../services/toolService.js';
import { processTask, processTaskWithStream } from './process.js';
import { LLMMessage, Message } from './types.js';
import type { LLMRes } from './llm.js';

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

export function createAgent(tools: unknown = TOOLS): Agent {
  return {
    tools,

    async run({ messages, system, maxLoops = 5 }: AgentRunParams) {
      return processTask({
        messages,
        system,
        tools: tools as Parameters<typeof processTask>[0]['tools'],
        maxLoops
      });
    },

    async runWithStream({ messages, system, maxLoops = 5, res, sessionId, addMessage }: AgentRunWithStreamParams) {
      return processTaskWithStream({
        messages,
        system,
        tools: tools as Parameters<typeof processTask>[0]['tools'],
        maxLoops,
        res,
        sessionId,
        addMessage
      });
    },

    withTools(additionalTools: unknown) {
      return createAgent(additionalTools);
    },

    withToolsById(toolIds: string[]) {
      const filtered: Record<string, unknown> = {};
      for (const id of toolIds) {
        if ((TOOLS as Record<string, unknown>)[id]) {
          filtered[id] = (TOOLS as Record<string, unknown>)[id];
        }
      }
      return createAgent(filtered);
    }
  };
}

export const defaultAgent = createAgent();
