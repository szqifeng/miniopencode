# 任务调度平台 - 需求文档

## 一、项目概述

### 1.1 项目背景

本地运行的「AI 任务工作台」，让用户把重复工作沉淀成可一键执行、可自动运行的任务。

核心概念：任务、工具、知识库、聊天

### 1.2 技术栈

| 类别 | 技术选型 |
|------|---------|
| 前端框架 | Vite + React 18 |
| UI 组件库 | Ant Design 5.x |
| 开发语言 | TypeScript |
| 渲染模式 | CSR（客户端渲染） |
| 样式方案 | Ant Design 原生样式 + LESS |

### 1.3 项目特点

- 企业级 Ant Design Pro 风格
- 5 个左右业务页面
- 前后端分离，后端提供 RESTful API
- 前端使用 Mock 数据进行开发
- 支持后期封装为桌面客户端应用

---

## 二、页面规划

### 2.1 页面清单

| 序号 | 页面名称 | 页面路径 | 优先级 | 状态 |
|------|---------|---------|-------|------|
| 1 | 首页 | `/` | 高 | 开发中 |
| 2 | （待确认） | / | - | - |
| 3 | （待确认） | / | - | - |
| 4 | （待确认） | / | - | - |
| 5 | （待确认） | / | - | - |

### 2.2 首页模块状态

| 模块 | 组件 | 状态 |
|------|------|------|
| 任务管理 | `index.tsx` 内嵌 | ✅ 已完成 |
| 工具管理 | `index.tsx` 内嵌 | ✅ 已完成 |
| 知识库 | `index.tsx` 内嵌 | ✅ 已完成 |
| AI 聊天 | `index.tsx` 内嵌 | ✅ 已完成 |

---

## 三、首页详细设计

### 3.0 首页模块概览

首页包含四个核心模块：

| 模块 | 说明 |
|------|------|
| 任务 | 任务列表、执行记录、自动执行 |
| 工具 | 工具列表、工具配置 |
| 知识库 | 知识库内容管理 |
| 聊天 | AI 对话辅助 |

### 3.1 页面布局

```
┌────────────────────────────────────────────────────────────────────────┐
│  任务列表 (左侧栏)   │    主内容区 (任务空间)       │   右侧面板     │
│  ┌──────────────┐   │  ┌─────────────────────┐   │  ┌─────────┐ │
│  │ + 新建任务   │   │  │  任务标题 + 操作      │   │  │ 工具    │ │
│  │              │   │  │  关联工具: xxx       │   │  │ 知识库  │ │
│  │ 任务1 ✓     │   │  │  Cron: xxx           │   │  │ 助手    │ │
│  │ 任务2       │   │  ├─────────────────────┤   │  └─────────┘ │
│  │ 任务3       │   │  │ 已绑定工具│已绑定知识 │   │              │
│  └──────────────┘   │  └─────────────────────┘   │              │
└─────────────────────┴───────────────────────────┴──────────────┘
```

**布局说明：**
- 左侧栏（220px）：任务列表，快速切换任务
- 主内容区：当前任务详情 + 已绑定工具/知识库
- 右侧面板（300px）：工具/知识库/助手 Tab 切换，可绑定到当前任务

### 3.2 工具维护模块

#### 功能说明

- 展示系统中已配置的工具列表
- 支持新建、编辑、删除工具
- 显示工具类型和状态

#### UI 形式

- 卡片网格布局（每行 3-4 张卡片）
- 卡片内容：工具名称、类型标签、状态徽章
- 操作按钮：编辑、删除

#### 数据结构

```typescript
interface Tool {
  id: string;           // 工具 ID
  name: string;         // 工具名称
  type: 'script' | 'api' | 'shell';  // 工具类型
  description: string;  // 工具描述
  status: 'active' | 'inactive';     // 状态
  createdAt: string;    // 创建时间
  updatedAt: string;    // 更新时间
}
```

### 3.3 任务模块

#### 功能说明

- 展示所有配置的任务列表
- 支持任务操作：启动、立即运行、禁用、编辑
- 显示任务状态、执行时间等信息

#### UI 形式

- 卡片列表布局
- 卡片内容：任务名称、关联工具、执行周期、状态、下次执行时间
- 操作按钮：启动、立即运行、禁用、编辑

#### 数据结构

```typescript
interface Task {
  id: string;              // 任务 ID
  name: string;            // 任务名称
  toolId: string;          // 关联工具 ID
  toolName: string;        // 关联工具名称
  cronExpression: string;  // Cron 表达式
  status: 'enabled' | 'disabled';   // 状态
  lastRunTime: string;     // 上次执行时间
  nextRunTime: string;     // 下次执行时间
  createdAt: string;       // 创建时间
  updatedAt: string;       // 更新时间
}
```

### 3.4 AI 聊天窗口

#### 功能说明

- 提供 AI 助手对话功能
- 支持设置聊天参数
- 保存聊天历史

#### UI 形式

- 固定在右侧区域
- 聊天区域：消息气泡展示
- 输入区域：文本输入框 + 发送按钮
- 设置按钮：配置 AI 参数

#### 数据结构

```typescript
interface ChatMessage {
  id: string;           // 消息 ID
  role: 'user' | 'assistant';  // 发送者角色
  content: string;      // 消息内容
  timestamp: string;    // 时间戳
}

interface ChatSettings {
  model: string;        // AI 模型
  temperature: number;  // 温度参数
  maxTokens: number;    // 最大 tokens
}
```

### 3.5 知识库模块（新增）

#### 功能说明

- 管理知识库内容
- 支持文档的上传、编辑、删除
- 为任务提供上下文知识支持

#### UI 形式

- 文档列表布局
- 支持新建文档
- 文档内容编辑

#### 数据结构

```typescript
interface KnowledgeItem {
  id: string;           // 知识项 ID
  title: string;        // 标题
  content: string;      // 内容
  category?: string;     // 分类
  tags?: string[];       // 标签
  createdAt: string;     // 创建时间
  updatedAt: string;     // 更新时间
}
```

---

## 四、API 接口设计

### 4.1 知识库

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/knowledge | 获取知识列表 |
| GET | /api/knowledge/:id | 获取知识详情 |
| POST | /api/knowledge | 创建知识 |
| PUT | /api/knowledge/:id | 更新知识 |
| DELETE | /api/knowledge/:id | 删除知识 |

### 4.2 工具管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/tools | 获取工具列表 |
| GET | /api/tools/:id | 获取工具详情 |
| POST | /api/tools | 创建工具 |
| PUT | /api/tools/:id | 更新工具 |
| DELETE | /api/tools/:id | 删除工具 |

### 4.3 任务管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/tasks | 获取任务列表 |
| GET | /api/tasks/:id | 获取任务详情 |
| POST | /api/tasks | 创建任务 |
| PUT | /api/tasks/:id | 更新任务 |
| DELETE | /api/tasks/:id | 删除任务 |
| POST | /api/tasks/:id/run | 立即运行任务 |
| POST | /api/tasks/:id/enable | 启用任务 |
| POST | /api/tasks/:id/disable | 禁用任务 |

### 4.4 AI 聊天

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/chat | 发送消息 |
| GET | /api/chat/history | 获取聊天历史 |
| GET | /api/chat/settings | 获取聊天设置 |
| PUT | /api/chat/settings | 更新聊天设置 |

---

## 五、Mock 数据

### 5.1 工具 Mock 数据

```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "name": "Python 数据清洗脚本",
      "type": "script",
      "description": "用于清洗业务数据的 Python 脚本",
      "status": "active",
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-10T00:00:00Z"
    },
    {
      "id": "2",
      "name": "用户同步 API",
      "type": "api",
      "description": "从第三方系统同步用户数据",
      "status": "active",
      "createdAt": "2024-01-02T00:00:00Z",
      "updatedAt": "2024-01-12T00:00:00Z"
    },
    {
      "id": "3",
      "name": "日志备份脚本",
      "type": "shell",
      "description": "定期备份系统日志到存储",
      "status": "inactive",
      "createdAt": "2024-01-03T00:00:00Z",
      "updatedAt": "2024-01-15T00:00:00Z"
    }
  ]
}
```

### 5.2 任务 Mock 数据

```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "name": "每日数据清洗",
      "toolId": "1",
      "toolName": "Python 数据清洗脚本",
      "cronExpression": "0 2 * * *",
      "status": "enabled",
      "lastRunTime": "2024-01-14T02:00:00Z",
      "nextRunTime": "2024-01-15T02:00:00Z",
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-10T00:00:00Z"
    },
    {
      "id": "2",
      "name": "用户数据同步",
      "toolId": "2",
      "toolName": "用户同步 API",
      "cronExpression": "0 */6 * * *",
      "status": "enabled",
      "lastRunTime": "2024-01-14T12:00:00Z",
      "nextRunTime": "2024-01-14T18:00:00Z",
      "createdAt": "2024-01-02T00:00:00Z",
      "updatedAt": "2024-01-12T00:00:00Z"
    },
    {
      "id": "3",
      "name": "日志备份",
      "toolId": "3",
      "toolName": "日志备份脚本",
      "cronExpression": "0 0 * * *",
      "status": "disabled",
      "lastRunTime": "2024-01-13T00:00:00Z",
      "nextRunTime": "-",
      "createdAt": "2024-01-03T00:00:00Z",
      "updatedAt": "2024-01-15T00:00:00Z"
    }
  ]
}
```

### 5.3 聊天 Mock 数据

```json
{
  "success": true,
  "data": {
    "reply": "你好！我是 AI 助手，可以帮助你管理任务和工具。有什么我可以帮你的吗？",
    "timestamp": "2024-01-14T10:00:00Z"
  }
}
```

---

## 六、Postman Collection

见附件：`postman/TaskScheduler_API.postman_collection.json`

---

## 七、待确认事项

### 7.1 其他页面功能

| 页面 | 功能描述 | 状态 |
|------|---------|------|
| 页面 2 | （待确认） | 待确认 |
| 页面 3 | （待确认） | 待确认 |
| 页面 4 | （待确认） | 待确认 |
| 页面 5 | （待确认） | 待确认 |

### 7.2 功能细节

- [ ] 任务是否需要分组/分类？
- [ ] 工具类型是否还有其他？（如：Python/Java/Node 等）
- [ ] 聊天窗口是否需要支持多轮对话？
- [ ] 是否需要任务执行日志/历史？

### 7.3 后续扩展

- [ ] 客户端封装方案（Tauri / Electron）
- [ ] 用户认证与权限管理
- [ ] 国际化支持

---

## 八、版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| 0.1.0 | 2024-01-14 | 初始版本，包含首页设计 |
