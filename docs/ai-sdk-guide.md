# AI SDK 与工具调用原理

## 概述

本文档讲解 Vercel AI SDK 的使用规范，以及项目中工具调用和流式处理的工作流程。

---

## 1. AI SDK 使用规范

### 1.1 核心概念

AI SDK 提供了一套统一的接口来调用各种 LLM 提供者。本项目使用 `@ai-sdk/anthropic` 作为提供者实现。

**标准调用模式：**

```javascript
import { streamText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';

const provider = createAnthropic({
  apiKey: API_KEY,
  baseURL: 'https://api.minimaxi.com/anthropic/v1'
});

const result = await streamText({
  model: provider(MODEL),
  maxTokens: 8192,
  system: '系统提示词',
  messages: [{ role: 'user', content: '用户输入' }]
});
```

### 1.2 关键参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `model` | Model | 使用的模型实例 |
| `maxTokens` | number | 最大生成 token 数 |
| `system` | string | 系统提示词 |
| `messages` | Message[] | 对话历史 |
| `tools` | Tool[] | 可用工具列表 |
| `toolCallStreaming` | boolean | 是否开启工具调用流式输出 |

### 1.3 流式处理

使用 `for await...of` 遍历 `result.fullStream`：

```javascript
for await (const delta of result.fullStream) {
  // delta 是流式输出的最小单位
}
```

---

## 2. value.type 生命周期

### 2.1 事件类型一览

`streamText` 返回的 `fullStream` 会产生以下类型的 `delta` 对象：

| type | 说明 | 典型场景 |
|------|------|----------|
| `text-delta` | 文本增量 | 正常对话输出 |
| `tool-call` | 工具调用请求 | 模型要求调用工具 |
| `tool-result` | 工具执行结果 | 工具返回结果 |
| `reasoning` | 推理过程 | 模型思考过程 |
| `finish-step` | 步骤结束 | 本轮生成完成 |
| `error` | 错误 | 发生错误 |

### 2.2 生命周期时序

**一次完整的工具调用流程：**

```
用户输入
   │
   ▼
┌─────────────────────────────────────────┐
│  text-delta: "我来帮你查询天气..."      │  助手开始回复
├─────────────────────────────────────────┤
│  tool-call: { tool: "get_current_city" }│  模型决定调用工具
├─────────────────────────────────────────┤
│  tool-result: { city: "北京" }          │  工具执行结果
├─────────────────────────────────────────┤
│  tool-call: { tool: "get_weather" }     │  模型再次调用工具
├─────────────────────────────────────────┤
│  tool-result: { weather: "晴" }         │  工具执行结果
├─────────────────────────────────────────┤
│  text-delta: "北京今天天气晴，25°C..." │  最终回答
├─────────────────────────────────────────┤
│  finish-step: { finishReason: "stop" }  │  生成结束
└─────────────────────────────────────────┘
```

### 2.3 finishReason 枚举

| 值 | 说明 |
|----|------|
| `stop` | 正常停止，生成完成 |
| `tool-calls` | 停止但需要工具调用（进入下一轮） |
| `length` | 达到 maxTokens 限制 |
| `content-filter` | 内容被过滤 |
| `error` | 发生错误 |

---

## 3. 五轮循环与工具调用

### 3.1 循环结构

工具调用支持链式调用，最多 5 轮：

```javascript
for (let loop = 0; loop < 5; loop++) {
  const result = await streamText({
    model: provider(MODEL),
    maxTokens: 8192,
    system: `你是一个智能助手，可以调用工具来完成任务。`,
    messages,
    tools: TOOLS,
    toolCallStreaming: true
  });

  // 处理流式输出...

  // 退出条件判断
  if (!hasToolCalls || toolResults.length === 0 || finishReason !== 'tool-calls') {
    break;
  }

  // 累积消息，继续下一轮
  messages.push({ role: 'assistant', content: assistantMessage });
  messages.push({ role: 'user', content: `工具执行结果：\n${toolResultsText}` });
}
```

### 3.2 循环流程图

```
                    ┌─────────────────────────────────────────┐
                    │         第 1 轮 (loop=0)               │
                    │  messages = [user]                     │
                    │                                         │
                    │  ┌─────────────────────────────────┐   │
                    │  │ assistant: "我来帮你查询天气..."  │   │
                    │  │ tool_call: get_current_city      │   │
                    │  │ tool_result: {city: "北京"}      │   │
                    │  └─────────────────────────────────┘   │
                    └──────────────────┬──────────────────────┘
                                       │
                          finishReason === 'tool-calls' ?
                                       │
                    ┌──────────────────┴──────────────────────┐
                    │ yes                                      │ no
                    ▼                                          ▼
┌─────────────────────────────────────────┐    ┌─────────────────────────┐
│         第 2 轮 (loop=1)               │    │  退出循环，输出最终结果  │
│  messages = [user, assistant, user]     │    └─────────────────────────┘
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ assistant: ""                     │   │
│  │ tool_call: get_weather(city)     │   │
│  │ tool_result: {weather: "晴"}      │   │
│  └─────────────────────────────────┘   │
└──────────────────┬──────────────────────┘
                   │
                   │ ... (最多到 loop=4)
                   │
                   ▼
┌─────────────────────────────────────────┐
│  达到 5 轮上限，强制退出                │
└─────────────────────────────────────────┘
```

### 3.3 消息累积规则

每次工具调用后，需要将对话历史累积起来传递给下一轮：

```javascript
// 初始消息
let messages = [{ role: 'user', content: text }];

// 第一轮结束后
messages.push({ role: 'assistant', content: assistantMessage });
messages.push({ role: 'user', content: `工具执行结果：\n${toolResultsText}` });

// 第二轮结束后，同样处理...
messages.push({ role: 'assistant', content: assistantMessage });
messages.push({ role: 'user', content: `工具执行结果：\n${toolResultsText}` });
```

这样模型能看到完整的对话上下文，包括工具调用过程和结果。

---

## 4. 停止逻辑

### 4.1 退出条件

循环退出需要同时满足以下条件之一：

```javascript
if (!hasToolCalls || toolResults.length === 0 || finishReason !== 'tool-calls') {
  break;
}
```

| 条件 | 说明 |
|------|------|
| `!hasToolCalls` | 模型没有发起工具调用 |
| `toolResults.length === 0` | 工具没有返回结果 |
| `finishReason !== 'tool-calls'` | 停止原因不是需要工具调用 |

### 4.2 状态机

```
                    开始
                      │
                      ▼
               ┌─────────────┐
               │  等待流结束  │
               └──────┬──────┘
                      │
                      ▼
        ┌─────────────────────────────┐
        │    hasToolCalls === true    │
        │    && toolResults.length > 0 │
        │    && finishReason ===      │
        │        'tool-calls'         │
        └─────────────┬───────────────┘
                      │
          ┌───────────┴───────────┐
          │ yes                  │ no
          ▼                      ▼
    ┌─────────────┐      ┌─────────────┐
    │  loop < 5 ?  │      │   退出循环   │
    └──────┬──────┘      └─────────────┘
           │
     ┌─────┴─────┐
     │ yes       │ no
     ▼           ▼
┌─────────┐ ┌─────────────┐
│ 下一轮  │ │  退出循环   │
└─────────┘ └─────────────┘
```

---

## 5. 工具定义规范

### 5.1 工具结构

```javascript
{
  id: 'tool_name',           // 工具唯一标识
  description: '工具描述',    // 供模型理解工具用途
  inputSchema: jsonSchema({  // 输入参数 schema
    type: 'object',
    properties: {
      paramName: {
        type: 'string',
        description: '参数描述'
      }
    },
    required: ['paramName']
  }),
  async execute(args, options) {
    // 工具执行逻辑
    return {
      output: '结果',
      title: '标题',
      metadata: {}
    };
  }
}
```

### 5.2 执行结果格式

```javascript
return {
  output: '用户可见的输出文本',
  title: '结果的标题',
  metadata: {
    // 附加数据，供调试用
  }
};
```

---

## 6. 项目工作流

### 6.1 请求处理流程

```
HTTP 请求
   │
   ▼
┌─────────────────┐
│ authMiddleware  │  验证 API_KEY
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  路由处理       │
│  /api/summarize │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│  创建 provider                  │
│  createAnthropic({...})         │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  调用 streamText               │
│  (可能进入工具调用循环)         │
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  保存 record 到 storage         │
└────────┬────────────────────────┘
         │
         ▼
      HTTP 响应
```

### 6.2 流式响应格式

SSE (Server-Sent Events) 格式：

```javascript
// 文本片段
data: {"type":"text","text":"这是"}

 // 工具调用请求
data: {"type":"tool_call","tool":"get_weather","args":{"city":"北京"}}

// 工具执行结果
data: {"type":"tool_result","tool":"get_weather","result":{"weather":"晴"}}

// 推理过程
data: {"type":"reasoning","text":"思考过程..."}

// 结束标记
data: [DONE]
```

---

## 7. 注意事项

1. **避免无限循环**：确保 `finishReason` 判断正确，防止死循环
2. **消息累积**：每轮结束后要正确累积 `messages`，否则模型丢失上下文
3. **错误处理**：工具执行可能失败，需要返回有意义的错误信息
4. **资源清理**：流式响应必须正确发送 `[DONE]` 并调用 `res.end()`
5. **maxTokens 设置**：工具调用场景下 `maxTokens` 不宜过小，防止截断
