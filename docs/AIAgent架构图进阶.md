graph TD

%% ================= 主链路 =================
User[User] --> Gateway[Gateway\n请求入口/路由/限流]
Gateway --> Agent[Agent 核心控制层]

Agent --> LLM[LLM 决策引擎]
LLM --> Skill[Skill 能力层]
Skill --> Tool[Tool 执行层]

%% ================= Agent 内部 =================
subgraph AgentCore [Agent Core]
Persona[Persona 人设]
Principle[Principle 原则]
Registry[Registry\nSkill/Tool/MCP 管理]
Session[Session 会话]
Memory[Memory 记忆]

    Agent --> Persona
    Agent --> Principle
    Agent --> Registry
    Agent --> Session
    Agent --> Memory
end

%% 状态闭环
Agent <--> Session
Agent <--> Memory

%% ================= LLM =================
subgraph LLMBlock [LLM Module]
Reasoning[Reasoning 推理]
Analysis[Analysis 分析]
Planning[Planning 规划]

    LLM --> Reasoning
    LLM --> Analysis
    LLM --> Planning
end

%% ================= Skill 层 =================
subgraph SkillLayer [Skill Layer]
BasicSkill[基础技能\n文件读写/文本处理]
ToolSkill[Tool Skills]
MCPSkill[MCP Skills]
CompositeSkill[Composite Skills]

    Skill --> BasicSkill
    Skill --> ToolSkill
    Skill --> MCPSkill
    Skill --> CompositeSkill
end

%% ================= Tool 层 =================
subgraph ToolLayer [Tool Layer]
BasicTool[基础工具\nFS/Shell/API]
MCPTool[MCP Tools]
Adapter[外部工具适配器]

    Tool --> BasicTool
    Tool --> MCPTool
    Tool --> Adapter
end

%% ================= MCP 关系 =================
MCPSkill --> MCPTool

%% ================= 决策关系 =================
LLM -. 决策:选择Skill .-> Skill

%% ================= 系统模块 =================
Scheduler[Scheduler 定时任务] --> Agent
Heartbeat[Heartbeat 心跳] --> Agent

%% ================= 模型层 =================
ModelProvider[Model Provider] --> LLM