# 一念 - OneMindBack 扩展计划

> 不是帮你记住世界，而是帮你记住你自己。

## 阶段一：MVP（已完成 ✅）
- [x] `/api/summarize` - 文本总结（Direct + AI SDK，流式/非流式）
- [x] `/api/classify` - 文本分类（Direct + AI SDK，流式/非流式）
- [x] 存储层抽象（支持 File/MySQL 切换）
- [x] 固定 API Key 认证

---

## 阶段二：核心功能（待开发）

### 2.1 念想记录 (inbox)
- [ ] `POST /api/inbox` - 记录新念想
- [ ] `GET /api/inbox` - 获取 inbox 列表
- [ ] `GET /api/inbox/:date` - 按日期获取
- [ ] 文件格式：`inbox/YYYY-MM-DD/HHMM.md`

### 2.2 每日汇总 (capture)
- [ ] `POST /api/capture` - 手动触发汇总
- [ ] `GET /api/capture` - 获取汇总列表
- [ ] `GET /api/capture/:date` - 按日期获取
- [ ] 文件格式：`capture/YYYY-MM-DD.md`

### 2.3 AI 深度加工
- [ ] `POST /api/process` - 深度加工念想
- [ ] `GET /api/processed` - 获取加工结果
- [ ] 处理类型：
  - 打标签 (tags)
  - 分类 (categories)
  - 合并相似 (merge)
  - 提取概念 (Concepts)
  - 生成洞察 (Insights)
  - 发现模式 (Patterns)
  - 问答对 (Q&A)

---

## 阶段三：高级功能

### 3.1 遗忘曲线复习
- [ ] 基于艾宾浩斯遗忘曲线计算复习时间点
- [ ] `GET /api/reviews` - 获取待复习内容
- [ ] `POST /api/reviews/:id/done` - 标记已复习
- [ ] 定时推送机制（10:30 / 22:00）

### 3.2 定时任务
- [ ] 早上 10:30：昨日汇总 + 复习提醒
- [ ] 晚上 22:00：当日汇总
- [ ] 实现方式：node-cron 或外部调度器

### 3.3 归档管理
- [ ] `GET /api/archives` - 查看归档
- [ ] 自动归档规则
- [ ] 文件格式：`archives/YYYY-MM/HHMM.md`

---

## 阶段四：增强功能

### 4.1 AI 增强
- [ ] 多模型支持（MiniMax / OpenAI / Claude）
- [ ] 模型配置化
- [ ] Prompt 模板管理

### 4.2 搜索与查询
- [ ] 全文搜索
- [ ] 按标签/分类筛选
- [ ] 按时间范围查询

### 4.3 统计分析
- [ ] 念想数量统计
- [ ] 标签分布
- [ ] 活跃时段分析

---

## 阶段五：生态扩展

### 5.1 iOS App 对接
- [ ] WebSocket 实时推送
- [ ] 移动端适配
- [ ] 语音输入集成

### 5.2 第三方集成
- [ ] 飞书/钉钉 Bot
- [ ] Telegram Bot
- [ ] Slack 集成

### 5.3 数据导出
- [ ] JSON 导出
- [ ] Markdown 导出
- [ ] Obsidian 格式兼容

---

## 文件结构（当前）

```
OneMindBack/
├── src/
│   ├── index.js
│   ├── app.js
│   ├── routes/
│   │   ├── api.js         # Direct 实现
│   │   └── sdk.js         # AI SDK 实现
│   ├── services/
│   │   ├── aiService.js
│   │   └── storageFactory.js  # 存储抽象（File/MySQL）
│   ├── middleware/
│   │   └── auth.js
│   └── models/
│       └── textRecord.js
├── data/records/            # 文件存储
├── postman_collection.json
├── API.md
├── package.json
├── .env
└── TODO.md
```

## 存储层抽象

```javascript
// 环境变量配置
STORAGE_TYPE=file  // 或 mysql

// 接口
getStorage()  // 获取存储实例
// 方法: save(), get(), getAll(), delete(), list()
```

### MySQL 实现占位

```javascript
// storageFactory.js
async function createMySQLStorage() {
  return {
    async save(record) { /* TODO */ },
    async get(id) { /* TODO */ },
    async getAll() { /* TODO */ },
    async delete(id) { /* TODO */ },
    async list(limit, offset) { /* TODO */ }
  };
}
```

---

## 优先级排序

| 优先级 | 功能 | 理由 |
|--------|------|------|
| P0 | inbox 记录 | 核心场景 |
| P0 | capture 汇总 | 核心场景 |
| P1 | AI 深度加工 | 差异化价值 |
| P1 | 遗忘曲线复习 | 核心价值 |
| P2 | 定时任务 | 自动化 |
| P2 | 搜索查询 | 使用体验 |
| P3 | 统计分析 | 数据洞察 |
| P3 | 第三方集成 | 生态扩展 |

---

*最后更新：2026-03-21*