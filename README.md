# MiniOpenCode

文本总结与分类 API 服务。

## 技术栈

- **运行时**: Node.js 22+
- **框架**: Express.js
- **AI SDK**: Vercel AI SDK (`ai`) + Anthropic SDK
- **认证**: API Key (`X-API-Key` header)

## 运行与安装

```bash
# 安装依赖
npm install

# 复制环境变量配置
cp .env.example .env
# 编辑 .env 填入配置

# 启动服务
npm start

# 开发模式（热重载）
npm run dev
```

服务启动后访问 `http://localhost:3000`

## 配置说明

启动脚本需在 `.env` 文件中配置以下环境变量：

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `API_KEY` | 是 | API 认证密钥，用于 `X-API-Key` 请求头验证 |
| `MINIMAX_CN_API_KEY` | 是 | MiniMax AI 接口密钥，用于调用 AI 模型 |
| `STORAGE_TYPE` | 否 | 存储类型，默认 `file` |
| `PORT` | 否 | 服务端口，默认 `3000` |

**示例 `.env` 文件：**

```env
API_KEY=your_fixed_api_key_here
MINIMAX_CN_API_KEY=your_minimax_api_key_here
STORAGE_TYPE=file
PORT=3000
```

## API 访问文档

### 认证

所有 `/api/*` 接口需要在 Header 中携带 API Key：

```
X-API-Key: om_fixed_api_key_12345
```

### 接口列表

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/summarize` | POST | 文本总结 |
| `/api/summarize/stream` | POST | 文本总结（流式） |
| `/api/classify` | POST | 文本分类 |
| `/api/classify/stream` | POST | 文本分类（流式） |
| `/api/records` | GET | 获取历史记录列表 |
| `/api/records/:id` | GET | 获取单条记录 |
| `/api/records/:id` | DELETE | 删除记录 |

### 文本总结

**POST** `/api/summarize`

```bash
curl -X POST http://localhost:3000/api/summarize \
  -H "Content-Type: application/json" \
  -H "X-API-Key: om_fixed_api_key_12345" \
  -d '{"text": "人工智能是计算机科学的一个重要分支。"}'
```

**Request Body:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| text | string | 是 | 要总结的文本内容 |
| maxLength | number | 否 | 摘要最大长度，默认 200 |
| useTools | boolean | 否 | 是否启用工具调用，默认 false |

**Response:**

```json
{
  "id": "uuid",
  "summary": "总结后的简短内容...",
  "originalLength": 1000,
  "operation": "summarize",
  "createdAt": "2026-03-21T10:00:00.000Z"
}
```

### 文本总结（流式）

**POST** `/api/summarize/stream`

```bash
curl -X POST http://localhost:3000/api/summarize/stream \
  -H "Content-Type: application/json" \
  -H "X-API-Key: om_fixed_api_key_12345" \
  -d '{"text": "要总结的长文本内容..."}'
```

### 文本分类

**POST** `/api/classify`

```bash
curl -X POST http://localhost:3000/api/classify \
  -H "Content-Type: application/json" \
  -H "X-API-Key: om_fixed_api_key_12345" \
  -d '{"text": "苹果发布了新一代iPhone", "categories": ["科技", "娱乐", "新闻"]}'
```

**Request Body:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| text | string | 是 | 待分类的文本内容 |
| categories | string[] | 否 | 分类类别列表，默认 ["科技", "娱乐", "新闻", "生活", "其他"] |
| useTools | boolean | 否 | 是否启用工具调用，默认 false |

**Response:**

```json
{
  "id": "uuid",
  "predictedCategory": "科技",
  "confidence": 0.95,
  "categories": ["科技", "娱乐", "新闻"],
  "operation": "classify",
  "createdAt": "2026-03-21T10:05:00.000Z"
}
```

### 工具调用

当 `useTools: true` 时，接口支持工具调用和链式调用功能。

**可用工具：**

| 工具 ID | 描述 | 参数 |
|---------|------|------|
| `get_current_city` | 获取用户当前所在的城市 | 无 |
| `get_weather` | 获取指定城市的天气信息 | city (string) |
| `calculate` | 执行数学计算 | expression (string) |
| `get_date` | 获取当前日期和时间 | 无 |

### 获取记录

**GET** `/api/records?limit=20&offset=0`

```json
{
  "records": [...],
  "total": 50,
  "limit": 20,
  "offset": 0
}
```

### 获取单条记录

**GET** `/api/records/:id`

### 删除记录

**DELETE** `/api/records/:id`
