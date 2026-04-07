# AGENTS.md - UI 模块开发约束

## 项目信息

- 项目名称：`task-scheduler-vite`
- 技术栈：Vite + React + TypeScript + Ant Design 5
- 渲染模式：CSR
- 包管理：`npm`
- 当前主页面：任务中心工作台

---

## 当前产品边界

这个 UI 不是通用后台，也不是开放式聊天产品。

当前主线只有一条：

- 任务是唯一入口
- 聊天只用于创建和编辑任务
- 报告和运行记录附着在任务下
- 首版只支持表格分析任务
- 输入只支持 `CSV / XLSX`
- 输出固定为 `Markdown`

明确不做：

- 顶级聊天页
- 顶级报告页
- 插件市场
- 通用工作流编排器
- 邮件分析 / 自动回复
- 多页面后台管理台

---

## 目录结构

```text
src/
├── main.tsx
├── App.tsx
├── App.css
├── index.css
├── mock/
│   └── index.ts
├── pages/
│   ├── dashboard/
│   │   ├── index.tsx
│   │   └── index.css
│   ├── knowledge/
│   │   └── index.tsx
│   └── tools/
│       └── index.tsx
└── services/
    ├── api.ts
    └── types.ts
```

说明：

- 当前真正使用的主页面是 `src/pages/dashboard/index.tsx`
- `knowledge` 和 `tools` 页面仍在仓库中，但不是当前产品主线
- `dashboard` 样式文件已改为 `index.css`，不再使用 `less`

---

## 当前页面结构

### 主工作台

主页面由两部分组成：

- 左侧：任务入口区
- 右侧：当前任务详情区

左侧内容：

- 产品定位说明
- 新建任务按钮
- 指标卡片
- 搜索与状态筛选
- 任务列表

右侧内容：

- 当前任务概览
- 状态与调度摘要
- 最新报告
- 报告历史
- 最近运行
- 规则说明
- 快捷操作

### 创建 / 编辑任务

通过统一弹层处理：

- 左侧：聊天输入区
- 右侧：结构化任务草稿与表单

聊天不是自由问答，只负责把自然语言转成任务配置。

---

## 数据模型

所有核心类型集中在 `src/services/types.ts`。

### Task

```ts
type Task = {
  id: string
  name: string
  inputFilePath: string
  schedule: "once" | "daily" | "weekly"
  scheduleTime?: string
  status: "active" | "paused" | "error"
  analysisGoal?: string
  outputFormat: "markdown"
  lastRunAt?: string
  nextRunAt?: string
  createdAt: string
  updatedAt: string
}
```

### Run

```ts
type Run = {
  id: string
  taskId: string
  status: "running" | "success" | "failed"
  startedAt: string
  finishedAt?: string
  errorMessage?: string
  reportId?: string
}
```

### Report

```ts
type Report = {
  id: string
  taskId: string
  runId: string
  contentMarkdown: string
  createdAt: string
}
```

### 其他类型

- `Tool`
- `KnowledgeItem`
- `ChatMessage`
- `ChatSettings`
- `Response<T>`

这些类型也在 `src/services/types.ts` 中维护。

---

## Mock 与运行逻辑

当前 UI 主要依赖 `src/mock/index.ts`。

### Mock 约束

- 页面通过 `window.mockFetch` 请求 mock API
- 手动运行任务时要同时生成 `Run` 和 `Report`
- 报告必须通过 `taskId` 与 `runId` 挂到任务结果下
- 任务状态变化要同步更新时间和调度时间

### 当前任务运行闭环

点击“立即运行”后：

1. 创建运行记录
2. 创建 Markdown 报告
3. 更新任务最近运行时间
4. 根据调度方式更新下次执行时间

---

## 开发规范

### 样式

- 主页面使用 CSS 文件，不再使用 `less`
- 新增样式优先保持当前浅色渐变 + 轻玻璃质感方向
- 不要回退成 Ant Design Pro 式后台视觉

### 组件与代码

- 保持强类型
- 优先写清晰直接的 React 代码
- 避免过度抽象
- 仅在确实提升可读性时添加注释

### 交互约束

- 不新增顶级聊天页
- 不把报告抽成独立一级页面
- 不把工具 / 知识库做成当前首页核心入口
- 任务详情必须围绕单个选中任务展开

---

## 常用命令

```bash
cd src/ui/task-scheduler-vite
npm run dev
npm run build
```

---

## 参考文档

当前 UI 文档只看：

- `src/ui/docs/requirements.md`
- `src/ui/docs/desktop_agent_prd.md`

如果代码实现与旧文档冲突，以当前代码和上述两份文档为准。
