/**
 * Agent 模块 - Agent 核心控制层
 * 
 * 职责：编排工具，调用 process 执行 React loop
 * 
 * 架构：api -> agent -> process -> llm
 */

import { TOOLS } from '../services/toolService.js';
import { processTask, processTaskWithStream } from './process.js';

/**
 * 创建 Agent 实例
 * 
 * @param {Array} tools - 可用工具列表，默认使用 TOOLS
 * @returns {Object} Agent 实例
 */
export function createAgent(tools = TOOLS) {
  return {
    tools,

    /**
     * 执行任务（非流式）
     */
    async run({ messages, system, maxLoops = 5 }) {
      return processTask({
        messages,
        system,
        tools: this.tools,
        maxLoops
      });
    },

    /**
     * 执行任务（流式）
     */
    async runWithStream({ messages, system, maxLoops = 5, onChunk, onToolCall, onToolResult, onReasoning }) {
      return processTaskWithStream({
        messages,
        system,
        tools: this.tools,
        maxLoops,
        onChunk,
        onToolCall,
        onToolResult,
        onReasoning
      });
    },

    /**
     * 添加额外的工具
     */
    withTools(additionalTools) {
      return createAgent([...this.tools, ...additionalTools]);
    },

    /**
     * 根据工具 ID 过滤工具
     */
    withToolsById(toolIds) {
      const filteredTools = TOOLS.filter(t => toolIds.includes(t.id));
      return createAgent(filteredTools);
    }
  };
}

export const defaultAgent = createAgent();
