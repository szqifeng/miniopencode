import './index.less';
import { useState, useEffect } from 'react';
import { Layout, Card, Tag, Button, Space, Modal, Form, Input, Select, Switch, TimePicker, message, Empty } from 'antd';
import { PlusOutlined, RocketOutlined, PlayCircleOutlined, PauseCircleOutlined, ToolOutlined, FileTextOutlined, SendOutlined, SettingOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import type { Task, Tool, KnowledgeItem } from '../../services/types';

const { Sider, Content } = Layout;

const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

const getScheduleLabel = (schedule: Task['schedule']) => {
  if (schedule.type === 'daily') return '每天';
  if (schedule.type === 'weekly') return `每周${weekDays[schedule.weekday || 0]}`;
  return schedule.type;
};

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskModalVisible, setTaskModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [activeTab, setActiveTab] = useState('tools');
  const [form] = Form.useForm();
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{role: string; content: string}[]>([
    { role: 'assistant', content: '你好！我是 AI 助手，可以在右侧帮助你管理任务、工具和知识库。' }
  ]);
  const [thinkingContent, setThinkingContent] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  useEffect(() => {
    fetchTasks();
    fetchTools();
    fetchKnowledge();
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await (window as any).mockFetch('/api/tasks');
      const result = await res.json();
      if (result.success && result.data) {
        setTasks(result.data);
        if (result.data.length > 0 && !selectedTaskId) {
          setSelectedTaskId(result.data[0].id);
        }
      }
    } catch (error) {
      message.error('获取任务列表失败');
    }
  };

  const fetchTools = async () => {
    try {
      const res = await (window as any).mockFetch('/api/tools');
      const result = await res.json();
      if (result.success && result.data) {
        setTools(result.data);
      }
    } catch (error) {
      console.error('获取工具列表失败', error);
    }
  };

  const fetchKnowledge = async () => {
    try {
      const res = await (window as any).mockFetch('/api/knowledge');
      const result = await res.json();
      if (result.success && result.data) {
        setKnowledge(result.data);
      }
    } catch (error) {
      console.error('获取知识库失败', error);
    }
  };

  const selectedTask = tasks.find(t => t.id === selectedTaskId);

  const handleAddTask = () => {
    setEditingTask(null);
    form.resetFields();
    setTaskModalVisible(true);
  };

  const handleEditTask = () => {
    if (selectedTask) {
      setEditingTask(selectedTask);
      form.setFieldsValue(selectedTask);
      setTaskModalVisible(true);
    }
  };

  const handleSubmitTask = async () => {
    try {
      const values = await form.validateFields();
      if (editingTask) {
        await (window as any).mockFetch(`/api/tasks/${editingTask.id}`, {
          method: 'PUT',
          body: JSON.stringify(values),
        });
        message.success('更新成功');
      } else {
        await (window as any).mockFetch('/api/tasks', {
          method: 'POST',
          body: JSON.stringify(values),
        });
        message.success('创建成功');
      }
      setTaskModalVisible(false);
      fetchTasks();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleRunTask = async () => {
    if (selectedTaskId) {
      try {
        await (window as any).mockFetch(`/api/tasks/${selectedTaskId}/run`, { method: 'POST' });
        message.success('任务已触发执行');
        fetchTasks();
      } catch (error) {
        message.error('执行失败');
      }
    }
  };

  const handleToggleTask = async () => {
    if (selectedTaskId && selectedTask) {
      const action = selectedTask.status === 'enabled' ? 'disable' : 'enable';
      try {
        await (window as any).mockFetch(`/api/tasks/${selectedTaskId}/${action}`, { method: 'POST' });
        message.success(selectedTask.status === 'enabled' ? '任务已禁用' : '任务已启用');
        fetchTasks();
      } catch (error) {
        message.error('操作失败');
      }
    }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim()) return;
    const userMessage = chatInput;
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setChatInput('');

    try {
      const response = await fetch('/api/web/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'om_fixed_api_key_12345',
        },
        body: JSON.stringify({
          sessionId: 'web_session_' + Date.now(),
          messages: [{ role: 'user', content: userMessage }],
          system: '你是助手，可以调用工具',
          useTools: true,
        }),
      });

      if (!response.ok) {
        throw new Error('请求失败');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';
      let reasoningMessage = '';
      let toolCallName = '';
      let buffer = '';

      if (reader) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: '' }]);
        setThinkingContent('');
        setIsThinking(false);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          buffer += chunk;

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          
          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;
            if (!trimmedLine.startsWith('data:')) continue;

            const jsonStr = trimmedLine.slice(5).trim();
            if (!jsonStr) continue;

            let parsed;
            try {
              parsed = JSON.parse(jsonStr);
            } catch (e) {
              continue;
            }

            const eventType = parsed.type;
            
            if (eventType === 'start') {
              reasoningMessage = '';
              assistantMessage = '';
              setThinkingContent('🤔 思考中...');
              setIsThinking(true);
            } else if (eventType === 'reasoning-start') {
              setThinkingContent('💭 推理中...');
            } else if (eventType === 'reasoning-delta') {
              reasoningMessage += parsed.text || '';
              setThinkingContent('💭 ' + reasoningMessage);
            } else if (eventType === 'reasoning-end') {
              setThinkingContent('🔧 处理中...');
            } else if (eventType === 'tool-input-start') {
              toolCallName = parsed.toolName || '';
              setThinkingContent(`📝 调用工具: ${toolCallName}`);
            } else if (eventType === 'tool-input-delta') {
              const delta = parsed.delta || '';
              setThinkingContent(prev => prev + delta);
            } else if (eventType === 'tool-input-end') {
              setThinkingContent(`⚡ 执行工具: ${toolCallName}...`);
            } else if (eventType === 'tool-result') {
              const result = parsed.output || '';
              const truncated = result.length > 200 ? result.substring(0, 200) + '...' : result;
              setThinkingContent(`✅ ${toolCallName} 返回:\n${truncated}`);
            } else if (eventType === 'text-delta') {
              setIsThinking(false);
              setThinkingContent('');
              assistantMessage += parsed.text || '';
              setChatMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', content: assistantMessage };
                return updated;
              });
            } else if (eventType === 'finish' && parsed.finishReason === 'stop') {
              setThinkingContent('');
              setIsThinking(false);
            }
          }
        }
      }
    } catch (error) {
      message.error('发送消息失败');
      setChatMessages(prev => [...prev, { role: 'assistant', content: '抱歉，发生了错误。' }]);
    }
  };

  return (
    <>
      <div className="top-line" />
    <Layout className="dashboard-container">
      <Sider width={420} className="task-sider" style={{ overflow: 'hidden' }}>
        <div className="sider-header">
          <span>任务列表</span>
          <Button type="text" size="small" icon={<PlusOutlined />} onClick={handleAddTask} />
        </div>
        <div className="task-list" style={{ height: 'calc(100vh - 36px - 48px)', overflowY: 'auto' }}>
          {tasks.map(task => (
            <div
              key={task.id}
              className={`task-item ${selectedTaskId === task.id ? 'active' : ''}`}
              onClick={() => setSelectedTaskId(task.id)}
            >
              <div className="task-item-title">
                <span>{task.name}</span>
                <Tag color={task.status === 'enabled' ? 'success' : 'default'}>
                  {task.status === 'enabled' ? '启用' : '禁用'}
                </Tag>
              </div>
              <div className="task-item-info">
                工具: {task.toolName}
              </div>
            </div>
          ))}
          {tasks.length === 0 && (
            <Empty description="暂无任务" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </div>
      </Sider>

      <Content className="main-content">
        {selectedTask ? (
          <div className="task-workspace">
            <Card className="task-detail-card">
              <div className="task-detail-header">
                <div className="task-title">
                  <h2>{selectedTask.name}</h2>
                  <Tag color={selectedTask.status === 'enabled' ? 'success' : 'default'}>
                    {selectedTask.status === 'enabled' ? '已启用' : '已禁用'}
                  </Tag>
                </div>
                <Space>
                  <Button
                    icon={selectedTask.status === 'enabled' ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
                    onClick={handleToggleTask}
                  >
                    {selectedTask.status === 'enabled' ? '禁用' : '启用'}
                  </Button>
                  <Button type="primary" icon={<RocketOutlined />} onClick={handleRunTask}>
                    立即执行
                  </Button>
                  <Button onClick={handleEditTask}>编辑</Button>
                </Space>
              </div>
              <div className="task-detail-info">
                <span>关联工具: {selectedTask.toolName}</span>
                <span>调度: {selectedTask.schedule.enabled ? `${getScheduleLabel(selectedTask.schedule)} ${selectedTask.schedule.time}` : '已禁用'}</span>
                <span>上次执行: {selectedTask.lastRunTime || '-'}</span>
                <span>下次执行: {selectedTask.nextRunTime || '-'}</span>
              </div>
            </Card>

            <div className="bind-modules">
              <Card title="已绑定工具" className="bind-card">
                <div className="bind-tags">
                  <Tag color="blue">{selectedTask.toolName}</Tag>
                </div>
              </Card>
              <Card title="已绑定知识库" className="bind-card">
                <div className="bind-tags">
                  <Tag color="green">Python 脚本规范</Tag>
                  <Tag color="green">API 文档</Tag>
                </div>
              </Card>
            </div>
          </div>
        ) : (
          <Empty description="请选择或创建一个任务" />
        )}
      </Content>

      <div className="right-panel">
        <div className="tabs-header">
          <div className={`tab-label ${activeTab === 'tools' ? 'active' : ''}`} onClick={() => setActiveTab('tools')}>
            <ToolOutlined /> 工具
          </div>
          <div className={`tab-label ${activeTab === 'knowledge' ? 'active' : ''}`} onClick={() => setActiveTab('knowledge')}>
            <FileTextOutlined /> 知识库
          </div>
          <div className={`tab-label ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>
            <SendOutlined /> 助手
          </div>
        </div>
        <div className="tabs-content">
          {activeTab === 'tools' && (
            <div className="module-list">
              {tools.map(tool => (
                <Card key={tool.id} size="small" className="module-card">
                  <div className="module-title">
                    <span>{tool.name}</span>
                    <Tag color="blue">{tool.type}</Tag>
                  </div>
                  <div className="module-desc">{tool.description}</div>
                  <Button size="small" type="link">绑定</Button>
                </Card>
              ))}
            </div>
          )}
          {activeTab === 'knowledge' && (
            <div className="module-list">
              {knowledge.map(item => (
                <Card key={item.id} size="small" className="module-card">
                  <div className="module-title">{item.title}</div>
                  <div className="module-desc">{item.content.substring(0, 50)}...</div>
                  <Button size="small" type="link">绑定</Button>
                </Card>
              ))}
            </div>
          )}
          {activeTab === 'chat' && (
            <div className="chat-container">
              <div className="chat-messages">
                {chatMessages.map((msg, idx) => {
                  const isLastMsg = idx === chatMessages.length - 1;
                  if (isLastMsg && isThinking && !msg.content) return null;
                  return (
                    <div key={idx} className={`chat-message ${msg.role}`}>
                      <div className="chat-avatar">{msg.role === 'user' ? 'U' : 'A'}</div>
                      <div className="chat-bubble">
                        {msg.role === 'assistant' ? (
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        ) : (
                          msg.content
                        )}
                      </div>
                    </div>
                  );
                })}
                {isThinking && thinkingContent && (
                  <div className="chat-message assistant">
                    <div className="chat-avatar">T</div>
                    <div className="chat-bubble thinking">
                      <ReactMarkdown>{thinkingContent}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
              <div className="chat-input">
                <Input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onPressEnter={handleSendChat}
                  placeholder="输入问题..."
                />
                <Button type="primary" icon={<SendOutlined />} onClick={handleSendChat} />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="footer-bar">
        <span className="footer-text">任务调度平台 v1.0</span>
        <Button type="text" size="small" icon={<SettingOutlined />} className="settings-btn" />
      </div>

      <Modal
        title={editingTask ? '编辑任务' : '新建任务'}
        open={taskModalVisible}
        onOk={handleSubmitTask}
        onCancel={() => setTaskModalVisible(false)}
        width={500}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="任务名称" rules={[{ required: true }]}>
            <Input placeholder="请输入任务名称" />
          </Form.Item>
          <Form.Item name="toolId" label="关联工具" rules={[{ required: true }]}>
            <Select placeholder="请选择工具">
              {tools.map(tool => (
                <Select.Option key={tool.id} value={tool.id}>{tool.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="调度设置">
            <Space align="start">
              <Form.Item name={['schedule', 'enabled']} valuePropName="checked" noStyle>
                <Switch />
              </Form.Item>
              <Form.Item name={['schedule', 'type']} noStyle>
                <Select style={{ width: 120 }} placeholder="频率">
                  <Select.Option value="daily">每天</Select.Option>
                  <Select.Option value="weekly">每周</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item noStyle shouldUpdate={(prev, curr) => prev.schedule?.type !== curr.schedule?.type}>
                {({ getFieldValue }) =>
                  getFieldValue(['schedule', 'type']) === 'weekly' && (
                    <Form.Item name={['schedule', 'weekday']} noStyle>
                      <Select style={{ width: 80 }} placeholder="星期">
                        {weekDays.map((day, idx) => (
                          <Select.Option key={idx} value={idx}>{day}</Select.Option>
                        ))}
                      </Select>
                    </Form.Item>
                  )
                }
              </Form.Item>
              <Form.Item name={['schedule', 'time']} noStyle>
                <TimePicker format="HH:mm" placeholder="时间" minuteStep={15} />
              </Form.Item>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
    </>
  );
}