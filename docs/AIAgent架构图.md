graph TD

User[用户] --> Gateway[Gateway\n请求入口 / 路由 / 限流]

Gateway --> Agent[Agent 核心控制层]

subgraph AgentCore[Agent Core（控制平面）]
AgentManager[AgentManager\nAgent管理 / 配置 / 原则 / 人设]
Session[Session\n会话上下文管理]
Memory[Memory\n长期记忆 / 短期记忆 / 检索]
LLM[LLM\n决策引擎]
end

Agent --> AgentManager
Agent --> Session
Agent --> Memory
Agent --> LLM

%% LLM 内部能力
LLM --> Reasoning[Reasoning\n推理]
LLM --> Analysis[Analysis\n分析]
LLM --> Planning[Planning\n规划]

%% Agent 调用能力层
Agent --> Skill[Skill\n能力编排层]

subgraph SkillLayer[Skill Layer（能力层）]
BasicSkill[基础技能\n文件读写 / 文件夹查询 / 文本处理]
ToolSkill[Tool Skills\n工具能力封装]
MCPSkill[MCP Skills\n基于 MCP 的能力封装]
end

Skill --> BasicSkill
Skill --> ToolSkill
Skill --> MCPSkill

subgraph ToolLayer[Tool Layer（执行层）]
BasicTool[基础工具\n文件系统 / Shell / 网络请求]
MCPTool[MCP Tools\n协议化工具]
Adapter[Adapter\n外部工具适配器]
end

%% 技能到工具的映射
BasicSkill --> BasicTool
ToolSkill --> Adapter
MCPSkill --> MCPTool

%% 系统模块（侧边支撑）
Scheduler[Scheduler\n定时任务调度] --> Agent
Heartbeat[Heartbeat\n心跳 / 健康检查] --> Agent

%% 模型层
ModelProvider[Model Provider\n模型提供商] --> LLM