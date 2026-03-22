import { jsonSchema } from 'ai';

const cities = ['北京', '上海', '深圳', '广州', '杭州', '成都', '武汉', '西安'];

export const TOOLS = [
  {
    id: 'get_current_city',
    description: '获取用户当前所在的城市',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {}
    }),
    async execute(args, options) {
      const city = cities[Math.floor(Math.random() * cities.length)];
      return { output: `当前城市: ${city}`, title: '位置信息', metadata: { city } };
    }
  },
  {
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
    async execute({ city }, options) {
      const weathers = ['晴', '多云', '阴', '小雨', '雷阵雨'];
      const weather = weathers[Math.floor(Math.random() * weathers.length)];
      const temp = Math.floor(Math.random() * 20) + 10;
      return { output: `${city}天气：${weather}，${temp}°C`, title: '天气信息', metadata: { city, weather, temperature: `${temp}°C` } };
    }
  },
  {
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
    async execute({ expression }, options) {
      try {
        const result = Function(`"use strict"; return (${expression})`)();
        return { output: `${expression} = ${result}`, title: '计算结果', metadata: { expression, result } };
      } catch (e) {
        return { output: '计算表达式无效', title: '计算错误', metadata: { error: '计算表达式无效' } };
      }
    }
  },
  {
    id: 'get_date',
    description: '获取当前日期和时间',
    inputSchema: jsonSchema({
      type: 'object',
      properties: {},
      required: []
    }),
    async execute(args, options) {
      return { output: new Date().toISOString(), title: '当前时间', metadata: { date: new Date().toISOString() } };
    }
  }
];

export async function executeTool(name, args) {
  const tool = TOOLS.find(t => t.id === name);
  if (!tool) {
    return { error: `Unknown tool: ${name}` };
  }
  return tool.execute(args, {});
}