# MiniOpenCode 待办计划

> 不是帮你记住世界，而是帮你记住你自己。

## 概述

MiniOpenCode 是一个 AI Agent 服务，当前已实现基础功能，计划逐步完善以下体系。

---

## 1. Skill 体系

### 目标
实现技能/插件系统，允许扩展 AI 的能力。

### 功能点
- [ ] Skill 定义规范（JSON/YAML）
- [ ] Skill 加载器
- [ ] 内置 Skill 示例（代码审查、文档生成等）
- [ ] Skill 市场/仓库
- [ ] Skill 版本管理

### 参考
- [x] 已有 `skills/` 目录结构
- [ ] 可参考 LangChain Tools、CrewAI Skills

---

## 2. MCP (Model Context Protocol) 体系

### 目标
标准化 AI 与外部工具/服务之间的通信协议。

### 功能点
- [ ] MCP 协议定义
- [ ] MCP Server 实现
- [ ] MCP Client 实现
- [ ] 内置 MCP Server（文件系统、Git、数据库等）
- [ ] MCP 服务发现机制

### 参考
- Anthropic MCP、OpenAI Plugins

---

## 3. LSP (Language Server Protocol) 体系

### 目标
实现代码智能补全、跳转、诊断等 IDE 级别的功能。

### 功能点
- [ ] LSP Server 实现
- [ ] 代码解析器（多语言支持）
- [ ] 符号索引
- [ ] 代码补全建议
- [ ] 错误诊断
- [ ] 代码重构建议

### 参考
- VSCode LSP、TypeScript Language Server

---

## 4. Todo 体系

### 目标
支持任务拆解、进度跟踪、多步骤任务执行。

### 功能点
- [ ] Todo 数据模型
- [ ] Todo CRUD API
- [ ] 任务依赖管理
- [ ] 任务状态机（pending → in_progress → done）
- [ ] 任务优先级
- [ ] 子任务拆解

### 参考
- Linear、Todoist、Notion Tasks

---

## 5. 多 Agent 体系

### 目标
支持多个 AI Agent 协作处理复杂任务。

### 功能点
- [ ] Agent 通信协议
- [ ] Agent 角色定义（规划者、执行者、审查者等）
- [ ] 任务分发机制
- [ ] Agent 协作工作流
- [ ] Agent 资源共享
- [ ] 冲突解决机制

### 参考
- AutoGen、CrewAI、LangChain Agents

---

## 6. TUI 页面

### 目标
提供终端界面版本，方便无图形界面的服务器环境使用。

### 功能点
- [ ] 基于 `blessed` 或 `ink` 的终端 UI 框架
- [ ] 终端对话交互
- [ ] 工具调用反馈
- [ ] 会话列表管理
- [ ] 快捷键支持

### 参考
- ChatGPT CLI、Claude CLI、blessed-contrib

---

## 7. APP 页面

### 目标
提供移动端/桌面应用界面，随时随地使用。

### 功能点
- [ ] 移动端 Web App (PWA)
- [ ] 响应式布局
- [ ] 离线消息缓存
- [ ] 推送通知
- [ ] 深色/浅色主题

### 参考
- ChatGPT Web、Claude Web

---

## 8. 工作空间 (Workspace) 概念

### 目标
支持多项目/多团队隔离，每个工作空间独立配置。

### 功能点
- [ ] Workspace 数据模型
- [ ] Workspace CRUD API
- [ ] Workspace 隔离（工具、提示词、会话）
- [ ] Workspace 成员管理
- [ ] Workspace 切换器
- [ ] 跨 Workspace 共享能力

### 参考
- GitHub Organizations、Notion Workspaces、Linear Teams

---

## 9. DIY 远端工作中心

### 目标
用户基于自然语言发布个人博客网站，实现个性化自我展示，Web3 社交为核心。

### 核心特性
用户通过自然语言描述即可生成并发布个人站点，无需编码。

### 功能点
- [ ] 自然语言生成站点内容
- [ ] 模板引擎（可自定义主题）
- [ ] 个人博客发布
- [ ] Web3 社交主页（展示身份、作品、社交图谱）
- [ ] 去中心化存储（IPFS/Arweave）
- [ ] 域名绑定（ENS/自定义域名）
- [ ] 访客互动（留言、点赞、打赏）
- [ ] 数据可移植性

### Web3 社交展示
- 链上身份绑定
- NFT 作品展示
- 社交图谱可视化
- 永久内容存储

### 技术方案
- 静态站点生成
- 去中心化存储
- 智能合约交互
- DID 身份验证

### 参考
- Lens Protocol、CyberConnect、ENS、个人博客 + Notion + Web3

---

## 优先级建议

| 优先级 | 体系 | 理由 |
|--------|------|------|
| 1 | Todo 体系 | 项目管理基础，其他系统都可能依赖 |
| 2 | Skill 体系 | 快速扩展能力，门槛较低 |
| 3 | 多 Agent 体系 | 复杂任务处理需要 |
| 4 | MCP 体系 | 标准化协议，长期价值高 |
| 5 | LSP 体系 | 技术难度高，可后期集成现有方案 |

---

## 当前进度

- [x] 基础 Agent 框架
- [x] 流式对话
- [x] 工具调用（read/write/edit/grep/bash）
- [x] 会话管理
- [x] Electron UI
- [x] 提示词模板系统
- [ ] Skill 体系
- [ ] Todo 体系
- [ ] 多 Agent 体系
- [ ] MCP 体系
- [ ] LSP 体系
- [ ] TUI 页面
- [ ] APP 页面
- [ ] 工作空间 (Workspace)
- [ ] DIY 远端工作中心

---

*最后更新: 2026-04-02*
