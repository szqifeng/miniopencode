# AGENTS.md - 任务调度平台开发规范

## 项目信息

- **项目名称**: task-scheduler-vite
- **技术栈**: Vite + React 18 + TypeScript + Ant Design 5.x
- **UI 库**: Ant Design (antd)
- **渲染模式**: CSR（客户端渲染）
- **包管理**: npm

## 参考文档

- **Ant Design 官方文档**: https://ant.design/
- **Ant Design LLM 文档**: https://ant.design/llms.txt （用于分析 Ant Design 组件使用方法）
- **Ant Design LLM 完整文档**: https://ant.design/llms-full.txt （完整 API 参考）
- **React**: https://react.dev/
- **Vite**: https://vitejs.dev/

## 项目初始化

```bash
# 进入项目目录
cd task-scheduler-vite

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

## 开发规范

### 代码风格

- **组件文件**: PascalCase.tsx (如 `ToolsPanel.tsx`)
- **工具函数**: camelCase.ts (如 `api.ts`)
- **样式文件**: 组件同名的 `.less` 文件
- **类型定义**: `services/types.ts` 集中定义

### 目录结构

```
src/
├── main.tsx                    # React 入口
├── App.tsx                     # 根组件（全局配置在此）
├── App.css                     # 根样式
├── index.css                   # 全局样式
├── mock/
│   └── index.ts               # Mock 服务（劫持 fetch）
├── pages/
│   └── dashboard/             # 首页
│       ├── index.tsx          # 首页入口（单文件包含所有模块）
│       └── index.less         # 首页样式
└── services/                  # API 和类型
    ├── api.ts                 # API 请求函数
    └── types.ts               # TypeScript 类型定义
```

### 数据类型定义

所有数据类型集中在 `src/services/types.ts`：

```typescript
// 工具
interface Tool {
  id: string;
  name: string;
  type: 'script' | 'api' | 'shell';
  description: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

// 任务
interface Task {
  id: string;
  name: string;
  toolId: string;
  toolName: string;
  cronExpression: string;
  status: 'enabled' | 'disabled';
  lastRunTime: string;
  nextRunTime: string;
  createdAt: string;
  updatedAt: string;
}

// 知识库
interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  category?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

// 聊天消息
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

// 聊天设置
interface ChatSettings {
  model: string;
  temperature: number;
  maxTokens: number;
}

// API 统一响应
interface Response<T = any> {
  success: boolean;
  data?: T;
  errorMessage?: string;
  total?: number;
}
```

## API 接口规范

### 统一响应格式

```typescript
// 成功响应
{ "success": true, "data": [...] }

// 失败响应
{ "success": false, "errorMessage": "错误信息" }
```

### 知识库 API

| 方法 | 路径 | 说明 | 请求体 |
|------|------|------|--------|
| GET | /api/knowledge | 获取知识列表 | - |
| GET | /api/knowledge/:id | 获取知识详情 | - |
| POST | /api/knowledge | 创建知识 | `{ title, content, category, tags }` |
| PUT | /api/knowledge/:id | 更新知识 | `{ title, content, category, tags }` |
| DELETE | /api/knowledge/:id | 删除知识 | - |

### 工具管理 API

| 方法 | 路径 | 说明 | 请求体 |
|------|------|------|--------|
| GET | /api/tools | 获取工具列表 | - |
| GET | /api/tools/:id | 获取工具详情 | - |
| POST | /api/tools | 创建工具 | `{ name, type, description, status }` |
| PUT | /api/tools/:id | 更新工具 | `{ name, type, description, status }` |
| DELETE | /api/tools/:id | 删除工具 | - |

### 任务管理 API

| 方法 | 路径 | 说明 | 请求体 |
|------|------|------|--------|
| GET | /api/tasks | 获取任务列表 | - |
| GET | /api/tasks/:id | 获取任务详情 | - |
| POST | /api/tasks | 创建任务 | `{ name, toolId, cronExpression, status }` |
| PUT | /api/tasks/:id | 更新任务 | `{ name, toolId, cronExpression, status }` |
| DELETE | /api/tasks/:id | 删除任务 | - |
| POST | /api/tasks/:id/run | 立即运行 | - |
| POST | /api/tasks/:id/enable | 启用任务 | - |
| POST | /api/tasks/:id/disable | 禁用任务 | - |

### AI 聊天 API

| 方法 | 路径 | 说明 | 请求体 |
|------|------|------|--------|
| POST | /api/chat | 发送消息 | `{ message }` |
| GET | /api/chat/history | 获取聊天历史 | `?limit=20` |
| GET | /api/chat/settings | 获取聊天设置 | - |
| PUT | /api/chat/settings | 更新聊天设置 | `{ model, temperature, maxTokens }` |

## Mock 数据开发

Mock 服务通过劫持 `window.fetch` 实现，代码在 `src/mock/index.ts`。

### 工作原理

```typescript
// 1. 在 App.tsx 中调用
setupMockServer();

// 2. setupMockServer() 会劫持 window.fetch
// 3. 页面中使用 mockFetch 发送请求
const res = await (window as any).mockFetch('/api/tools');
const result = await res.json();
```

### 添加新的 Mock API

在 `src/mock/index.ts` 中的 `mockHandlers` 对象添加：

```typescript
export const mockHandlers = {
  // ... 现有 API ...

  // 新增 API 示例
  'GET /api/your-endpoint': (params: any) => {
    return { success: true, data: [...] };
  },

  'POST /api/your-endpoint': (params: any, body: any) => {
    return { success: true, data: { ...body, id: 'new-id' } };
  },
};
```

## 组件开发规范

### 创建新组件

1. 在 `src/pages/` 下创建组件目录
2. 创建 `ComponentName.tsx` 和 `ComponentName.less`
3. 在需要使用的地方 import

### 组件示例

```typescript
// src/pages/example/index.tsx
import { Card } from 'antd';
import './index.less';

interface Props {
  title: string;
}

export default function Example({ title }: Props) {
  return (
    <Card title={title} className="example-card">
      {/* 组件内容 */}
    </Card>
  );
}
```

### 状态管理

使用 React Hooks 管理组件状态：

```typescript
import { useState, useEffect } from 'react';

function MyComponent() {
  const [data, setData] = useState<DataType[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await (window as any).mockFetch('/api/data');
      const result = await res.json();
      if (result.success) {
        setData(result.data);
      }
    } finally {
      setLoading(false);
    }
  };

  return <div>{/* render */}</div>;
}
```

## 页面路由

当前使用单页面结构，路由定义在 `src/App.tsx`。

如需添加新页面：

1. 在 `src/pages/` 创建新页面目录
2. 修改 `src/App.tsx` 添加路由或导航

## 样式规范

使用 LESS 语法，主要样式文件 `src/pages/dashboard/index.less`：

```less
.dashboard-container {
  display: flex;
  height: calc(100vh - 64px);
}

// 左侧任务栏
.task-sider {
  width: 220px;
  background: #fff;
  border-right: 1px solid #f0f0f0;
}

// 主内容区
.main-content {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

// 右侧面板
.right-panel {
  width: 300px;
  background: #fff;
  border-left: 1px solid #f0f0f0;
}
```

## 常用命令

```bash
# 开发
npm run dev          # 启动开发服务器

# 构建
npm run build        # 构建生产版本
npm run preview      # 预览生产构建

# 代码质量
npm run lint         # 检查代码规范（待配置）
```

## 常见问题

### 1. Mock 不生效

检查 `src/App.tsx` 是否调用了 `setupMockServer()`

### 2. 样式不生效

确认 `.less` 文件已正确 import

### 3. 类型报错

检查 `src/services/types.ts` 是否正确定义类型

## 参考文档

- Ant Design: https://ant.design/
- React: https://react.dev/
- Vite: https://vitejs.dev/
