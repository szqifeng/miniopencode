# 贡献指南

感谢您对 MiniOpenCode 的关注！欢迎提交 Pull Request 或创建 Issue。

## 项目结构

```
miniopencode/
├── src/
│   ├── index.ts              # 服务启动入口
│   ├── app.ts                # Express 应用入口
│   ├── agent/
│   │   ├── index.ts         # Agent 核心控制层
│   │   ├── api.ts           # API 路由
│   │   ├── llm.ts           # LLM 对话封装
│   │   ├── process.ts       # React loop 执行
│   │   ├── session.ts       # 会话管理
│   │   └── types.ts         # 类型定义
│   ├── middleware/
│   │   └── auth.ts          # API 认证中间件
│   ├── models/
│   │   └── textRecord.ts    # 数据记录模型
│   └── services/
│       ├── storageFactory.ts # 存储抽象工厂
│       └── toolService.ts    # 工具服务
├── tests/                    # 测试文件
├── docs/                     # 文档
├── postman_collection.json   # Postman 测试集合
├── tsconfig.json            # TypeScript 配置
└── package.json
```

## 开发环境

- **Node.js**: 22+
- **包管理器**: npm

```bash
# 克隆仓库
git clone https://github.com/szqifeng/miniopencode.git
cd miniopencode

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 类型检查
npm run typecheck
```

## 如何贡献

### 提交 Bug

提交 Issue 时请包含：
- 清晰的标题和描述
- 复现步骤
- 期望行为 vs 实际行为
- Node.js 版本和操作系统信息

### 提交代码

1. Fork 本仓库
2. 创建分支：`git checkout -b feature/your-feature-name`
3. 编写代码并测试
4. 提交：`git commit -m 'Add some feature'`
5. 推送：`git push origin feature/your-feature-name`
6. 创建 Pull Request

### 代码规范

- 使用 TypeScript
- 使用 async/await 而非回调
- 添加适当的错误处理
- 为新功能编写测试
- 更新相关文档

### 分支策略

- `main`: 稳定发布版本
- `feature/*`: 新功能
- `fix/*`: Bug 修复
- `docs/*`: 文档更新

## API 开发指南

### 添加新接口

1. 在 `src/agent/api.ts` 中添加路由
2. 实现业务逻辑
3. 统一错误处理格式

### 添加新工具

在 `src/services/toolService.ts` 的 `TOOLS` 中添加：

```typescript
const newTool = {
  id: 'tool_name',
  description: '工具描述',
  inputSchema: jsonSchema({ ... }),
  async execute(args) {
    // 工具执行逻辑
    return { output: '结果', title: '标题', metadata: {} };
  }
};
```

## 测试

```bash
# 启动服务测试
npm run dev

# 类型检查
npm run typecheck
```

## 许可证

提交代码即表示您同意您的代码将按照项目许可证（MIT）开源。
