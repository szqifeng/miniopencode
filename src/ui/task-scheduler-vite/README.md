# 任务调度平台

基于 Vite + React + Ant Design 的任务调度管理平台。

## 功能特性

- **工具管理** - 管理系统中的各类工具（脚本、API、Shell）
- **任务管理** - 任务的创建、编辑、删除、启动/禁用、立即运行
- **AI 助手** - 智能对话辅助功能
- **实时任务状态** - 查看任务执行状态和历史

## 技术栈

- **框架**: Vite + React 18
- **UI 组件**: Ant Design 5.x
- **语言**: TypeScript
- **样式**: LESS

## 快速开始

```bash
# 克隆项目后进入目录
cd task-scheduler-vite

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

访问 http://localhost:5173

## 项目结构

```
src/
├── main.tsx                 # React 入口
├── App.tsx                  # 根组件
├── mock/                    # Mock 数据
│   └── index.ts             # Mock 服务（劫持 fetch）
├── pages/
│   └── dashboard/           # 首页
│       ├── index.tsx       # 首页入口
│       ├── index.less       # 样式
│       └── components/      # 首页组件
│           ├── ToolsPanel.tsx   # 工具维护
│           ├── TasksPanel.tsx    # 任务管理
│           └── ChatPanel.tsx     # AI 聊天
└── services/
    ├── api.ts              # API 请求
    └── types.ts            # 类型定义
```

## 首页布局

```
┌─────────────────────────────────────────────────────────┐
│                    任务调度平台                           │
├───────────────────────────────┬─────────────────────────┤
│  工具维护                     │                         │
│  [卡片网格布局]                │     AI 助手              │
├───────────────────────────────┤     [聊天窗口]           │
│  任务列表                     │                         │
│  [卡片列表布局]                │     [设置按钮]           │
└───────────────────────────────┴─────────────────────────┘
```

## API 接口

| 模块 | 路径 | 说明 |
|------|------|------|
| 工具管理 | /api/tools | CRUD 操作 |
| 任务管理 | /api/tasks | CRUD + 启停控制 |
| AI 聊天 | /api/chat | 对话和设置 |

详细 API 文档见 `docs/postman/TaskScheduler_API.postman_collection.json`

## 开发指南

### 添加新页面

1. 在 `src/pages/` 下创建页面目录
2. 创建 `index.tsx` 和 `index.less`
3. 在 `App.tsx` 中引入

### 添加新 API

在 `src/mock/index.ts` 的 `mockHandlers` 中添加：

```typescript
'GET /api/your-endpoint': (params) => {
  return { success: true, data: [...] };
},
```

### 添加新组件

1. 在 `src/pages/your-page/components/` 下创建
2. 使用 antd 基础组件
3. 样式使用 LESS

## Mock 数据说明

项目使用 Mock 数据开发，通过劫持 `window.fetch` 实现：

- 所有 API 请求使用 `(window as any).mockFetch()`
- 无需后端即可运行
- 切换到真实 API 只需修改 `src/services/api.ts`

## 后续开发

基于 `AGENTS.md` 文档继续开发：

1. 确认其他 4 个页面的功能需求
2. 实现后端 API 接口
3. 添加用户认证与权限管理
4. 考虑客户端封装（Tauri / Electron）

## 参考文档

- [Ant Design](https://ant.design/)
- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)

## License

MIT
