# UI 当前实现说明

## 1. 产品定位

`task-scheduler-vite` 当前不是通用后台，也不是开放式聊天助手。

当前 UI 的唯一主线是：

- 任务是唯一入口
- 聊天只用于创建和编辑任务
- 报告和运行记录都附着在任务下
- 首版只处理表格分析任务
- 输入只支持 `CSV / XLSX`
- 输出统一为 `Markdown`

---

## 2. 当前页面结构

当前应用入口只有一个主工作台页面，由 `src/pages/dashboard/index.tsx` 渲染。

### 2.1 左侧任务栏

左侧栏承担入口职责，包含：

- 产品定位说明
- 新建任务按钮
- 任务总数 / 运行中 / 报告累计指标
- 搜索与状态筛选
- 任务列表

任务列表项展示：

- 任务名称
- 当前状态
- 分析目标摘要
- 调度方式与时间说明
- 输入文件名
- 最后更新时间

### 2.2 右侧任务详情区

右侧展示当前选中任务的完整工作区，包含：

- 任务 Hero 区
- 四个摘要卡片
- 失败告警区
- 任务简报
- 最新报告 Markdown 预览
- 报告历史
- 最近运行记录
- 执行规则说明
- 快捷操作

这里不再使用“后台 Tabs 切页”的组织方式，而是按任务上下文直接展开。

---

## 3. 创建 / 编辑任务流程

任务创建与编辑都通过同一个弹层完成。

### 3.1 弹层布局

- 左侧：聊天输入区
- 右侧：结构化任务草稿 + 表单

### 3.2 聊天区职责

聊天区不是开放式问答，只做任务草稿解析。

用户可以直接输入：

- 文件路径
- 执行频率
- 时间信息
- 希望输出的分析结果

当前实现通过 `/api/tasks/draft/resolve` 解析并更新：

- 文件路径，例如 `sales-weekly.xlsx`
- 调度方式，`manual / hourly / daily / weekly`
- 调度配置，例如 `minute`、`time`、`weekday`
- 时间说明，例如 `每小时 15 分`、`18:00`、`周一 09:00`
- 分析目标
- 建议任务名

如果信息不完整，聊天区会提示还缺哪些字段。

### 3.3 右侧结构化草稿

右侧始终显示当前任务草稿，包含：

- 任务名称
- 当前输入文件
- 执行方式
- 时间说明
- 分析目标
- 输出格式
- 当前状态

输出格式固定为 `markdown`，不可编辑。

当前 UI 只支持手动执行。

### 3.4 文件上传

任务弹层内支持直接上传输入文件：

- 仅允许 `CSV / XLSX`
- 上传按钮位于聊天发送按钮旁边
- 上传接口为 `/api/tasks/:id/files`
- 前端会在打开弹层时先生成任务 ID，用于提前建立工作目录
- 上传成功后自动回填 `inputFilePath`
- 已上传文件列表会保留在草稿里，并在提交任务时写入 `uploadedFiles`
- 页面不展示原始文件路径输入控件，主流程以上传为准

### 3.5 保存时的分析目标抽象

保存任务前，前端会再次调用 `/api/tasks/draft/resolve`：

- 使用当前聊天记录
- 使用当前任务草稿
- 保留用户手工修改过的任务名称
- 将最终落库的 `analysisGoal` 收敛为具体、可执行的分析目标文本

---

## 4. 当前数据模型

### 4.1 Task

```ts
type Task = {
  id: string
  name: string
  inputFilePath: string
  workspaceDir: string
  uploadedFiles: TaskFile[]
  schedule: "manual" | "hourly" | "daily" | "weekly"
  scheduleConfig?: {
    minute?: number
    time?: string
    weekday?: number
  }
  scheduleTime?: string
  status: "active" | "completed" | "paused" | "error"
  analysisGoal?: string
  outputFormat: "markdown"
  lastRunAt?: string
  nextRunAt?: string
  createdAt: string
  updatedAt: string
}
```

### 4.2 Run

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

### 4.3 Report

```ts
type Report = {
  id: string
  taskId: string
  runId: string
  contentMarkdown: string
  createdAt: string
}
```

---

## 5. 当前运行逻辑

当前主工作台已经按真实后端接口联调，不再依赖 mock 作为主路径。

### 5.1 手动运行任务

点击“立即运行”后会触发：

1. 生成一条新的 `Run`
2. 生成一条新的 `Report`
3. 更新任务的 `lastRunAt`
4. 根据调度方式与 `scheduleConfig` 刷新 `nextRunAt`

### 5.2 任务状态

- `active`：正常参与调度，可手动运行
- `paused`：暂停状态
- `error`：最近一次运行或配置出现异常，需要人工处理

### 5.3 错误展示

如果任务状态为 `error`，详情页会显示最近失败原因，用于提示用户修正输入文件或配置。

---

## 6. 视觉与交互方向

当前页面设计原则：

- 不做 Ant Design Pro 式重后台布局
- 保持任务主线集中
- 页面只围绕一个选中任务展开
- 聊天与表单并列，确保可控
- 使用轻玻璃质感、浅色暖冷渐变背景
- 兼容桌面与移动端缩放

---

## 7. 当前代码对应关系

### 7.1 入口与主题

- `src/App.tsx`
- `src/index.css`
- `src/App.css`

### 7.2 主页面

- `src/pages/dashboard/index.tsx`
- `src/pages/dashboard/index.css`

### 7.3 数据与 Mock

- `src/services/types.ts`
- `src/mock/index.ts`

### 7.4 新建任务关键接口

- `src/services/api.ts`
- `src/app/api.ts`
- `src/app/taskDraft.ts`
- `src/app/taskWorkspace.ts`

---

## 8. 明确不做

当前 UI 文档明确排除以下方向：

- 顶级聊天页
- 顶级报告页
- 插件市场
- 通用工作流编排器
- 邮件分析或自动回复
- 系统监控类产品形态
- 多页面后台管理台式信息架构
