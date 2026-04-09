# Chat Stream Interface Schema

## 已确认接口

```bash
curl --location 'http://localhost:3000/api/web/chat/stream' \
  --header 'Content-Type: application/json' \
  --header 'X-API-Key: om_fixed_api_key_12345' \
  --data '{
    "sessionId": "test_session_001999",
    "messages": [{"role": "user", "content": "深圳天气怎么样，然后看看深圳的邮编"}],
    "useTools": true
  }'
```

## Implementation Notes

- 路由实现位置：`src/app/api.ts`（`POST /api/web/chat/stream`）
- app 专属聊天 agent：`src/app/taskWorkbenchChatAgent.ts`
- 设计原则：`src/agent/*` 仅提供通用 agent 能力；app 业务在 `src/app/*` 通过系统提示词与工具白名单进行组装

安全约束：

- 表格任务工作台的聊天 agent 工具白名单默认不包含 `edit/write`，避免出现写文件/改文件建议

---

## Request Schema

### JSON Schema

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["sessionId", "messages", "useTools"],
  "properties": {
    "sessionId": {
      "type": "string"
    },
    "messages": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["role", "content"],
        "properties": {
          "role": {
            "type": "string",
            "enum": ["user", "assistant"]
          },
          "content": {
            "type": "string"
          }
        }
      }
    },
    "useTools": {
      "type": "boolean"
    }
  }
}
```

### TypeScript

```ts
type ChatStreamMessage = {
  role: "user" | "assistant"
  content: string
}

type ChatStreamRequest = {
  sessionId: string
  messages: ChatStreamMessage[]
  useTools: boolean
}
```

---

## Response Transport

- 协议：`text/event-stream`
- 帧格式：每行以 `data:` 开头
- 一次 HTTP 请求内，可能出现多轮 `start -> finish`
- 前端不能在第一次 `finish` 就结束
- 只有 `type = "finish"` 且 `finishReason = "stop"` 才算本次请求真正完成
- `[DONE]` 是流结束标记，不等价于业务完成

---

## Event Schema

### 核心事件集合

```ts
type ChatStreamEvent =
  | { type: "start" }
  | { type: "start-step"; request: { body: Record<string, unknown>; warnings?: unknown[] } }
  | { type: "reasoning-start"; id: string }
  | { type: "reasoning-delta"; id: string; text: string; providerMetadata?: Record<string, unknown> }
  | { type: "reasoning-end"; id: string }
  | { type: "text-start"; id: string }
  | { type: "text-delta"; id: string; text: string }
  | { type: "text-end"; id: string }
  | { type: "tool-input-start"; id: string; toolName: string; dynamic?: boolean }
  | { type: "tool-input-delta"; id: string; delta: string }
  | { type: "tool-input-end"; id: string }
  | { type: "tool-call"; toolCallId: string; toolName: string; input: Record<string, unknown> }
  | { type: "tool-result"; toolCallId: string; toolName: string; input: Record<string, unknown>; output: unknown; dynamic?: boolean }
  | { type: "finish-step"; finishReason: "tool-calls" | "stop" | string; rawFinishReason?: string }
  | { type: "finish"; finishReason: "tool-calls" | "stop" | string; rawFinishReason?: string }
```

### 实际已观测到的事件类型

- `start`
- `start-step`
- `reasoning-start`
- `reasoning-delta`
- `reasoning-end`
- `text-start`
- `text-delta`
- `text-end`
- `tool-input-start`
- `tool-input-delta`
- `tool-input-end`
- `tool-call`
- `tool-result`
- `finish-step`
- `finish`

---

## Event Semantics

### `start`

- 一轮处理开始
- 可视为当前 step 的初始化

### `start-step`

- 返回本轮 step 的请求上下文
- 常包含模型、消息、tools 和 stream 配置

### `reasoning-*`

- 表示模型推理过程
- 前端应作为阶段气泡展示
- 不应累积到最终 Markdown 回复里

### `text-*`

- 只有 `text-delta` 需要累积
- 最终 assistant 内容应由 `text-delta` 拼接而成
- 拼接结果按 Markdown 渲染

### `tool-*`

- 表示工具参数生成、工具调用、工具结果返回
- 前端应作为阶段气泡展示
- 不应直接并入最终 Markdown 正文

### `finish-step`

- 表示当前 step 结束
- 若 `finishReason = "tool-calls"`，说明本次请求还会继续进入下一轮

### `finish`

- `finishReason = "tool-calls"`：未完成，继续等待
- `finishReason = "stop"`：本次请求完成

---

## Frontend Rules

当前前端解析应满足：

1. 一次 SSE 请求只维护一个 assistant 气泡
2. `text` 类型才渲染 Markdown
3. `reasoning / tool / status` 只展示单行阶段内容
4. 非最终阶段内容只作为临时展示，不堆积
5. 最终停留在 `text-delta` 累积结果
6. 只有 `finishReason === "stop"` 才结束本次请求

---

## 代码落点

- TypeScript 类型：`src/services/types.ts`
- Schema 常量：`src/services/chatStreamSchema.ts`
- 协议说明：`docs/CHAT_STREAM_PROTOCOL.md`
