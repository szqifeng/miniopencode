# Postman 使用规范

## 1. Header Value 使用变量

**原则**：Header 的 value 应尽可能使用 `{{}}` 变量引用，而非硬编码。

### 推荐写法
```json
"header": [
  {
    "key": "X-API-Key",
    "value": "{{apiKey}}"
  },
  {
    "key": "Content-Type",
    "value": "application/json"
  }
]
```

### 不推荐写法
```json
"header": [
  {
    "key": "X-API-Key",
    "value": "om_fixed_api_key_12345"
  }
]
```

### 优点
- **易于维护**：修改一处，全局生效
- **避免硬编码**：减少错误风险
- **环境切换**：不同环境（dev/staging/prod）只需修改变量值
- **版本控制友好**：不会泄露敏感信息到 Git

---

## 2. Collection 变量定义

在 Collection 的 `variable` 中统一管理：

```json
"variable": [
  {
    "key": "baseUrl",
    "value": "http://localhost:3000"
  },
  {
    "key": "apiKey",
    "value": "om_fixed_api_key_12345"
  }
]
```

---

## 3. 敏感信息管理

| 类型 | 处理方式 |
|------|----------|
| API Keys | 使用 `{{variable}}`，值放在 Environment 中 |
| Tokens | 使用 `{{token}}`，值放在 Environment 中 |
| URLs | 使用 `{{baseUrl}}`，区分不同环境 |
| 敏感数据 | 避免写入 JSON，运行时注入 |

---

## 4. 示例：完整的 Postman Collection 结构

```json
{
  "info": {
    "name": "Example API"
  },
  "variable": [
    { "key": "baseUrl", "value": "http://localhost:3000" },
    { "key": "apiKey", "value": "your-api-key-here" }
  ],
  "item": [
    {
      "name": "Example Request",
      "request": {
        "method": "POST",
        "url": {
          "raw": "{{baseUrl}}/api/example",
          "host": ["{{baseUrl}}"],
          "path": ["api", "example"]
        },
        "header": [
          { "key": "Content-Type", "value": "application/json" },
          { "key": "X-API-Key", "value": "{{apiKey}}" }
        ],
        "body": {
          "mode": "raw",
          "raw": "{ \"key\": \"{{dynamicValue}}\" }"
        }
      }
    }
  ]
}
```

---

*最后更新：2026-03-21*