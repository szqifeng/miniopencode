# MiniOpenCode 技能插件系统设计方案

> 本文档设计一个完整的技能（Skill）插件体系，支持插件化扩展工具、提示词和 Agent 能力。

## 🎯 设计目标

1. **多级树形结构**：4 级技能树，支持精细化能力拆分
2. **插件化工具系统**：将工具注册与执行解耦，支持动态加载
3. **技能封装**：将一组相关工具和提示词封装为独立技能
4. **生命周期管理**：支持插件的加载、激活、停用、卸载
5. **依赖注入**：支持插件间通信和依赖管理
6. **安全沙箱**：插件权限控制，限制危险操作

## 📐 4 级技能树结构

```
Level 1: 领域（Domain）
│
├── 📁 File（文件领域）
│   └── Level 2: 技能（Skill）
│       └── Level 3: 工具（Tool）
│           └── Level 4: 操作（Operation，操作变体）
│
├── 📁 Network（网络领域）
│   └── Level 2: 技能（Skill）
│       └── Level 3: 工具（Tool）
│
├── 📁 Code（代码领域）
│   └── Level 2: 技能（Skill）
│       └── Level 3: 工具（Tool）
│
├── 📁 System（系统领域）
│   └── Level 2: 技能（Skill）
│       └── Level 3: 工具（Tool）
│
└── 📁 Custom（自定义领域）
    └── Level 2: 技能（Skill）
        └── Level 3: 工具（Tool）
```

### 层级说明

| 层级 | 名称 | 说明 | 示例 |
|------|------|------|------|
| Level 1 | 领域（Domain） | 领域分类 | File, Network, Code, System |
| Level 2 | 技能（Skill） | 具体技能 | ReadSkill, WriteSkill, FetchSkill |
| Level 3 | 工具（Tool） | 原子工具 | ReadTool, GrepTool, HttpGetTool |
| Level 4 | 操作（Operation） | 操作变体（可选） | ReadFile, ReadDirectory |

## 📐 架构设计

### 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                         Agent Core                               │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │
│  │   Persona   │  │  Principle  │  │       Registry       │   │
│  │   (人设)    │  │   (原则)    │  │   (Skill/Tool/MCP)   │   │
│  └─────────────┘  └─────────────┘  └─────────────────────┘   │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │
│  │   Session   │  │   Memory    │  │      Scheduler      │   │
│  │   (会话)    │  │   (记忆)    │  │      (定时任务)      │   │
│  └─────────────┘  └─────────────┘  └─────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│                      LLM Decision Engine                         │
│              (推理引擎 - 决策选择使用哪个 Skill)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │               Level 1: Domain Registry                     │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │  │
│  │  │   File   │  │ Network  │  │   Code   │  │ System │ │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │               Level 2: Skill Tree                         │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │  │
│  │  │FileSkill    │  │WebSkill     │  │CodeSkill        │ │  │
│  │  │├─ReadSkill │  │├─FetchSkill │  │├─LintSkill      │ │  │
│  │  │├─WriteSkill│  │└─WSSkill    │  │├─FormatSkill    │ │  │
│  │  │└─EditSkill │  │             │  │└─TestSkill      │ │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │               Level 3: Tool Registry                      │  │
│  │  ┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌────────┐ │  │
│  │  │read│  │write│ │edit│  │grep│  │bash│  │ webfetch│ │  │
│  │  └────┘  └────┘  └────┘  └────┘  └────┘  └────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 🔧 核心接口设计

### 1. Level 1: Domain（领域）

```typescript
// src/plugins/skill/IDomain.ts

/**
 * Domain（领域）- Level 1
 * 最高层级，用于分类管理多个 Skill
 */
export interface IDomain {
  /** Domain 唯一标识符 */
  id: string;
  
  /** Domain 显示名称 */
  name: string;
  
  /** Domain 图标（emoji） */
  icon: string;
  
  /** Domain 描述 */
  description: string;
  
  /** 排序权重 */
  order: number;
  
  /** 该 Domain 下的所有 Skill */
  skills: Map<string, ISkill>;
  
  /** Domain 配置 */
  config?: Record<string, unknown>;
  
  /** 是否启用 */
  enabled: boolean;
}

// 预定义 Domain 类型
export type BuiltInDomain = 'file' | 'network' | 'code' | 'system' | 'custom';

export const DOMAIN_CONFIG: Record<BuiltInDomain, Omit<IDomain, 'skills'>> = {
  file: {
    id: 'file',
    name: '文件操作',
    icon: '📁',
    description: '文件系统读写、编辑、搜索等操作',
    order: 1,
    enabled: true
  },
  network: {
    id: 'network',
    name: '网络请求',
    icon: '🌐',
    description: 'HTTP 请求、WebSocket、网络抓取等',
    order: 2,
    enabled: true
  },
  code: {
    id: 'code',
    name: '代码处理',
    icon: '💻',
    description: '代码检查、格式化、测试、编译等',
    order: 3,
    enabled: true
  },
  system: {
    id: 'system',
    name: '系统操作',
    icon: '⚙️',
    description: 'Shell 命令、进程管理、系统信息等',
    order: 4,
    enabled: true
  },
  custom: {
    id: 'custom',
    name: '自定义',
    icon: '🔧',
    description: '用户自定义 Skill',
    order: 99,
    enabled: true
  }
};
```

### 2. Level 2: Skill（技能）

```typescript
// src/plugins/skill/ISkill.ts

/**
 * Skill（技能）- Level 2
 * 表示一个具体的技能，包含多个相关的 Tool
 */
export interface ISkill {
  /** Skill 唯一标识符（格式: domain/skillId） */
  id: string;
  
  /** Skill 显示名称 */
  name: string;
  
  /** Skill 版本号 */
  version: string;
  
  /** Skill 描述 */
  description: string;
  
  /** 所属 Domain ID */
  domainId: string;
  
  /** 父级 Skill ID（用于 Skill 树形结构） */
  parentId?: string;
  
  /** 子级 Skill IDs */
  childIds: string[];
  
  /** 排序权重 */
  order: number;
  
  /** 依赖的其他 Skill ID */
  dependencies?: string[];
  
  /** 权限要求 */
  permissions?: Permission[];
  
  /** 生命周期 - 插件加载时调用 */
  onLoad?(context: SkillContext): Promise<void>;
  
  /** 生命周期 - 插件激活时调用 */
  onActivate?(context: SkillContext): Promise<void>;
  
  /** 生命周期 - 插件停用时调用 */
  onDeactivate?(): Promise<void>;
  
  /** 生命周期 - 插件卸载时调用 */
  onUnload?(): Promise<void>;
  
  /** 获取该 Skill 提供的所有 Tool（Level 3） */
  getTools(): Map<string, ITool>;
  
  /** 获取该 Skill 的提示词模板 */
  getPromptTemplates?(): PromptTemplate[];
  
  /** 获取该 Skill 的配置 Schema */
  getConfigSchema?(): JSONSchema;
  
  /** 是否启用 */
  enabled: boolean;
}

/** Skill 树节点（用于构建 Skill 层级关系） */
export interface ISkillTreeNode {
  skill: ISkill;
  level: 1 | 2 | 3 | 4;
  children: ISkillTreeNode[];
  tools: ITool[];
}

export interface SkillContext {
  skillId: string;
  domainId: string;
  config: Record<string, unknown>;
  logger: ILogger;
  eventBus: IEventBus;
  toolRegistry: IToolRegistry;
  getSkill<T extends ISkill>(skillId: string): Promise<T | null>;
  getDomain(domainId: string): IDomain | null;
}

/** 权限类型 */
export type Permission = 
  | { type: 'file'; actions: ('read' | 'write' | 'delete')[]; pathPattern?: string }
  | { type: 'network'; actions: ('fetch' | 'websocket')[] }
  | { type: 'shell'; actions: ('exec' | 'spawn')[] }
  | { type: 'env'; vars: string[] };
```

### 3. Level 3: Tool（工具）

```typescript
// src/plugins/tool/ITool.ts

/**
 * Tool（工具）- Level 3
 * 表示一个原子操作，是执行的最小单位
 */
export interface ITool {
  /** Tool 唯一标识符（格式: domain/skill/toolId） */
  id: string;
  
  /** Tool 名称 */
  name: string;
  
  /** Tool 描述 */
  description: string;
  
  /** 所属 Skill ID */
  skillId: string;
  
  /** 所属 Domain ID */
  domainId: string;
  
  /** 父级 Tool ID（用于 Tool 树形结构） */
  parentId?: string;
  
  /** 子级 Tool IDs */
  childIds: string[];
  
  /** 输入参数 Schema */
  inputSchema: JSONSchema;
  
  /** 输出 Schema */
  outputSchema?: JSONSchema;
  
  /** 权限要求 */
  permissions?: Permission[];
  
  /** 执行工具 */
  execute(args: Record<string, unknown>, context: ToolExecuteContext): Promise<ToolResult>;
  
  /** 是否启用流式输出 */
  streaming?: boolean;
  
  /** 操作变体（Level 4） */
  operations?: Map<string, IOperation>;
  
  /** 是否启用 */
  enabled: boolean;
}

export interface ToolExecuteContext {
  sessionId?: string;
  userId?: string;
  skillId: string;
  domainId: string;
  toolId: string;
  logger: ILogger;
}

export interface ToolResult {
  output: string;
  title: string;
  metadata?: Record<string, unknown>;
  error?: string;
}
```

### 4. Level 4: Operation（操作变体）

```typescript
// src/plugins/tool/IOperation.ts

/**
 * Operation（操作变体）- Level 4
 * 同一个 Tool 的不同执行变体或配置
 */
export interface IOperation {
  /** Operation 唯一标识符 */
  id: string;
  
  /** Operation 名称 */
  name: string;
  
  /** Operation 描述 */
  description: string;
  
  /** 所属 Tool ID */
  toolId: string;
  
  /** 参数预设（覆盖 Tool 的默认参数） */
  presetArgs?: Record<string, unknown>;
  
  /** 额外的权限要求 */
  additionalPermissions?: Permission[];
  
  /** 执行函数 */
  execute(args: Record<string, unknown>, context: ToolExecuteContext): Promise<ToolResult>;
}
```

### 5. 多级注册表接口

```typescript
// src/plugins/core/ISkillTreeRegistry.ts

/**
 * Skill 树形注册表
 * 管理 4 级 Skill 树结构
 */
export interface ISkillTreeRegistry {
  // ========== Level 1: Domain 管理 ==========
  
  /** 注册 Domain */
  registerDomain(domain: IDomain): void;
  
  /** 注销 Domain */
  unregisterDomain(domainId: string): void;
  
  /** 获取 Domain */
  getDomain(domainId: string): IDomain | null;
  
  /** 获取所有 Domain */
  getAllDomains(): IDomain[];
  
  /** 按 ID 获取多个 Domain */
  getDomains(domainIds: string[]): IDomain[];
  
  // ========== Level 2: Skill 管理 ==========
  
  /** 注册 Skill（会自动注册到对应的 Domain） */
  registerSkill(skill: ISkill): void;
  
  /** 注销 Skill */
  unregisterSkill(skillId: string): void;
  
  /** 获取 Skill */
  getSkill(skillId: string): ISkill | null;
  
  /** 获取所有 Skill */
  getAllSkills(): ISkill[];
  
  /** 获取某 Domain 下的所有 Skill */
  getSkillsByDomain(domainId: string): ISkill[];
  
  /** 激活 Skill */
  activateSkill(skillId: string): Promise<void>;
  
  /** 停用 Skill */
  deactivateSkill(skillId: string): Promise<void>;
  
  // ========== Level 3: Tool 管理 ==========
  
  /** 注册 Tool */
  registerTool(tool: ITool): void;
  
  /** 注销 Tool */
  unregisterTool(toolId: string): void;
  
  /** 获取 Tool */
  getTool(toolId: string): ITool | null;
  
  /** 获取所有 Tool */
  getAllTools(): ITool[];
  
  /** 获取某 Skill 下的所有 Tool */
  getToolsBySkill(skillId: string): ITool[];
  
  /** 获取某 Domain 下的所有 Tool */
  getToolsByDomain(domainId: string): ITool[];
  
  // ========== Level 4: Operation 管理 ==========
  
  /** 注册 Operation */
  registerOperation(operation: IOperation): void;
  
  /** 获取 Operation */
  getOperation(operationId: string): IOperation | null;
  
  /** 获取某 Tool 下的所有 Operation */
  getOperationsByTool(toolId: string): IOperation[];
  
  // ========== 执行 ==========
  
  /** 执行 Tool */
  executeTool(toolId: string, args: Record<string, unknown>, context: ToolExecuteContext): Promise<ToolResult>;
  
  /** 执行 Operation */
  executeOperation(operationId: string, args: Record<string, unknown>, context: ToolExecuteContext): Promise<ToolResult>;
  
  // ========== 树形结构查询 ==========
  
  /** 获取完整的 Skill 树 */
  getSkillTree(): ISkillTreeNode[];
  
  /** 获取某 Domain 的完整子树 */
  getDomainTree(domainId: string): ISkillTreeNode | null;
  
  /** 获取 Skill 的祖先路径（从根到该节点） */
  getSkillPath(skillId: string): ISkillTreeNode[];
  
  /** 根据路径查找节点 */
  findNode(domainId: string, skillId?: string, toolId?: string): ISkillTreeNode | null;
}
```

## 🔄 生命周期管理

### 插件加载流程

```
1. PluginLoader 发现插件目录
   ↓
2. 读取 package.json 和 skill.json 配置
   ↓
3. 解析依赖关系，构建依赖图
   ↓
4. 按依赖顺序实例化插件主类
   ↓
5. 调用 onLoad() - 初始化资源
   ↓
6. 注册到 SkillTreeRegistry（归并到树）
   ↓
7. 发布 'skill:loaded' 事件
   ↓
8. 等待激活（自动或手动）
```

### 插件激活流程

```
1. 调用 registry.activateSkill(id)
   ↓
2. 检查依赖是否满足
   ↓
3. 调用 skill.onActivate()
   ↓
4. 注册该 Skill 的所有 Tools 到注册表
   ↓
5. 挂载到 SkillTree 的对应节点
   ↓
6. 发布 'skill:activated' 事件
```

### 插件卸载流程

```
1. 调用 registry.unregisterSkill(id)
   ↓
2. 如果已激活，先停用
   ↓
3. 调用 skill.onUnload()
   ↓
4. 从 SkillTree 中移除节点
   ↓
5. 清理资源（事件监听、文件句柄等）
   ↓
6. 从 Registry 移除
```

## 🌲 Skill 树归并机制

### 归并流程图

```
┌─────────────────────────────────────────────────────────────────┐
│                    Skill 插件目录结构                              │
│                                                                  │
│  skills/                                                         │
│  ├── domain.file/                    ← Domain 包（Level 1）      │
│  │   └── skill.read/               ← Skill 包（Level 2）        │
│  │       └── tools/                 ← Tool 实现                  │
│  │           └── ReadTool.ts                                     │
│  │                                                              │
│  └── domain.network/                                             │
│      └── skill.fetch/                                            │
│          └── tools/                                              │
│              └── HttpGetTool.ts                                   │
└─────────────────────────────────────────────────────────────────┘
                            ↓
            ┌───────────────────────────────────────┐
            │        PluginLoader 扫描目录            │
            │                                         │
            │  1. 发现 domain.file                     │
            │  2. 发现 skill.read                      │
            │  3. 发现 ReadTool                        │
            │  4. 发现 domain.network                  │
            │  5. 发现 skill.fetch                     │
            │  6. 发现 HttpGetTool                      │
            └───────────────────────────────────────┘
                            ↓
            ┌───────────────────────────────────────┐
            │           依赖解析与排序                  │
            │                                         │
            │  拓扑排序确保：                          │
            │  - Domain 在 Skill 之前加载              │
            │  - Skill 在 Tool 之前加载                │
            │  - 依赖项在被依赖项之前加载               │
            └───────────────────────────────────────┘
                            ↓
            ┌───────────────────────────────────────┐
            │        归并到 SkillTree                  │
            │                                         │
            │     SkillTree                           │
            │     ├── Domain: file ──────────────────┼── Skill: read ──── Tool: read │
            │     │                └── Tool: grep    │                              │
            │     │                └── Tool: edit    │                              │
            │     │                                   │                              │
            │     └── Domain: network ───────────────┼── Skill: fetch ─── Tool: httpGet │
            │                          └── Tool: ws  │                              │
            │                                         │                              │
            └───────────────────────────────────────┘
```

### Skill 树节点类型

```typescript
/**
 * Skill 树节点（通用）
 */
type SkillTreeNode = DomainNode | SkillNode | ToolNode | OperationNode;

/**
 * Level 1: Domain 节点
 */
interface DomainNode {
  level: 1;
  id: string;           // Domain ID
  domain: IDomain;
  skills: Map<string, SkillNode>;
  children: SkillNode[];
}

/**
 * Level 2: Skill 节点
 */
interface SkillNode {
  level: 2;
  id: string;
  skill: ISkill;
  domainId: string;
  tools: Map<string, ToolNode>;
  children: ToolNode[];
  operations: OperationNode[];
}

/**
 * Level 3: Tool 节点
 */
interface ToolNode {
  level: 3;
  id: string;
  tool: ITool;
  skillId: string;
  domainId: string;
  operations: Map<string, OperationNode>;
  children: OperationNode[];
}

/**
 * Level 4: Operation 节点
 */
interface OperationNode {
  level: 4;
  id: string;
  operation: IOperation;
  toolId: string;
}
```

## 📦 插件包格式

### package.json 示例

```json
{
  "name": "@miniopencode/domain-file",
  "version": "1.0.0",
  "description": "文件操作领域",
  "main": "dist/index.js",
  "type": "domain",
  "domain": {
    "id": "file",
    "name": "文件操作",
    "icon": "📁",
    "description": "文件系统读写、编辑、搜索等操作",
    "order": 1
  },
  "skills": [
    {
      "id": "file/read",
      "name": "读取技能",
      "version": "1.0.0",
      "description": "文件读取技能",
      "domainId": "file",
      "childIds": ["file/read/read", "file/read/grep"],
      "order": 1,
      "enabled": true
    }
  ],
  "tools": [
    {
      "id": "file/read/read",
      "name": "读取文件",
      "description": "读取单个文件内容",
      "skillId": "file/read",
      "domainId": "file",
      "inputSchema": { ... },
      "enabled": true
    }
  ],
  "dependencies": {
    "@miniopencode/plugin-core": "^1.0.0"
  }
}
```

## 🔌 PluginLoader 实现设计

```typescript
/**
 * PluginLoader
 * 负责扫描、加载、实例化插件并归并到 SkillTree
 */
class PluginLoader {
  private tree: SkillTree;
  private registry: SkillTreeRegistry;
  private merger: SkillTreeMerger;
  
  constructor() {
    this.tree = createSkillTree();
    this.registry = new SkillTreeRegistry();
    this.merger = new SkillTreeMerger();
  }
  
  /**
   * 从目录加载所有插件
   * @param skillsDir - skills 目录路径
   */
  async loadFromDirectory(skillsDir: string): Promise<void> {
    // 1. 扫描所有插件包
    const packages = await this.scanPackages(skillsDir);
    
    // 2. 解析依赖关系
    const sortedPackages = this.topologicalSort(packages);
    
    // 3. 按顺序加载每个包
    for (const pkg of sortedPackages) {
      await this.loadPackage(pkg);
    }
  }
  
  /**
   * 拓扑排序（按依赖顺序）
   */
  private topologicalSort(packages: SkillPluginPackage[]): SkillPluginPackage[] {
    const sorted: SkillPluginPackage[] = [];
    const visited = new Set<string>();
    const temp = new Set<string>();
    
    const visit = (pkg: SkillPluginPackage) => {
      if (temp.has(pkg.name)) {
        throw new Error(`Circular dependency detected: ${pkg.name}`);
      }
      if (visited.has(pkg.name)) return;
      
      temp.add(pkg.name);
      
      // 先访问依赖
      for (const dep of Object.keys(pkg.dependencies)) {
        const depPkg = packages.find(p => p.name === dep);
        if (depPkg) visit(depPkg);
      }
      
      temp.delete(pkg.name);
      visited.add(pkg.name);
      sorted.push(pkg);
    };
    
    for (const pkg of packages) {
      visit(pkg);
    }
    
    return sorted;
  }
}
```

## 🔧 内置 4 级 Skill 树

### Level 1: File Domain（文件领域）

```
📁 Domain: file
├── 📂 Skill: read
│   ├── Tool: read
│   ├── Tool: grep
│   └── Tool: list
├── 📂 Skill: write
│   ├── Tool: write
│   └── Tool: mkdir
└── 📂 Skill: edit
    └── Tool: edit
```

### Level 1: Network Domain（网络领域）

```
📁 Domain: network
├── 📂 Skill: fetch
│   ├── Tool: httpGet
│   ├── Tool: httpPost
│   └── Tool: webfetch
└── 📂 Skill: websocket
    └── Tool: ws
```

### Level 1: Code Domain（代码领域）

```
📁 Domain: code
├── 📂 Skill: lint
│   └── Tool: eslint
├── 📂 Skill: format
│   └── Tool: prettier
└── 📂 Skill: test
    └── Tool: jest
```

### Level 1: System Domain（系统领域）

```
📁 Domain: system
├── 📂 Skill: shell
│   ├── Tool: bash
│   └── Tool: process
└── 📂 Skill: git
    ├── Tool: git
    └── Tool: ssh
```

## 📝 实现计划

### Phase 1: 核心框架 (v1.0)
- [ ] 定义 4 级树接口（IDomain, ISkill, ITool, IOperation）
- [ ] 实现 SkillTreeRegistry
- [ ] 实现事件总线
- [ ] Level 1 Domain 架构
- [ ] Level 2 Skill 抽象

### Phase 2: 工具迁移 (v1.1)
- [ ] 将现有 6 个工具迁移到 4 级树结构
- [ ] 实现 Tool 注册和执行
- [ ] 实现权限检查中间件
- [ ] 迁移 File Domain

### Phase 3: Skill 封装 (v1.2)
- [ ] 完成 Network Domain
- [ ] 完成 Code Domain
- [ ] 完成 System Domain
- [ ] Skill 生命周期管理

### Phase 4: 插件系统 (v1.3)
- [ ] 插件加载器 (PluginLoader)
- [ ] 依赖解析和排序
- [ ] 插件市场 CLI
- [ ] 动态加载/卸载

### Phase 5: 高级功能 (v1.4)
- [ ] MCP 协议支持
- [ ] 远程 Skill
- [ ] Skill 热更新
- [ ] 插件市场

## 🔗 相关文档

- [项目架构文档](项目架构文档.md)
- [AI Agent 架构图进阶](./AIAgent架构图进阶.md)
