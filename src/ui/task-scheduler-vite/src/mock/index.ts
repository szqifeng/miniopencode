import type { Tool, Task, ChatMessage, ChatSettings, KnowledgeItem } from '../services/types';

const mockTools: Tool[] = [
  {
    id: '1',
    name: 'Python 数据清洗脚本',
    type: 'script',
    description: '用于清洗业务数据的 Python 脚本',
    status: 'active',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-10T00:00:00Z',
  },
  {
    id: '2',
    name: '用户同步 API',
    type: 'api',
    description: '从第三方系统同步用户数据',
    status: 'active',
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-12T00:00:00Z',
  },
  {
    id: '3',
    name: '日志备份脚本',
    type: 'shell',
    description: '定期备份系统日志到存储',
    status: 'inactive',
    createdAt: '2024-01-03T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
  },
  {
    id: '4',
    name: 'MySQL 备份脚本',
    type: 'shell',
    description: '定期备份 MySQL 数据库到远程存储',
    status: 'active',
    createdAt: '2024-01-04T00:00:00Z',
    updatedAt: '2024-01-14T00:00:00Z',
  },
  {
    id: '5',
    name: 'Excel 报表生成器',
    type: 'script',
    description: '自动生成销售报表并发送邮件',
    status: 'active',
    createdAt: '2024-01-05T00:00:00Z',
    updatedAt: '2024-01-12T00:00:00Z',
  },
  {
    id: '6',
    name: 'Redis 缓存清理',
    type: 'shell',
    description: '清理过期缓存释放内存空间',
    status: 'active',
    createdAt: '2024-01-06T00:00:00Z',
    updatedAt: '2024-01-14T00:00:00Z',
  },
  {
    id: '7',
    name: '日志分析脚本',
    type: 'script',
    description: '分析 NGINX 日志生成访问统计',
    status: 'inactive',
    createdAt: '2024-01-07T00:00:00Z',
    updatedAt: '2024-01-13T00:00:00Z',
  },
  {
    id: '8',
    name: '批量邮件发送',
    type: 'api',
    description: '通过 SMTP 批量发送营销邮件',
    status: 'active',
    createdAt: '2024-01-08T00:00:00Z',
    updatedAt: '2024-01-14T00:00:00Z',
  },
  {
    id: '9',
    name: '图片批量压缩',
    type: 'script',
    description: '压缩产品图片减小存储空间',
    status: 'active',
    createdAt: '2024-01-09T00:00:00Z',
    updatedAt: '2024-01-14T00:00:00Z',
  },
  {
    id: '10',
    name: '系统健康检查',
    type: 'api',
    description: '检查服务器 CPU、内存、磁盘状态',
    status: 'active',
    createdAt: '2024-01-10T00:00:00Z',
    updatedAt: '2024-01-14T00:00:00Z',
  },
];

const mockTasks: Task[] = [
  {
    id: '1',
    name: '每日数据清洗',
    toolId: '1',
    toolName: 'Python 数据清洗脚本',
    status: 'enabled',
    schedule: {
      enabled: true,
      type: 'daily',
      time: '02:00',
    },
    lastRunTime: '2024-01-14T02:00:00Z',
    nextRunTime: '2024-01-15T02:00:00Z',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-10T00:00:00Z',
  },
  {
    id: '2',
    name: '用户数据同步',
    toolId: '2',
    toolName: '用户同步 API',
    status: 'enabled',
    schedule: {
      enabled: true,
      type: 'weekly',
      time: '14:00',
      weekday: 1,
    },
    lastRunTime: '2024-01-14T12:00:00Z',
    nextRunTime: '2024-01-14T18:00:00Z',
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-12T00:00:00Z',
  },
  {
    id: '3',
    name: '日志备份',
    toolId: '3',
    toolName: '日志备份脚本',
    status: 'disabled',
    schedule: {
      enabled: false,
      type: 'daily',
      time: '00:00',
    },
    lastRunTime: '2024-01-13T00:00:00Z',
    nextRunTime: '-',
    createdAt: '2024-01-03T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
  },
  {
    id: '4',
    name: '数据库备份',
    toolId: '4',
    toolName: 'MySQL 备份脚本',
    status: 'enabled',
    schedule: {
      enabled: true,
      type: 'daily',
      time: '03:00',
    },
    lastRunTime: '2024-01-14T03:00:00Z',
    nextRunTime: '2024-01-15T03:00:00Z',
    createdAt: '2024-01-04T00:00:00Z',
    updatedAt: '2024-01-14T00:00:00Z',
  },
  {
    id: '5',
    name: '报表生成',
    toolId: '5',
    toolName: 'Excel 报表生成器',
    status: 'enabled',
    schedule: {
      enabled: true,
      type: 'weekly',
      time: '09:00',
      weekday: 5,
    },
    lastRunTime: '2024-01-12T09:00:00Z',
    nextRunTime: '2024-01-19T09:00:00Z',
    createdAt: '2024-01-05T00:00:00Z',
    updatedAt: '2024-01-12T00:00:00Z',
  },
  {
    id: '6',
    name: '缓存清理',
    toolId: '6',
    toolName: 'Redis 缓存清理',
    status: 'enabled',
    schedule: {
      enabled: true,
      type: 'daily',
      time: '04:30',
    },
    lastRunTime: '2024-01-14T04:30:00Z',
    nextRunTime: '2024-01-15T04:30:00Z',
    createdAt: '2024-01-06T00:00:00Z',
    updatedAt: '2024-01-14T00:00:00Z',
  },
  {
    id: '7',
    name: '日志分析',
    toolId: '7',
    toolName: '日志分析脚本',
    status: 'disabled',
    schedule: {
      enabled: false,
      type: 'daily',
      time: '06:00',
    },
    lastRunTime: '2024-01-10T06:00:00Z',
    nextRunTime: '-',
    createdAt: '2024-01-07T00:00:00Z',
    updatedAt: '2024-01-13T00:00:00Z',
  },
  {
    id: '8',
    name: '邮件发送',
    toolId: '8',
    toolName: '批量邮件发送',
    status: 'enabled',
    schedule: {
      enabled: true,
      type: 'weekly',
      time: '10:00',
      weekday: 0,
    },
    lastRunTime: '2024-01-14T10:00:00Z',
    nextRunTime: '2024-01-21T10:00:00Z',
    createdAt: '2024-01-08T00:00:00Z',
    updatedAt: '2024-01-14T00:00:00Z',
  },
  {
    id: '9',
    name: '图片压缩',
    toolId: '9',
    toolName: '图片批量压缩',
    status: 'enabled',
    schedule: {
      enabled: true,
      type: 'daily',
      time: '01:00',
    },
    lastRunTime: '2024-01-14T01:00:00Z',
    nextRunTime: '2024-01-15T01:00:00Z',
    createdAt: '2024-01-09T00:00:00Z',
    updatedAt: '2024-01-14T00:00:00Z',
  },
  {
    id: '10',
    name: '监控系统检查',
    toolId: '10',
    toolName: '系统健康检查',
    status: 'enabled',
    schedule: {
      enabled: true,
      type: 'weekly',
      time: '08:00',
      weekday: 3,
    },
    lastRunTime: '2024-01-10T08:00:00Z',
    nextRunTime: '2024-01-17T08:00:00Z',
    createdAt: '2024-01-10T00:00:00Z',
    updatedAt: '2024-01-14T00:00:00Z',
  },
  {
    id: '11',
    name: '订单数据同步',
    toolId: '2',
    toolName: '用户同步 API',
    status: 'enabled',
    schedule: {
      enabled: true,
      type: 'daily',
      time: '23:00',
    },
    lastRunTime: '2024-01-14T23:00:00Z',
    nextRunTime: '2024-01-15T23:00:00Z',
    createdAt: '2024-01-11T00:00:00Z',
    updatedAt: '2024-01-14T00:00:00Z',
  },
  {
    id: '12',
    name: '库存预警检查',
    toolId: '5',
    toolName: 'Excel 报表生成器',
    status: 'enabled',
    schedule: {
      enabled: true,
      type: 'daily',
      time: '07:00',
    },
    lastRunTime: '2024-01-14T07:00:00Z',
    nextRunTime: '2024-01-15T07:00:00Z',
    createdAt: '2024-01-12T00:00:00Z',
    updatedAt: '2024-01-14T00:00:00Z',
  },
  {
    id: '13',
    name: '数据导出任务',
    toolId: '1',
    toolName: 'Python 数据清洗脚本',
    status: 'disabled',
    schedule: {
      enabled: false,
      type: 'weekly',
      time: '18:00',
      weekday: 6,
    },
    lastRunTime: '2024-01-13T18:00:00Z',
    nextRunTime: '-',
    createdAt: '2024-01-13T00:00:00Z',
    updatedAt: '2024-01-14T00:00:00Z',
  },
  {
    id: '14',
    name: '会话清理',
    toolId: '6',
    toolName: 'Redis 缓存清理',
    status: 'enabled',
    schedule: {
      enabled: true,
      type: 'daily',
      time: '05:00',
    },
    lastRunTime: '2024-01-14T05:00:00Z',
    nextRunTime: '2024-01-15T05:00:00Z',
    createdAt: '2024-01-14T00:00:00Z',
    updatedAt: '2024-01-14T00:00:00Z',
  },
  {
    id: '15',
    name: 'CDN 缓存刷新',
    toolId: '9',
    toolName: '图片批量压缩',
    status: 'enabled',
    schedule: {
      enabled: true,
      type: 'weekly',
      time: '02:00',
      weekday: 1,
    },
    lastRunTime: '2024-01-08T02:00:00Z',
    nextRunTime: '2024-01-15T02:00:00Z',
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
  },
  {
    id: '16',
    name: '搜索索引重建',
    toolId: '1',
    toolName: 'Python 数据清洗脚本',
    status: 'disabled',
    schedule: {
      enabled: false,
      type: 'weekly',
      time: '03:00',
      weekday: 0,
    },
    lastRunTime: '2024-01-07T03:00:00Z',
    nextRunTime: '-',
    createdAt: '2024-01-16T00:00:00Z',
    updatedAt: '2024-01-16T00:00:00Z',
  },
  {
    id: '17',
    name: '异常数据标记',
    toolId: '5',
    toolName: 'Excel 报表生成器',
    status: 'enabled',
    schedule: {
      enabled: true,
      type: 'daily',
      time: '08:30',
    },
    lastRunTime: '2024-01-14T08:30:00Z',
    nextRunTime: '2024-01-15T08:30:00Z',
    createdAt: '2024-01-17T00:00:00Z',
    updatedAt: '2024-01-17T00:00:00Z',
  },
  {
    id: '18',
    name: '支付对账',
    toolId: '2',
    toolName: '用户同步 API',
    status: 'enabled',
    schedule: {
      enabled: true,
      type: 'daily',
      time: '09:30',
    },
    lastRunTime: '2024-01-14T09:30:00Z',
    nextRunTime: '2024-01-15T09:30:00Z',
    createdAt: '2024-01-18T00:00:00Z',
    updatedAt: '2024-01-18T00:00:00Z',
  },
  {
    id: '19',
    name: '用户行为分析',
    toolId: '7',
    toolName: '日志分析脚本',
    status: 'enabled',
    schedule: {
      enabled: true,
      type: 'daily',
      time: '06:30',
    },
    lastRunTime: '2024-01-14T06:30:00Z',
    nextRunTime: '2024-01-15T06:30:00Z',
    createdAt: '2024-01-19T00:00:00Z',
    updatedAt: '2024-01-19T00:00:00Z',
  },
  {
    id: '20',
    name: '证书过期检查',
    toolId: '10',
    toolName: '系统健康检查',
    status: 'enabled',
    schedule: {
      enabled: true,
      type: 'weekly',
      time: '10:30',
      weekday: 4,
    },
    lastRunTime: '2024-01-11T10:30:00Z',
    nextRunTime: '2024-01-18T10:30:00Z',
    createdAt: '2024-01-20T00:00:00Z',
    updatedAt: '2024-01-20T00:00:00Z',
  },
  {
    id: '21',
    name: '短信发送统计',
    toolId: '8',
    toolName: '批量邮件发送',
    status: 'enabled',
    schedule: {
      enabled: true,
      type: 'daily',
      time: '11:00',
    },
    lastRunTime: '2024-01-14T11:00:00Z',
    nextRunTime: '2024-01-15T11:00:00Z',
    createdAt: '2024-01-21T00:00:00Z',
    updatedAt: '2024-01-21T00:00:00Z',
  },
  {
    id: '22',
    name: '文件清理任务',
    toolId: '3',
    toolName: '日志备份脚本',
    status: 'disabled',
    schedule: {
      enabled: false,
      type: 'weekly',
      time: '04:00',
      weekday: 2,
    },
    lastRunTime: '2024-01-09T04:00:00Z',
    nextRunTime: '-',
    createdAt: '2024-01-22T00:00:00Z',
    updatedAt: '2024-01-22T00:00:00Z',
  },
  {
    id: '23',
    name: '数据库连接检查',
    toolId: '10',
    toolName: '系统健康检查',
    status: 'enabled',
    schedule: {
      enabled: true,
      type: 'daily',
      time: '00:30',
    },
    lastRunTime: '2024-01-14T00:30:00Z',
    nextRunTime: '2024-01-15T00:30:00Z',
    createdAt: '2024-01-23T00:00:00Z',
    updatedAt: '2024-01-23T00:00:00Z',
  },
  {
    id: '24',
    name: '报表数据汇总',
    toolId: '5',
    toolName: 'Excel 报表生成器',
    status: 'enabled',
    schedule: {
      enabled: true,
      type: 'weekly',
      time: '17:00',
      weekday: 5,
    },
    lastRunTime: '2024-01-12T17:00:00Z',
    nextRunTime: '2024-01-19T17:00:00Z',
    createdAt: '2024-01-24T00:00:00Z',
    updatedAt: '2024-01-24T00:00:00Z',
  },
  {
    id: '25',
    name: '文件上传备份',
    toolId: '4',
    toolName: 'MySQL 备份脚本',
    status: 'enabled',
    schedule: {
      enabled: true,
      type: 'daily',
      time: '03:30',
    },
    lastRunTime: '2024-01-14T03:30:00Z',
    nextRunTime: '2024-01-15T03:30:00Z',
    createdAt: '2024-01-25T00:00:00Z',
    updatedAt: '2024-01-25T00:00:00Z',
  },
];

const mockKnowledge: KnowledgeItem[] = [
  {
    id: '1',
    title: 'Python 脚本规范',
    content: '数据清洗脚本需要遵循以下规范：\n1. 输入文件格式为 CSV\n2. 输出文件格式为 JSON\n3. 错误处理需要记录日志',
    category: '开发规范',
    tags: ['Python', '规范'],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-10T00:00:00Z',
  },
  {
    id: '2',
    title: 'API 接口文档',
    content: '用户同步 API 接口说明：\n- 基础 URL: /api/users\n- 认证方式: Bearer Token',
    category: '开发规范',
    tags: ['API', '文档'],
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-12T00:00:00Z',
  },
  {
    id: '3',
    title: 'MySQL 备份策略',
    content: '数据库备份规范：\n1. 每日凌晨 3:00 全量备份\n2. 每小时增量备份\n3. 备份保留 30 天\n4. 备份文件加密存储',
    category: '运维规范',
    tags: ['MySQL', '备份'],
    createdAt: '2024-01-03T00:00:00Z',
    updatedAt: '2024-01-14T00:00:00Z',
  },
  {
    id: '4',
    title: 'Redis 使用最佳实践',
    content: 'Redis 缓存使用规范：\n1. key 命名规范：模块:实体:ID\n2. 设置合理的过期时间\n3. 避免存储过大的数据\n4. 定期清理无用缓存',
    category: '开发规范',
    tags: ['Redis', '缓存'],
    createdAt: '2024-01-04T00:00:00Z',
    updatedAt: '2024-01-10T00:00:00Z',
  },
  {
    id: '5',
    title: '邮件发送频率限制',
    content: '邮件发送规范：\n1. 每批次最多发送 100 封\n2. 间隔 2 秒避免被拦截\n3. 每日总发送量不超过 5000 封\n4. 添加退订链接',
    category: '运营规范',
    tags: ['邮件', '营销'],
    createdAt: '2024-01-05T00:00:00Z',
    updatedAt: '2024-01-12T00:00:00Z',
  },
  {
    id: '6',
    title: '图片压缩标准',
    content: '产品图片压缩规范：\n1. 最大分辨率 1920x1080\n2. 质量压缩至 80%\n3. 格式转换为 WebP\n4. 单文件不超过 500KB',
    category: '运维规范',
    tags: ['图片', '优化'],
    createdAt: '2024-01-06T00:00:00Z',
    updatedAt: '2024-01-13T00:00:00Z',
  },
  {
    id: '7',
    title: '系统监控指标',
    content: '服务器监控标准：\n1. CPU 使用率 > 80% 告警\n2. 内存使用率 > 85% 告警\n3. 磁盘使用率 > 90% 告警\n4. 服务响应时间 > 3s 告警',
    category: '运维规范',
    tags: ['监控', '告警'],
    createdAt: '2024-01-07T00:00:00Z',
    updatedAt: '2024-01-14T00:00:00Z',
  },
  {
    id: '8',
    title: '日志分析配置',
    content: 'NGINX 日志分析规范：\n1. 日志格式：JSON\n2. 分析维度：PV、UV、来源、状态码\n3. 慢查询定义：响应时间 > 1s\n4. 报表生成时间：每日 6:00',
    category: '运维规范',
    tags: ['日志', '分析'],
    createdAt: '2024-01-08T00:00:00Z',
    updatedAt: '2024-01-14T00:00:00Z',
  },
];

const mockMessages: ChatMessage[] = [
  {
    id: '1',
    role: 'assistant',
    content: '你好！我是 AI 助手，可以帮助你管理任务和工具。有什么我可以帮你的吗？',
    timestamp: '2024-01-14T10:00:00Z',
  },
];

let chatSettings: ChatSettings = {
  model: 'gpt-3.5-turbo',
  temperature: 0.7,
  maxTokens: 1000,
};

const toolMap: Record<string, string> = {
  '1': 'Python 数据清洗脚本',
  '2': '用户同步 API',
  '3': '日志备份脚本',
  '4': 'MySQL 备份脚本',
  '5': 'Excel 报表生成器',
  '6': 'Redis 缓存清理',
  '7': '日志分析脚本',
  '8': '批量邮件发送',
  '9': '图片批量压缩',
  '10': '系统健康检查',
  '11': '订单同步',
  '12': '库存检查',
  '13': '数据导出',
  '14': '会话清理',
  '15': 'CDN刷新',
};

const aiReplies = [
  '已为您查询，当前系统有 3 个任务正在运行。',
  '好的，我已经了解了你的需求。',
  '任务执行成功，上次运行时间已更新。',
  '根据当前设置，你的任务将在每天凌晨2点执行。',
  '工具列表已刷新，目前共有 3 个可用工具。',
];

export const mockHandlers = {
  'GET /api/tools': () => ({
    success: true,
    data: mockTools,
    total: mockTools.length,
  }),

  'GET /api/tools/:id': (params: { id: string }) => {
    const tool = mockTools.find((t) => t.id === params.id);
    return tool
      ? { success: true, data: tool }
      : { success: false, errorMessage: '工具不存在' };
  },

  'POST /api/tools': (body: Partial<Tool>) => {
    const newTool: Tool = {
      id: String(mockTools.length + 1),
      name: body.name || '',
      type: body.type || 'script',
      description: body.description || '',
      status: body.status || 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockTools.push(newTool);
    return { success: true, data: newTool };
  },

  'PUT /api/tools/:id': (params: { id: string }, body: Partial<Tool>) => {
    const index = mockTools.findIndex((t) => t.id === params.id);
    if (index !== -1) {
      mockTools[index] = { ...mockTools[index], ...body, updatedAt: new Date().toISOString() };
      return { success: true, data: mockTools[index] };
    }
    return { success: false, errorMessage: '工具不存在' };
  },

  'DELETE /api/tools/:id': (params: { id: string }) => {
    const index = mockTools.findIndex((t) => t.id === params.id);
    if (index !== -1) {
      mockTools.splice(index, 1);
      return { success: true };
    }
    return { success: false, errorMessage: '工具不存在' };
  },

  'GET /api/tasks': () => ({
    success: true,
    data: mockTasks,
    total: mockTasks.length,
  }),

  'GET /api/tasks/:id': (params: { id: string }) => {
    const task = mockTasks.find((t) => t.id === params.id);
    return task
      ? { success: true, data: task }
      : { success: false, errorMessage: '任务不存在' };
  },

  'POST /api/tasks': (body: Partial<Task>) => {
    const { toolId } = body;
    const newTask: Task = {
      id: String(mockTasks.length + 1),
      toolName: toolMap[toolId || ''] || '未知工具',
      lastRunTime: '-',
      nextRunTime: '-',
      status: 'enabled',
      name: body.name || '',
      toolId: toolId || '',
      schedule: body.schedule || { enabled: false, type: 'daily', time: '00:00' },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockTasks.push(newTask);
    return { success: true, data: newTask };
  },

  'PUT /api/tasks/:id': (params: { id: string }, body: Partial<Task>) => {
    const index = mockTasks.findIndex((t) => t.id === params.id);
    if (index !== -1) {
      const { toolId } = body;
      mockTasks[index] = {
        ...mockTasks[index],
        ...body,
        toolName: toolMap[toolId || ''] || mockTasks[index].toolName,
        updatedAt: new Date().toISOString(),
      };
      return { success: true, data: mockTasks[index] };
    }
    return { success: false, errorMessage: '任务不存在' };
  },

  'DELETE /api/tasks/:id': (params: { id: string }) => {
    const index = mockTasks.findIndex((t) => t.id === params.id);
    if (index !== -1) {
      mockTasks.splice(index, 1);
      return { success: true };
    }
    return { success: false, errorMessage: '任务不存在' };
  },

  'POST /api/tasks/:id/run': (params: { id: string }) => {
    const task = mockTasks.find((t) => t.id === params.id);
    if (task) {
      task.lastRunTime = new Date().toISOString();
      return { success: true, message: '任务已触发执行' };
    }
    return { success: false, errorMessage: '任务不存在' };
  },

  'POST /api/tasks/:id/enable': (params: { id: string }) => {
    const task = mockTasks.find((t) => t.id === params.id);
    if (task) {
      task.status = 'enabled';
      task.updatedAt = new Date().toISOString();
      return { success: true, data: task };
    }
    return { success: false, errorMessage: '任务不存在' };
  },

  'POST /api/tasks/:id/disable': (params: { id: string }) => {
    const task = mockTasks.find((t) => t.id === params.id);
    if (task) {
      task.status = 'disabled';
      task.updatedAt = new Date().toISOString();
      return { success: true, data: task };
    }
    return { success: false, errorMessage: '任务不存在' };
  },

  'GET /api/knowledge': () => ({
    success: true,
    data: mockKnowledge,
    total: mockKnowledge.length,
  }),

  'GET /api/knowledge/:id': (params: { id: string }) => {
    const item = mockKnowledge.find((k) => k.id === params.id);
    return item
      ? { success: true, data: item }
      : { success: false, errorMessage: '知识不存在' };
  },

  'POST /api/knowledge': (body: Partial<KnowledgeItem>) => {
    const newItem: KnowledgeItem = {
      id: String(mockKnowledge.length + 1),
      title: body.title || '',
      content: body.content || '',
      category: body.category,
      tags: body.tags || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockKnowledge.push(newItem);
    return { success: true, data: newItem };
  },

  'PUT /api/knowledge/:id': (params: { id: string }, body: Partial<KnowledgeItem>) => {
    const index = mockKnowledge.findIndex((k) => k.id === params.id);
    if (index !== -1) {
      mockKnowledge[index] = { ...mockKnowledge[index], ...body, updatedAt: new Date().toISOString() };
      return { success: true, data: mockKnowledge[index] };
    }
    return { success: false, errorMessage: '知识不存在' };
  },

  'DELETE /api/knowledge/:id': (params: { id: string }) => {
    const index = mockKnowledge.findIndex((k) => k.id === params.id);
    if (index !== -1) {
      mockKnowledge.splice(index, 1);
      return { success: true };
    }
    return { success: false, errorMessage: '知识不存在' };
  },

  'POST /api/chat': (_body: { message: string }) => {
    const reply = aiReplies[Math.floor(Math.random() * aiReplies.length)];
    const newMessage: ChatMessage = {
      id: String(mockMessages.length + 1),
      role: 'assistant',
      content: reply,
      timestamp: new Date().toISOString(),
    };
    mockMessages.push(newMessage);
    return { success: true, data: { reply, timestamp: newMessage.timestamp } };
  },

  'GET /api/chat/history': (params: { limit?: number }) => {
    const limit = params.limit || 20;
    return { success: true, data: mockMessages.slice(-limit) };
  },

  'GET /api/chat/settings': () => ({ success: true, data: chatSettings }),

  'PUT /api/chat/settings': (body: Partial<ChatSettings>) => {
    chatSettings = { ...chatSettings, ...body };
    return { success: true, data: chatSettings };
  },
};

export function setupMockServer() {
  const handleRequest = async (path: string, method: string, body?: any) => {
    const params: Record<string, string> = {};
    let matchedPath = path;

    for (const pattern of Object.keys(mockHandlers)) {
      const [m, p] = pattern.split(' ');
      if (m !== method) continue;

      const regex = new RegExp('^' + p.replace(/:(\w+)/g, (_, key) => {
        return '(?<' + key + '>[^/]+)';
      }) + '$');

      const match = matchedPath.match(regex);
      if (match) {
        Object.assign(params, match.groups || {});
        const handler = (mockHandlers as any)[pattern];
        return handler(params, body);
      }
    }
    return { success: false, errorMessage: 'Not found' };
  };

  (window as any).mockFetch = async (url: string, options: RequestInit = {}) => {
    const urlObj = new URL(url, window.location.origin);
    const path = urlObj.pathname;
    const method = options.method || 'GET';
    const body = options.body ? JSON.parse(options.body as string) : undefined;

    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));

    const result = await handleRequest(path, method, body);
    return {
      json: () => Promise.resolve(result),
    };
  };
}