/**
 * 工具服务 - 提供内置工具
 */

import { jsonSchema } from 'ai';
import type { ToolSet } from 'ai';

const cities = ['北京', '上海', '深圳', '广州', '杭州', '成都', '武汉', '西安'];

interface ToolResult {
  output: string;
  title: string;
  metadata: Record<string, unknown>;
}

const getCurrentCityTool = {
  id: 'get_current_city',
  description: '获取用户当前所在的城市',
  inputSchema: jsonSchema({
    type: 'object',
    properties: {}
  }),
  async execute(): Promise<ToolResult> {
    const city = cities[Math.floor(Math.random() * cities.length)];
    return { output: `当前城市: ${city}`, title: '位置信息', metadata: { city } };
  }
};

const getWeatherTool = {
  id: 'get_weather',
  description: '获取指定城市的天气信息',
  inputSchema: jsonSchema({
    type: 'object',
    properties: {
      city: {
        type: 'string',
        description: '城市名称'
      }
    },
    required: ['city']
  }),
  async execute({ city }: { city: string }): Promise<ToolResult> {
    const weathers = ['晴', '多云', '阴', '小雨', '雷阵雨'];
    const weather = weathers[Math.floor(Math.random() * weathers.length)];
    const temp = Math.floor(Math.random() * 20) + 10;
    return { output: `${city}天气：${weather}，${temp}°C`, title: '天气信息', metadata: { city, weather, temperature: `${temp}°C` } };
  }
};

const calculateTool = {
  id: 'calculate',
  description: '执行数学计算',
  inputSchema: jsonSchema({
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: '数学表达式，如 2 + 2'
      }
    },
    required: ['expression']
  }),
  async execute({ expression }: { expression: string }): Promise<ToolResult> {
    try {
      const result = Function(`"use strict"; return (${expression})`)();
      return { output: `${expression} = ${result}`, title: '计算结果', metadata: { expression, result } };
    } catch {
      return { output: '计算表达式无效', title: '计算错误', metadata: { error: '计算表达式无效' } };
    }
  }
};

const getDateTool = {
  id: 'get_date',
  description: '获取当前日期和时间',
  inputSchema: jsonSchema({
    type: 'object',
    properties: {},
    required: []
  }),
  async execute(): Promise<ToolResult> {
    return { output: new Date().toISOString(), title: '当前时间', metadata: { date: new Date().toISOString() } };
  }
};

export const TOOLS: ToolSet = {
  get_current_city: getCurrentCityTool,
  get_weather: getWeatherTool,
  calculate: calculateTool,
  get_date: getDateTool
} as ToolSet;

export async function executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult | { error: string }> {
  const tool = TOOLS[name];
  if (!tool) {
    return { error: `Unknown tool: ${name}` };
  }
  return (tool as { execute: (args: Record<string, unknown>) => Promise<ToolResult> }).execute(args);
}
