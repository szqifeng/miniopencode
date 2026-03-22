# 贡献指南

感谢您对 MiniOpenCode 的关注！欢迎提交 Pull Request 或创建 Issue。

## 项目结构

```
miniopencode/
├── src/
│   ├── app.js              # Express 应用入口
│   ├── index.js            # 服务启动入口
│   ├── middleware/
│   │   └── auth.js         # API 认证中间件
│   ├── models/
│   │   └── textRecord.js    # 数据记录模型
│   ├── routes/
│   │   ├── api.js           # 主要 API 路由
│   │   └── sdk.js           # SDK 兼容路由
│   └── services/
│       ├── aiService.js     # AI 服务封装
│       ├── storageFactory.js # 存储抽象工厂
│       └── toolService.js   # 工具服务（天气、计算等）
├── tests/                   # 测试文件
├── examples/                # 使用示例
├── docs/                    # 文档
├── package.json
└── README.md
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

- 使用 ES Module (ESM) 语法
- 使用 async/await 而非回调
- 添加适当的错误处理
- 为新功能编写测试
- 更新相关文档

### 分支策略

- `main`: 稳定发布版本
- `develop`: 开发分支
- `feature/*`: 新功能
- `fix/*`: Bug 修复
- `docs/*`: 文档更新

## API 开发指南

### 添加新接口

1. 在 `src/routes/api.js` 中添加路由
2. 实现业务逻辑
3. 统一错误处理格式：

```javascript
try {
  // your code
} catch (error) {
  console.error('Your error:', error);
  res.status(500).json({
    error: 'Internal Server Error',
    message: error.message || 'Failed to...'
  });
}
```

### 添加新工具

在 `src/services/toolService.js` 的 `TOOLS` 数组中添加：

```javascript
{
  id: 'tool_name',
  description: '工具描述',
  inputSchema: jsonSchema({
    type: 'object',
    properties: {
      paramName: {
        type: 'string',
        description: '参数描述'
      }
    },
    required: ['paramName']
  }),
  async execute(args, options) {
    // 工具执行逻辑
    return { output: '结果', title: '标题', metadata: {} };
  }
}
```

### 添加新存储后端

1. 在 `src/services/storageFactory.js` 中添加新存储类
2. 实现标准接口：`save()`, `get()`, `list()`, `delete()`
3. 在 `STORAGE_TYPE` 环境变量支持中添加新类型

## 测试

```bash
# 运行测试
npm test

# 运行带监视的测试
npm run test:watch
```

## 许可证

提交代码即表示您同意您的代码将按照项目许可证（MIT）开源。
