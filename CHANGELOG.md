# Changelog

## [Unreleased]

## [1.0.0] - 2026-04-02

### 新增
- 基础工具模块 (read, write, edit, bash)
  - `read` - 读取文件内容
  - `write` - 写入内容到文件
  - `edit` - 编辑文件（通过字符串替换）
  - `bash` - 执行 bash 命令

### 重构
- 移除 process.ts 中手动执行工具的逻辑，改由 AI SDK 自动调用
- 移除 `useTools` 选项，工具始终由 AI SDK 自动处理
- 优化 Agent 类型定义，使用 `ToolSet` 类型

### 修复
- 修复 toolCallStreaming 模式下工具参数未正确解析的问题
