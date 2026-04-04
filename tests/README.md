# 测试文档

## 运行测试

```bash
# 运行所有测试（交互模式）
npm test

# 运行所有测试（非交互模式）
npm run test:run

# 运行特定测试文件
npx vitest run tests/api.test.ts
```

## 测试文件结构

```
tests/
├── api.test.ts          # API 接口测试
└── session.test.ts      # Session 模块测试
```

## 已有测试用例

### API 测试 (api.test.ts)

- ✅ 健康检查接口
- ✅ 获取会话列表
- ✅ 认证中间件
- ✅ 流式对话接口
- ✅ 会话创建

### Session 测试 (session.test.ts)

- ✅ 创建消息组件
- ✅ 消息转换为 LLM 格式
- ✅ 工具调用处理

## 添加新测试

1. 在 `tests/` 目录下创建新的测试文件
2. 使用 `describe` 和 `it` 组织测试
3. 运行 `npm run test:run` 验证

示例：

```typescript
import { describe, it, expect } from 'vitest';

describe('My Feature', () => {
  it('should do something', () => {
    const result = myFunction();
    expect(result).toBe('expected');
  });
});
```

## 测试要求

新增功能时必须添加对应测试用例，确保：
- 核心逻辑有单元测试
- API 接口有集成测试
- 测试覆盖率 > 80%
