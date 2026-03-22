# OneMindBack - API 接口文档

## 基本信息

| 项目 | 值 |
|------|-----|
| Base URL | `http://localhost:3000` |
| 认证方式 | API Key |
| 认证 Header | `X-API-Key` |

---

## 认证

所有 `/api/*` 请求需要在 Header 中携带 API Key：

```
X-API-Key: om_fixed_api_key_12345
```

---

## 接口列表

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/summarize` | POST | 文本总结 |
| `/api/summarize/stream` | POST | 文本总结（流式） |
| `/api/classify` | POST | 文本分类 |
| `/api/classify/stream` | POST | 文本分类（流式） |
| `/api/records` | GET | 获取历史记录列表 |
| `/api/records/:id` | GET | 获取单条记录 |
| `/api/records/:id` | DELETE | 删除记录 |

---

## 1. 文本总结

**POST** `/api/summarize`

**Request Body：**
```json
{
  "text": "要总结的长文本内容...",
  "maxLength": 200,
  "useTools": false
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| text | string | 是 | 要总结的文本内容 |
| maxLength | number | 否 | 摘要最大长度，默认 200 |
| useTools | boolean | 否 | 是否启用工具调用，默认 false |

**Response (200)：**
```json
{
  "id": "uuid",
  "summary": "总结后的简短内容...",
  "originalLength": 1000,
  "operation": "summarize",
  "createdAt": "2026-03-21T10:00:00.000Z"
}
```

---

## 2. 文本总结（流式）

**POST** `/api/summarize/stream`

**Request Body：**
```json
{
  "text": "要总结的长文本内容...",
  "maxLength": 200,
  "useTools": false
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| text | string | 是 | 要总结的文本内容 |
| maxLength | number | 否 | 摘要最大长度，默认 200 |
| useTools | boolean | 否 | 是否启用工具调用，默认 false |

**Response**: `text/event-stream`

**SSE 事件格式：**

| type | 说明 |
|------|------|
| text | 文本内容片段 |
| tool_call | 工具调用请求 |
| tool_result | 工具执行结果 |
| reasoning | 推理过程 |
| finish-step | 步骤结束信息 |
| finish | 最终结束信息 |
| 其他 | 其他类型的事件 |

**示例：**
```
data: {"type":"text","text":"这是"}
data: {"type":"text","text":"摘要内容"}
data: {"type":"tool_call","tool":"get_weather","args":{"city":"北京"}}
data: {"type":"tool_result","tool":"get_weather","result":{"temp":25}}
data: {"type":"reasoning","text":"思考过程..."}
data: [DONE]
```

---

## 3. 文本分类

**POST** `/api/classify`

**Request Body：**
```json
{
  "text": "待分类的文本内容",
  "categories": ["科技", "娱乐", "新闻", "生活", "其他"],
  "useTools": false
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| text | string | 是 | 待分类的文本内容 |
| categories | string[] | 否 | 分类类别列表，默认 ["科技", "娱乐", "新闻", "生活", "其他"] |
| useTools | boolean | 否 | 是否启用工具调用，默认 false |

**Response (200)：**
```json
{
  "id": "uuid",
  "predictedCategory": "科技",
  "confidence": 0.95,
  "categories": ["科技", "娱乐", "新闻", "生活", "其他"],
  "operation": "classify",
  "createdAt": "2026-03-21T10:05:00.000Z"
}
```

---

## 4. 文本分类（流式）

**POST** `/api/classify/stream`

**Request Body：**
```json
{
  "text": "待分类的文本内容",
  "categories": ["科技", "娱乐", "新闻", "生活", "其他"],
  "useTools": false
}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| text | string | 是 | 待分类的文本内容 |
| categories | string[] | 否 | 分类类别列表，默认 ["科技", "娱乐", "新闻", "生活", "其他"] |
| useTools | boolean | 否 | 是否启用工具调用，默认 false |

**Response**: `text/event-stream`

SSE 事件格式同 `/api/summarize/stream`

---

## 5. 工具调用

### 5.1 概述

当 `useTools: true` 时，接口支持**工具调用**和**链式调用**功能。

### 5.2 可用工具

| 工具 ID | 描述 | 参数 |
|---------|------|------|
| `get_current_city` | 获取用户当前所在的城市 | 无 |
| `get_weather` | 获取指定城市的天气信息 | city (string) |
| `calculate` | 执行数学计算 | expression (string) |
| `get_date` | 获取当前日期和时间 | 无 |

### 5.3 链式调用流程

工具调用支持**链式调用**，最多 5 轮：

```
                    ┌─────────────────────────────────────────┐
                    │         第 1 轮 (loop=0)               │
                    │  messages = [user]                      │
                    │                                         │
                    │  ┌─────────────────────────────────┐   │
                    │  │ assistant: "我来帮你查询天气..."  │   │
                    │  │ tool_call: get_current_city      │   │
                    │  │ tool_result: {city: "杭州"}      │   │
                    │  └─────────────────────────────────┘   │
                    └──────────────────┬──────────────────────┘
                                       │
                                       ▼
                    ┌─────────────────────────────────────────┐
                    │         第 2 轮 (loop=1)               │
                    │  messages = [user, assistant, user]     │
                    │                                         │
                    │  ┌─────────────────────────────────┐   │
                    │  │ assistant: ""                     │   │
                    │  │ tool_call: get_weather(city)    │   │
                    │  │ tool_result: {weather: "小雨"}  │   │
                    │  └─────────────────────────────────┘   │
                    └──────────────────┬──────────────────────┘
                                       │
                                       ▼
                    ┌─────────────────────────────────────────┐
                    │         第 3 轮 (loop=2)               │
                    │  messages = [user, assistant, user,      │
                    │              assistant, user]           │
                    │                                         │
                    │  assistant: "杭州今天小雨，25°C..."    │
                    │  finishReason: stop                     │
                    └─────────────────────────────────────────┘
```

**消息累积规则：**
- 每次工具调用后，将 assistant 回复和工具结果追加到 messages
- 下一轮调用时传递完整的对话历史
- 提前退出条件：`finishReason !== 'tool-calls'` 或达到 5 轮上限

### 5.4 示例

**请求：**
```bash
curl -X POST http://localhost:3000/api/sdk/summarize/stream \
  -H "Content-Type: application/json" \
  -H "X-API-Key: om_fixed_api_key_12345" \
  -d '{"text": "查一下我这里天气怎么样", "useTools": true}'
```

**典型流程：**
1. 模型调用 `get_current_city` 获取城市
2. 模型调用 `get_weather(city)` 获取天气
3. 模型基于工具结果返回最终回答

---

## 6. 获取记录列表

**GET** `/api/records?limit=20&offset=0`

**Response (200)：**
```json
{
  "records": [...],
  "total": 50,
  "limit": 20,
  "offset": 0
}
```

---

## 7. 获取单条记录

**GET** `/api/records/:id`

---

## 8. 删除记录

**DELETE** `/api/records/:id`

---

## curl 测试

```bash
# 文本总结（普通）
curl -X POST http://localhost:3000/api/summarize \
  -H "Content-Type: application/json" \
  -H "X-API-Key: om_fixed_api_key_12345" \
  -d '{"text": "人工智能是计算机科学的一个重要分支。"}'

# 文本总结（工具调用）
curl -X POST http://localhost:3000/api/summarize \
  -H "Content-Type: application/json" \
  -H "X-API-Key: om_fixed_api_key_12345" \
  -d '{"text": "查一下我这里天气怎么样", "useTools": true}'

# 文本分类
curl -X POST http://localhost:3000/api/classify \
  -H "Content-Type: application/json" \
  -H "X-API-Key: om_fixed_api_key_12345" \
  -d '{"text": "苹果发布了新一代iPhone", "categories": ["科技", "娱乐", "新闻"]}'

# 文本总结（流式）
curl -X POST http://localhost:3000/api/summarize/stream \
  -H "Content-Type: application/json" \
  -H "X-API-Key: om_fixed_api_key_12345" \
  -d '{"text": "要总结的长文本内容..."}'

# 文本总结（流式+工具调用）
curl -X POST http://localhost:3000/api/summarize/stream \
  -H "Content-Type: application/json" \
  -H "X-API-Key: om_fixed_api_key_12345" \
  -d '{"text": "查一下我这里天气怎么样", "useTools": true}'
```

---

*最后更新：2026-03-21*