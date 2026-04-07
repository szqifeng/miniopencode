# 桌面 Agent 当前 PRD

## 1. 核心定义

这是一个面向表格分析任务的桌面 Agent 工作台。

主张只有一条：

- 用户先看到任务列表
- 选择任务后查看详情、运行记录和报告
- 创建与编辑任务时才进入聊天式编辑器

聊天不是产品首页，也不是独立能力中心。

---

## 2. 主界面信息架构

### 2.1 左侧

- 任务入口说明
- 新建任务
- 搜索与状态筛选
- 任务列表

### 2.2 右侧

- 当前任务概览
- 执行状态与调度摘要
- 最新报告
- 报告历史
- 最近运行
- 规则说明
- 快捷操作

---

## 3. 创建 / 编辑任务体验

任务创建与编辑共用一个弹层：

- 左侧聊天
- 右侧结构化配置

### 3.1 聊天输入示例

- 每周一早上 9 点分析 `sales-weekly.xlsx`，输出销售摘要
- 每天下午 6 点分析 `inventory-daily.csv`，输出库存变化报告
- 现在分析 `finance-snapshot.xlsx`，输出费用异常说明

### 3.2 当前解析目标

聊天输入必须尽量解析出：

- 任务名
- 文件路径
- 执行方式
- 时间说明
- 分析目标
- 输出格式

### 3.3 当前约束

- 不臆造不存在的文件路径
- 文件后缀必须是 `csv` 或 `xlsx`
- 输出固定为 `markdown`
- 信息不足时给出缺失字段提示

---

## 4. 当前任务对象

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

---

## 5. 当前运行与报告逻辑

### 5.1 手动运行

手动运行任务后：

- 新建一条运行记录
- 新建一条 Markdown 报告
- 报告通过 `runId` 挂到本次运行上
- 任务刷新最近运行时间与下次执行时间

### 5.2 运行对象

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

### 5.3 报告对象

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

## 6. 当前成功标准

从 UI 角度，当前页面完成标准是：

1. 用户能从任务列表理解产品主线
2. 用户能从自然语言进入受控的任务创建 / 编辑流程
3. 用户能看到运行记录与报告都附着在任务下
4. 页面整体不呈现“臃肿后台”感

---

## 7. 与当前实现一致的文件

- `src/pages/dashboard/index.tsx`
- `src/pages/dashboard/index.css`
- `src/services/types.ts`
- `src/mock/index.ts`

---

## 8. 已明确移除的旧方向

以下内容不再作为当前 UI 文档主线：

- 多份拆散的规范包文档
- 旧的 Postman 调度平台描述
- 通用任务调度后台表述
- 工具 / 知识库 / 聊天并列的首页概念
