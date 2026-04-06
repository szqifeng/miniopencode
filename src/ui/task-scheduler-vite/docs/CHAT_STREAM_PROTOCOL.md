# 聊天流式响应协议

## 概述

前端通过 SSE (Server-Sent Events) 接收后端的流式响应，采用 JSON 帧格式进行数据传输。

## 请求格式

```
POST /api/web/chat/stream
Content-Type: application/json
X-API-Key: <API_KEY>

{
  "sessionId": "web_session_1234567890",
  "messages": [{ "role": "user", "content": "用户输入" }],
  "system": "你是助手，可以调用工具",
  "useTools": true
}
```

## 响应格式 (SSE Stream)

后端返回 `Content-Type: text/event-stream`，每个事件以 `data:` 开头，使用换行分隔。

### 事件类型

| 事件类型 | 说明 | 字段 |
|---------|------|------|
| `start` | 会话开始 | - |
| `reasoning-start` | 推理开始 | - |
| `reasoning-delta` | 推理内容增量 | `text`: 推理文本 |
| `reasoning-end` | 推理结束 | - |
| `tool-input-start` | 工具调用开始 | `toolName`: 工具名称 |
| `tool-input-delta` | 工具输入增量 | `delta`: 输入内容 |
| `tool-input-end` | 工具输入结束 | - |
| `tool-result` | 工具执行结果 | `output`: 结果内容 |
| `text-delta` | 回复文本增量 | `text`: 回复文本 |
| `finish` | 会话结束 | `finishReason`: 结束原因 |

### 示例响应

```
data: {"type":"start"}

data: {"type":"reasoning-start"}

data: {"type":"reasoning-delta","text":"用户想要执行数据清洗任务，"}

data: {"type":"reasoning-delta","text":"我需要调用Python脚本来完成。"}

data: {"type":"reasoning-end"}

data: {"type":"tool-input-start","toolName":"python_data_clean"}

data: {"type":"tool-input-delta","delta":"{\n  \"input\": \"清洗昨日销售数据\"\n}"}

data: {"type":"tool-input-end"}

data: {"type":"tool-result","output":"成功清洗 1234 条数据"}

data: {"type":"text-delta","text":"已完成数据清洗任务，"}data: {"type":"text-delta","text":"共处理 1234 条记录。"}

data: {"type":"finish","finishReason":"stop"}
```

## 前端解析逻辑

```typescript
const handleSendChat = async () => {
  const response = await fetch('/api/web/chat/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': '<API_KEY>',
    },
    body: JSON.stringify({
      sessionId: 'web_session_' + Date.now(),
      messages: [{ role: 'user', content: userMessage }],
      system: '你是助手，可以调用工具',
      useTools: true,
    }),
  });

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value);
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || !trimmedLine.startsWith('data:')) continue;

      const jsonStr = trimmedLine.slice(5).trim();
      if (!jsonStr) continue;

      const parsed = JSON.parse(jsonStr);
      const eventType = parsed.type;

      switch (eventType) {
        case 'start':
          // 初始化状态
          break;
        case 'reasoning-start':
          setThinkingContent('💭 推理中...');
          setIsThinking(true);
          break;
        case 'reasoning-delta':
          setThinkingContent('💭 ' + parsed.text);
          break;
        case 'reasoning-end':
          setThinkingContent('🔧 处理中...');
          break;
        case 'tool-input-start':
          setThinkingContent(`📝 调用工具: ${parsed.toolName}`);
          break;
        case 'tool-input-delta':
          setThinkingContent(prev => prev + parsed.delta);
          break;
        case 'tool-result':
          setThinkingContent(`✅ ${parsed.toolName} 返回: ${parsed.output}`);
          break;
        case 'text-delta':
          setIsThinking(false);
          // 更新消息内容
          break;
        case 'finish':
          setThinkingContent('');
          setIsThinking(false);
          break;
      }
    }
  }
};
```

## 状态管理

| 状态 | 说明 |
|-----|------|
| `chatMessages` | 聊天消息列表 |
| `thinkingContent` | 当前思考/处理中的内容 |
| `isThinking` | 是否正在处理中 |

## 消息类型样式

| 角色 | 样式 |
|-----|------|
| `user` | 蓝色气泡，右对齐 |
| `assistant` | 绿色头像，左对齐 |
| `thinking` | 黄色气泡，显示思考过程 |
| `tool-call` | 紫色气泡，显示工具调用 |
| `tool-input` | 浅蓝气泡，显示工具输入 |
| `text-preview` | 虚线边框，预览状态 |
