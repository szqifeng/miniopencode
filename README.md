# MiniOpenCode

AI Agent 服务，支持工具调用的流式对话。

## 架构图

参考 [AIAgent架构图](docs/AIAgent架构图.md)

```
User → Gateway → Agent → Process → LLM
                      ↓
                    Tools
```

## 项目结构

```
miniopencode/
├── src/
│   ├── app.js              # Express 应用入口
│   ├── index.js            # 服务启动入口
│   ├── agent/
│   │   ├── index.js        # Agent 核心控制层
│   │   ├── api.js          # API 路由
│   │   ├── cli.js          # CLI 模块
│   │   ├── llm.js          # LLM 对话封装
│   │   ├── process.js      # React loop 执行
│   │   └── ws.js           # WebSocket 模块
│   ├── middleware/
│   │   └── auth.js         # API 认证中间件
│   ├── models/
│   │   └── textRecord.js   # 数据记录模型
│   └── services/
│       ├── storageFactory.js # 存储抽象工厂
│       └── toolService.js   # 工具服务
├── tests/                   # 测试文件
├── examples/                # 使用示例
├── docs/                    # 文档
├── postman_collection.json   # Postman 测试集合
├── package.json
└── README.md
```

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
| `/api/web/chat/stream` | POST | 流式对话（支持工具调用） |

### 流式对话

**POST** `/api/web/chat/stream`

```bash
curl -X POST http://localhost:3000/api/web/chat/stream \
  -H "Content-Type: application/json" \
  -H "X-API-Key: om_fixed_api_key_12345" \
  -d '{"messages": [{"role": "user", "content": "深圳天气怎么样"}], "system": "你是助手", "useTools": true}'
```

**Request Body:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| messages | array | 是 | 对话消息列表 |
| system | string | 否 | 系统提示词 |
| useTools | boolean | 否 | 是否启用工具调用，默认 false |

**Response (SSE):**

```
data: {"type": "text-delta", "textDelta": "你"}

data: {"type": "tool-call", "tool": "get_current_city", "args": {}}

data: {"type": "tool-result", "tool": "get_current_city", "result": {...}}

data: [DONE]
```

### 工具调用

当 `useTools: true` 时，支持工具调用和链式调用功能。

**可用工具：**

| 工具 ID | 描述 | 参数 |
|---------|------|------|
| `get_current_city` | 获取用户当前所在的城市 | 无 |
| `get_weather` | 获取指定城市的天气信息 | city (string) |
| `calculate` | 执行数学计算 | expression (string) |
| `get_date` | 获取当前日期和时间 | 无 |

## 许可证

MIT License
