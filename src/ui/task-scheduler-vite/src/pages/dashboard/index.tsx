import './index.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Card,
  Empty,
  Form,
  Input,
  Layout,
  Modal,
  Select,
  Tag,
  message,
} from 'antd';
import {
  EditOutlined,
  FileTextOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  RocketOutlined,
  SearchOutlined,
  SendOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Run, Report, Task } from '../../services/types';
import { reportsAPI, runsAPI, tasksAPI } from '../../services/api';

const { Sider, Content } = Layout;

type TaskFormValues = Pick<
  Task,
  'name' | 'inputFilePath' | 'schedule' | 'scheduleTime' | 'analysisGoal' | 'status' | 'outputFormat'
>;

type DraftParseResult = {
  updates: Partial<TaskFormValues>;
  summary: string[];
  missing: string[];
  warnings: string[];
};

type ModalChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  kind?: 'text' | 'reasoning' | 'tool' | 'status';
  stageLabel?: string;
};

const quickPrompts = [
  '每周一早上 9 点分析 sales-weekly.xlsx，输出销售摘要',
  '每天下午 6 点分析 inventory-daily.csv，输出库存变化报告',
  '现在分析 finance-snapshot.xlsx，输出费用异常说明',
];

const initialAssistantMessage =
  '只描述任务本身即可，例如文件、执行频率和想输出的摘要。我会把内容整理成右侧结构化草稿。';
const chatApiKey = 'om_fixed_api_key_12345';

function getScheduleLabel(schedule: Task['schedule']) {
  if (schedule === 'daily') {
    return '每天';
  }
  if (schedule === 'weekly') {
    return '每周';
  }
  return '单次';
}

function getTaskStatusMeta(status: Task['status']) {
  if (status === 'active') {
    return { label: '运行中', color: 'success' as const };
  }
  if (status === 'error') {
    return { label: '异常', color: 'error' as const };
  }
  return { label: '已暂停', color: 'default' as const };
}

function getRunStatusMeta(status: Run['status']) {
  if (status === 'success') {
    return { label: '成功', tone: 'success' };
  }
  if (status === 'failed') {
    return { label: '失败', tone: 'danger' };
  }
  return { label: '运行中', tone: 'neutral' };
}

function formatDateTime(value?: string) {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function formatDuration(run: Run) {
  if (!run.finishedAt) {
    return '执行中';
  }

  const durationMs = new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime();
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds} 秒`;
  }

  return `${minutes} 分 ${seconds} 秒`;
}

function getFileName(path?: string) {
  if (!path) {
    return '未指定文件';
  }
  const segments = path.split(/[\\/]/);
  return segments[segments.length - 1] || path;
}

function toExcerpt(markdown: string) {
  return markdown.replace(/[#>*`-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 110);
}

function extractTimeText(text: string) {
  const match = text.match(
    /(凌晨\s*\d{1,2}(?::\d{2})?|早上\s*\d{1,2}(?::\d{2})?|上午\s*\d{1,2}(?::\d{2})?|中午\s*\d{1,2}(?::\d{2})?|下午\s*\d{1,2}(?::\d{2})?|晚上\s*\d{1,2}(?::\d{2})?|\d{1,2}:\d{2}|\d{1,2}点(?:\d{1,2}分)?)/,
  );

  if (!match) {
    return undefined;
  }

  return match[1].replace(/\s+/g, '');
}

function inferTaskName(goal?: string, filePath?: string) {
  if (goal) {
    const normalizedGoal = goal
      .replace(/^输出/, '')
      .replace(/^(一个|一份)/, '')
      .replace(/[。！!]$/g, '')
      .trim();

    if (normalizedGoal) {
      return normalizedGoal.endsWith('任务') ? normalizedGoal : `${normalizedGoal}任务`;
    }
  }

  if (filePath) {
    const base = getFileName(filePath).replace(/\.(csv|xlsx)$/i, '');
    return `${base} 分析任务`;
  }

  return undefined;
}

function parseTaskMessage(input: string, currentValues: Partial<TaskFormValues>): DraftParseResult {
  const updates: Partial<TaskFormValues> = {
    outputFormat: 'markdown',
  };
  const summary: string[] = [];
  const missing: string[] = [];
  const warnings: string[] = [];
  const text = input.trim();

  const fileMatch = text.match(/([A-Za-z0-9_./-]+\.(?:csv|xlsx))/i);
  if (fileMatch) {
    updates.inputFilePath = fileMatch[1];
    summary.push(`文件 ${fileMatch[1]}`);
  }

  if (/每周|weekly|周[一二三四五六日天]/i.test(text)) {
    updates.schedule = 'weekly';
    const weekday = text.match(/周[一二三四五六日天]/)?.[0];
    const timeText = extractTimeText(text);
    updates.scheduleTime = [weekday, timeText].filter(Boolean).join(' ') || '周一 09:00';
    summary.push(`每周执行 ${updates.scheduleTime}`);
  } else if (/每天|daily|每日/i.test(text)) {
    updates.schedule = 'daily';
    updates.scheduleTime = extractTimeText(text) || currentValues.scheduleTime || '09:00';
    summary.push(`每天执行 ${updates.scheduleTime}`);
  } else if (/现在|立即|马上|单次|once/i.test(text)) {
    updates.schedule = 'once';
    updates.scheduleTime = '立即执行';
    summary.push('单次执行');
  }

  const goalFromOutput = text.match(/(?:输出|生成)([^，。；;]+(?:报告|摘要|说明|结论|清单)?)/);
  const goalFromAnalyze = text.match(/分析(?:\s|)([^，。；;]+?)(?:，|,|并|然后|输出|生成|$)/);
  const rawGoal = goalFromOutput?.[1] || goalFromAnalyze?.[1];
  if (rawGoal) {
    const analysisGoal = rawGoal.replace(fileMatch?.[1] || '', '').trim();
    if (analysisGoal) {
      updates.analysisGoal = analysisGoal;
      summary.push(`目标 ${analysisGoal}`);
    }
  }

  const mergedGoal = updates.analysisGoal ?? currentValues.analysisGoal;
  const mergedFilePath = updates.inputFilePath ?? currentValues.inputFilePath;
  const generatedName = inferTaskName(mergedGoal, mergedFilePath);
  if (generatedName && (!currentValues.name || updates.analysisGoal || updates.inputFilePath)) {
    updates.name = generatedName;
    summary.push(`名称 ${generatedName}`);
  }

  if (!mergedFilePath) {
    missing.push('输入文件路径');
  }
  if (!mergedGoal) {
    missing.push('分析目标');
  }
  if (!updates.schedule && !currentValues.schedule) {
    missing.push('执行方式');
  }

  if (mergedFilePath && !/\.(csv|xlsx)$/i.test(mergedFilePath)) {
    warnings.push('首版仅支持 CSV / XLSX 文件，请调整输入路径。');
  }

  return { updates, summary, missing, warnings };
}

function buildAssistantReply(result: DraftParseResult) {
  const parts: string[] = [];

  if (result.summary.length > 0) {
    parts.push(`我已经更新草稿：${result.summary.join('，')}。`);
  }

  if (result.missing.length > 0) {
    parts.push(`还需要补充：${result.missing.join('、')}。`);
  }

  if (result.warnings.length > 0) {
    parts.push(result.warnings.join(' '));
  }

  if (parts.length === 0) {
    return '这条描述里还没有足够的结构化信息。请直接说明文件路径、执行频率和希望输出的结果。';
  }

  return parts.join(' ');
}

function shortenText(value: string, maxLength = 180) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...`;
}

function summarizeProcessPayload(value: unknown) {
  if (typeof value === 'string') {
    return shortenText(value);
  }

  if (value && typeof value === 'object') {
    const maybeOutput =
      'output' in value && typeof value.output === 'string' ? value.output : JSON.stringify(value);
    return shortenText(maybeOutput);
  }

  return '处理中...';
}

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskModalVisible, setTaskModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>();
  const [chatSessionId, setChatSessionId] = useState(() => `task_editor_${Date.now()}`);
  const [modalChatInput, setModalChatInput] = useState('');
  const [modalChatMessages, setModalChatMessages] = useState<ModalChatMessage[]>([
    { id: 'assistant-init', role: 'assistant', content: initialAssistantMessage, kind: 'text' },
  ]);
  const chatLogRef = useRef<HTMLDivElement | null>(null);
  const [form] = Form.useForm<TaskFormValues>();
  const formValues = Form.useWatch([], form) as Partial<TaskFormValues> | undefined;

  useEffect(() => {
    void fetchTasks();
    void fetchRuns();
    void fetchReports();
  }, []);

  useEffect(() => {
    if (!chatLogRef.current || !taskModalVisible) {
      return;
    }

    const node = chatLogRef.current;
    requestAnimationFrame(() => {
      node.scrollTop = node.scrollHeight;
    });
  }, [modalChatMessages, taskModalVisible]);

  const fetchTasks = async () => {
    try {
      const result = await tasksAPI.getList();
      if (result.success && result.data) {
        const nextTasks = result.data as Task[];
        setTasks(nextTasks);
        if (nextTasks.length === 0) {
          setSelectedTaskId(null);
          return;
        }
        if (!selectedTaskId || !nextTasks.some(task => task.id === selectedTaskId)) {
          setSelectedTaskId(nextTasks[0].id);
        }
      } else {
        message.error(result.errorMessage || '获取任务列表失败');
      }
    } catch {
      message.error('获取任务列表失败');
    }
  };

  const fetchRuns = async () => {
    try {
      const result = await runsAPI.getList();
      if (result.success && result.data) {
        setRuns(result.data as Run[]);
      } else {
        message.error(result.errorMessage || '获取运行记录失败');
      }
    } catch {
      message.error('获取运行记录失败');
    }
  };

  const fetchReports = async () => {
    try {
      const result = await reportsAPI.getList();
      if (result.success && result.data) {
        setReports(result.data as Report[]);
      } else {
        message.error(result.errorMessage || '获取报告失败');
      }
    } catch {
      message.error('获取报告失败');
    }
  };

  const filteredTasks = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();
    return [...tasks]
      .filter(task => {
        const matchesSearch =
          normalizedSearch.length === 0 ||
          task.name.toLowerCase().includes(normalizedSearch) ||
          task.inputFilePath.toLowerCase().includes(normalizedSearch);
        const matchesStatus = !statusFilter || task.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [searchText, statusFilter, tasks]);

  const selectedTask = useMemo(
    () => tasks.find(task => task.id === selectedTaskId) || null,
    [selectedTaskId, tasks],
  );

  const taskRuns = useMemo(() => {
    if (!selectedTaskId) {
      return [];
    }
    return [...runs]
      .filter(run => run.taskId === selectedTaskId)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }, [runs, selectedTaskId]);

  const taskReports = useMemo(() => {
    if (!selectedTaskId) {
      return [];
    }
    return [...reports]
      .filter(report => report.taskId === selectedTaskId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [reports, selectedTaskId]);

  const taskActivity = useMemo(() => {
    const reportByRunId = new Map(taskReports.map(report => [report.runId, report]));
    return taskRuns.map(run => ({
      run,
      report: reportByRunId.get(run.id),
    }));
  }, [taskReports, taskRuns]);

  const latestReport = taskReports[0];
  const lastFailedRun = taskRuns.find(run => run.status === 'failed');
  const successCount = taskRuns.filter(run => run.status === 'success').length;
  const successRate = taskRuns.length === 0 ? 0 : Math.round((successCount / taskRuns.length) * 100);
  const activeTaskCount = tasks.filter(task => task.status === 'active').length;
  const draftValues = formValues || {};

  const openCreateModal = () => {
    setEditingTask(null);
    setChatSessionId(`task_editor_${Date.now()}`);
    form.resetFields();
    form.setFieldsValue({
      schedule: 'once',
      scheduleTime: '立即执行',
      status: 'active',
      outputFormat: 'markdown',
    });
    setModalChatMessages([
      { id: 'assistant-init', role: 'assistant', content: initialAssistantMessage, kind: 'text' },
    ]);
    setModalChatInput('');
    setTaskModalVisible(true);
  };

  const openEditModal = () => {
    if (!selectedTask) {
      return;
    }

    setEditingTask(selectedTask);
    setChatSessionId(`task_editor_${selectedTask.id}_${Date.now()}`);
    form.setFieldsValue({
      name: selectedTask.name,
      inputFilePath: selectedTask.inputFilePath,
      schedule: selectedTask.schedule,
      scheduleTime: selectedTask.scheduleTime,
      analysisGoal: selectedTask.analysisGoal,
      status: selectedTask.status,
      outputFormat: selectedTask.outputFormat,
    });
    setModalChatMessages([
      {
        id: 'assistant-edit',
        role: 'assistant',
        content: `当前正在编辑「${selectedTask.name}」。继续描述你想修改的文件、频率或报告目标即可。`,
        kind: 'text',
      },
    ]);
    setModalChatInput('');
    setTaskModalVisible(true);
  };

  const closeTaskModal = () => {
    setTaskModalVisible(false);
  };

  const handleSubmitTask = async () => {
    try {
      const values = await form.validateFields();
      const payload: Partial<Task> = {
        ...values,
        outputFormat: 'markdown',
        status: values.status || 'active',
      };

      if (editingTask) {
        const result = await tasksAPI.update(editingTask.id, payload);
        if (!result.success) {
          throw new Error(result.errorMessage || '任务更新失败');
        }
        message.success('任务已更新');
      } else {
        const result = await tasksAPI.create(payload);
        if (!result.success) {
          throw new Error(result.errorMessage || '任务创建失败');
        }
        message.success('任务已创建');
      }

      closeTaskModal();
      await fetchTasks();
    } catch (error) {
      message.error((error as Error).message || '请先补全任务配置');
    }
  };

  const handleRunTask = async () => {
    if (!selectedTask) {
      return;
    }

    try {
      const result = await tasksAPI.run(selectedTask.id);
      if (!result.success) {
        throw new Error(result.errorMessage || '执行失败');
      }
      message.success('任务已触发执行');
      await Promise.all([fetchTasks(), fetchRuns(), fetchReports()]);
    } catch (error) {
      message.error((error as Error).message || '执行失败');
    }
  };

  const handleToggleTask = async () => {
    if (!selectedTask) {
      return;
    }

    const action = selectedTask.status === 'active' ? 'disable' : 'enable';
    try {
      const result =
        action === 'disable'
          ? await tasksAPI.disable(selectedTask.id)
          : await tasksAPI.enable(selectedTask.id);
      if (!result.success) {
        throw new Error(result.errorMessage || '操作失败');
      }
      message.success(selectedTask.status === 'active' ? '任务已暂停' : '任务已恢复');
      await fetchTasks();
    } catch (error) {
      message.error((error as Error).message || '操作失败');
    }
  };

  const setAssistantContent = (
    messageId: string,
    content: string,
    kind: ModalChatMessage['kind'] = 'status',
    stageLabel?: string,
  ) => {
    setModalChatMessages(prev => {
      const index = prev.findIndex(item => item.id === messageId);
      if (index === -1) {
        return [...prev, { id: messageId, role: 'assistant', content, kind, stageLabel }];
      }

      const next = [...prev];
      next[index] = {
        ...next[index],
        content,
        kind,
        stageLabel,
      };
      return next;
    });
  };

  const submitPrompt = async (prompt: string) => {
    const content = prompt.trim();
    if (!content) {
      return;
    }

    const userMessageId = `user-${Date.now()}`;
    const assistantMessageId = `assistant-${Date.now()}`;
    setModalChatMessages(prev => [
      ...prev,
      { id: userMessageId, role: 'user', content },
      {
        id: assistantMessageId,
        role: 'assistant',
        content: '正在解析任务草稿...',
        kind: 'status',
        stageLabel: '处理中',
      },
    ]);
    setModalChatInput('');

    const currentValues = form.getFieldsValue(true) as Partial<TaskFormValues>;
    const parsed = parseTaskMessage(content, currentValues);

    if (Object.keys(parsed.updates).length > 0) {
      form.setFieldsValue(parsed.updates);
    }

    const localDraftSummary = buildAssistantReply(parsed);
    let accumulatedText = '';
    let streamCompleted = false;

    try {
      setAssistantContent(assistantMessageId, '正在连接流式接口...', 'status', '处理中');
      const response = await fetch('/api/web/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': chatApiKey,
        },
        body: JSON.stringify({
          sessionId: chatSessionId,
          messages: [{ role: 'user', content }],
          useTools: true,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`chat stream request failed: ${response.status}`);
      }
      setAssistantContent(assistantMessageId, '流式连接已建立，等待模型返回...', 'status', '处理中');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line.startsWith('data:')) {
            continue;
          }

          const payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') {
            continue;
          }

          const event = JSON.parse(payload) as {
            type: string;
            text?: string;
            toolName?: string;
            delta?: string;
            output?: unknown;
            finishReason?: string;
          };

          switch (event.type) {
            case 'start':
              setAssistantContent(assistantMessageId, '开始处理这条请求...', 'status', '处理中');
              break;
            case 'start-step':
              setAssistantContent(assistantMessageId, '进入新的处理步骤...', 'status', '处理中');
              break;
            case 'reasoning-start':
              setAssistantContent(assistantMessageId, '模型开始推理...', 'reasoning', '推理');
              break;
            case 'reasoning-delta':
              setAssistantContent(
                assistantMessageId,
                event.text || '模型正在推理...',
                'reasoning',
                '推理',
              );
              break;
            case 'reasoning-end':
              setAssistantContent(
                assistantMessageId,
                '推理完成，准备生成回复...',
                'reasoning',
                '推理',
              );
              break;
            case 'tool-input-start':
              setAssistantContent(
                assistantMessageId,
                `调用工具 ${event.toolName || ''}...`,
                'tool',
                '工具调用',
              );
              break;
            case 'tool-input-delta':
              setAssistantContent(
                assistantMessageId,
                `工具参数：${shortenText(event.delta || '正在传递工具参数。')}`,
                'tool',
                '工具调用',
              );
              break;
            case 'tool-input-end':
              setAssistantContent(
                assistantMessageId,
                `工具 ${event.toolName || ''} 参数准备完成。`,
                'tool',
                '工具调用',
              );
              break;
            case 'tool-call':
              setAssistantContent(
                assistantMessageId,
                `工具 ${event.toolName || ''} 开始执行。`,
                'tool',
                '工具调用',
              );
              break;
            case 'tool-result':
              setAssistantContent(
                assistantMessageId,
                `工具 ${event.toolName || ''} 已返回：${summarizeProcessPayload(event.output)}`,
                'tool',
                '工具调用',
              );
              break;
            case 'text-start':
              setAssistantContent(
                assistantMessageId,
                accumulatedText || '正在生成回复...',
                accumulatedText ? 'text' : 'status',
                accumulatedText ? '回复' : '生成回复',
              );
              break;
            case 'text-delta':
              accumulatedText += event.text || '';
              setAssistantContent(assistantMessageId, accumulatedText, 'text', '回复');
              break;
            case 'text-end':
              setAssistantContent(
                assistantMessageId,
                accumulatedText || '当前段落输出完成，等待下一步...',
                accumulatedText ? 'text' : 'status',
                accumulatedText ? '回复' : '处理中',
              );
              break;
            case 'finish-step':
              setAssistantContent(
                assistantMessageId,
                event.finishReason === 'tool-calls'
                  ? '当前轮次结束，继续处理工具结果...'
                  : '当前步骤已完成，等待后续处理...',
                'status',
                '处理中',
              );
              break;
            case 'finish':
              if (event.finishReason === 'stop') {
                streamCompleted = true;
                setAssistantContent(
                  assistantMessageId,
                  accumulatedText || localDraftSummary,
                  'text',
                  '回复',
                );
              } else {
                setAssistantContent(
                  assistantMessageId,
                  event.finishReason === 'tool-calls'
                    ? '收到工具继续信号，等待下一轮处理...'
                    : `当前未完成，finishReason: ${event.finishReason || 'unknown'}`,
                  'status',
                  '处理中',
                );
              }
              break;
            default:
              break;
          }
        }
      }

      if (!streamCompleted) {
        setAssistantContent(
          assistantMessageId,
          accumulatedText || '流已结束，但未收到 finish: stop，当前回复仍视为未完成。',
          accumulatedText ? 'text' : 'status',
          accumulatedText ? '回复' : '处理中',
        );
      }
    } catch {
      setAssistantContent(
        assistantMessageId,
        `${localDraftSummary} 当前未能连通流式接口，已先按本地规则更新任务草稿。`,
        'text',
        '回复',
      );
    }
  };

  const heroStatusMeta = selectedTask ? getTaskStatusMeta(selectedTask.status) : null;

  return (
    <>
      <Layout className="dashboard-shell">
        <Sider width={344} className="task-sidebar">
          <div className="sidebar-hero">
            <div className="eyebrow">Desktop Agent / Task First</div>
            <h1>表格任务工作台</h1>
            <p>任务是唯一入口。聊天只服务于创建和编辑，报告始终附着在任务结果下。</p>
            <Button type="primary" icon={<PlusOutlined />} size="large" onClick={openCreateModal}>
              新建分析任务
            </Button>
          </div>

          <div className="sidebar-metrics">
            <div className="metric-chip">
              <span className="metric-chip-value">{tasks.length}</span>
              <span className="metric-chip-label">任务总数</span>
            </div>
            <div className="metric-chip">
              <span className="metric-chip-value">{activeTaskCount}</span>
              <span className="metric-chip-label">正在运行</span>
            </div>
            <div className="metric-chip">
              <span className="metric-chip-value">{reports.length}</span>
              <span className="metric-chip-label">报告累计</span>
            </div>
          </div>

          <div className="sidebar-toolbar">
            <Input
              value={searchText}
              onChange={event => setSearchText(event.target.value)}
              placeholder="搜索任务名或文件"
              prefix={<SearchOutlined />}
              allowClear
            />
            <Select
              value={statusFilter}
              onChange={value => setStatusFilter(value)}
              placeholder="全部状态"
              allowClear
              options={[
                { value: 'active', label: '运行中' },
                { value: 'paused', label: '已暂停' },
                { value: 'error', label: '异常' },
              ]}
            />
          </div>

          <div className="task-list">
            {filteredTasks.length === 0 ? (
              <Card className="task-empty-card">
                <Empty description="当前筛选下没有任务" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              </Card>
            ) : (
              filteredTasks.map(task => {
                const statusMeta = getTaskStatusMeta(task.status);
                return (
                  <button
                    key={task.id}
                    type="button"
                    className={`task-list-item ${selectedTaskId === task.id ? 'active' : ''}`}
                    onClick={() => setSelectedTaskId(task.id)}
                  >
                    <div className="task-list-item-top">
                      <span className="task-list-item-title">{task.name}</span>
                      <Tag color={statusMeta.color}>{statusMeta.label}</Tag>
                    </div>
                    <p className="task-list-item-goal">{task.analysisGoal || '等待补充分析目标'}</p>
                    <div className="task-list-item-meta">
                      <span>{getScheduleLabel(task.schedule)}</span>
                      <span>{task.scheduleTime || '未设时间'}</span>
                    </div>
                    <div className="task-list-item-footer">
                      <span>{getFileName(task.inputFilePath)}</span>
                      <span>更新于 {formatDateTime(task.updatedAt)}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </Sider>

        <Content className="task-detail-area">
          {selectedTask ? (
            <div className="task-detail-scroll">
              <section className="task-hero-card">
                <div className="task-hero-main">
                  <div className="eyebrow">Selected Task</div>
                  <h2>{selectedTask.name}</h2>
                  <p>{selectedTask.analysisGoal || '当前任务尚未填写分析目标。'}</p>
                  <div className="task-hero-tags">
                    <Tag color={heroStatusMeta?.color}>{heroStatusMeta?.label}</Tag>
                    <Tag>{getScheduleLabel(selectedTask.schedule)}</Tag>
                    <Tag>{selectedTask.scheduleTime || '未设时间'}</Tag>
                    <Tag icon={<FileTextOutlined />}>{selectedTask.outputFormat.toUpperCase()}</Tag>
                  </div>
                </div>
                <div className="task-hero-actions">
                  <Button
                    icon={
                      selectedTask.status === 'active' ? <PauseCircleOutlined /> : <PlayCircleOutlined />
                    }
                    onClick={handleToggleTask}
                  >
                    {selectedTask.status === 'active' ? '暂停任务' : '恢复任务'}
                  </Button>
                  <Button type="primary" icon={<RocketOutlined />} onClick={handleRunTask}>
                    立即运行
                  </Button>
                  <Button icon={<EditOutlined />} onClick={openEditModal}>
                    编辑配置
                  </Button>
                </div>
              </section>

              <section className="task-summary-grid">
                <Card className="summary-card">
                  <span className="summary-label">成功率</span>
                  <strong>{successRate}%</strong>
                  <p>{successCount} / {taskRuns.length || 0} 次执行成功</p>
                </Card>
                <Card className="summary-card">
                  <span className="summary-label">最新执行</span>
                  <strong>{formatDateTime(selectedTask.lastRunAt)}</strong>
                  <p>最近一次任务运行时间</p>
                </Card>
                <Card className="summary-card">
                  <span className="summary-label">下次计划</span>
                  <strong>{formatDateTime(selectedTask.nextRunAt)}</strong>
                  <p>{getScheduleLabel(selectedTask.schedule)} {selectedTask.scheduleTime || ''}</p>
                </Card>
                <Card className="summary-card">
                  <span className="summary-label">附着报告</span>
                  <strong>{taskReports.length}</strong>
                  <p>报告只作为当前任务的结果存在</p>
                </Card>
              </section>

              {selectedTask.status === 'error' && lastFailedRun ? (
                <section className="task-alert-card">
                  <WarningOutlined />
                  <div>
                    <strong>最近一次运行失败</strong>
                    <p>{lastFailedRun.errorMessage || '请检查输入文件与列结构。'}</p>
                  </div>
                </section>
              ) : null}

              <section className="task-detail-grid">
                <div className="task-detail-main">
                  <Card title="任务简报" className="detail-card detail-card-static">
                    <div className="detail-kv-grid">
                      <div className="detail-kv">
                        <span>输入文件</span>
                        <strong>{selectedTask.inputFilePath}</strong>
                      </div>
                      <div className="detail-kv">
                        <span>文件类型</span>
                        <strong>{getFileName(selectedTask.inputFilePath).split('.').pop()?.toUpperCase() || '-'}</strong>
                      </div>
                      <div className="detail-kv">
                        <span>执行规则</span>
                        <strong>{getScheduleLabel(selectedTask.schedule)} / {selectedTask.scheduleTime || '未设时间'}</strong>
                      </div>
                      <div className="detail-kv">
                        <span>输出格式</span>
                        <strong>Markdown 报告</strong>
                      </div>
                    </div>
                  </Card>

                  <Card
                    title="最新报告"
                    extra={latestReport ? <span className="card-meta-text">{formatDateTime(latestReport.createdAt)}</span> : null}
                    className="detail-card detail-card-report"
                  >
                    {latestReport ? (
                      <div className="report-preview">
                        <div className="report-preview-meta">
                          <span>关联运行：{latestReport.runId}</span>
                          <span>生成于 {formatDateTime(latestReport.createdAt)}</span>
                        </div>
                        <div className="report-markdown">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {latestReport.contentMarkdown}
                          </ReactMarkdown>
                        </div>
                      </div>
                    ) : (
                      <Empty description="该任务还没有报告" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    )}
                  </Card>

                </div>

                <div className="task-detail-side">
                  <Card title="运行与报告历史" className="detail-card detail-card-activity">
                    {taskActivity.length === 0 ? (
                      <Empty description="暂无运行记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    ) : (
                      <div className="activity-list">
                        {taskActivity.map(({ run, report }) => {
                          const runStatusMeta = getRunStatusMeta(run.status);
                          return (
                            <div key={run.id} className="activity-row">
                              <div className={`run-status-dot ${runStatusMeta.tone}`} />
                              <div className="activity-row-content">
                                <div className="activity-row-top">
                                  <strong>{formatDateTime(run.startedAt)}</strong>
                                  <span className={`run-status-pill ${runStatusMeta.tone}`}>
                                    {runStatusMeta.label}
                                  </span>
                                </div>
                                <p>{report ? toExcerpt(report.contentMarkdown) : run.errorMessage || '该次执行未生成报告。'}</p>
                                <div className="activity-row-meta">
                                  <span>{run.id}</span>
                                  <span>{report ? report.id : formatDuration(run)}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                </div>
              </section>
            </div>
          ) : (
            <Card className="empty-workspace-card">
              <div className="empty-workspace-content">
                <div className="eyebrow">No Task Selected</div>
                <h2>先创建一个表格分析任务</h2>
                <p>从左侧任务列表进入，或直接创建新任务。主界面不会出现独立聊天页和独立报告页。</p>
                <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
                  创建任务
                </Button>
              </div>
            </Card>
          )}
        </Content>
      </Layout>

      <Modal
        open={taskModalVisible}
        title={editingTask ? '编辑任务' : '新建任务'}
        onCancel={closeTaskModal}
        width={1120}
        className="task-editor-modal"
        footer={[
          <Button key="cancel" onClick={closeTaskModal}>
            取消
          </Button>,
          <Button key="submit" type="primary" onClick={handleSubmitTask}>
            保存任务
          </Button>,
        ]}
      >
        <div className="editor-shell">
          <section className="editor-chat-panel">
            <div className="editor-panel-header">
              <div>
                <span className="eyebrow">Chat For Task Editing Only</span>
                <h3>自然语言输入</h3>
              </div>
              <span className="editor-tip">只围绕文件、频率、目标</span>
            </div>

            <div className="editor-suggestions">
              {quickPrompts.map(prompt => (
                <button key={prompt} type="button" onClick={() => submitPrompt(prompt)}>
                  {prompt}
                </button>
              ))}
            </div>

            <div className="editor-chat-log" ref={chatLogRef}>
              {modalChatMessages.map((messageItem, index) => (
                <div key={messageItem.id || `${messageItem.role}-${index}`} className={`editor-message ${messageItem.role}`}>
                  <div
                    className={`editor-message-bubble ${messageItem.role === 'assistant' ? `assistant-${messageItem.kind || 'status'}` : ''}`}
                  >
                    {messageItem.role === 'assistant' && messageItem.kind === 'text' ? (
                      <div className="editor-message-markdown">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {messageItem.content}
                        </ReactMarkdown>
                      </div>
                    ) : messageItem.role === 'assistant' ? (
                      <div className="editor-message-stage">
                        <span className={`editor-stage-badge ${messageItem.kind || 'status'}`}>
                          {messageItem.stageLabel || '处理中'}
                        </span>
                        <div className="editor-stage-text">{messageItem.content}</div>
                      </div>
                    ) : (
                      messageItem.content
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="editor-input-row">
              <Input
                value={modalChatInput}
                onChange={event => setModalChatInput(event.target.value)}
                onPressEnter={() => submitPrompt(modalChatInput)}
                placeholder="例如：每周三下午 2 点分析 complaints.csv，输出投诉归因摘要"
              />
              <Button type="primary" icon={<SendOutlined />} onClick={() => submitPrompt(modalChatInput)} />
            </div>
          </section>

          <section className="editor-form-panel">
            <div className="editor-panel-header">
              <div>
                <span className="eyebrow">Structured Draft</span>
                <h3>结构化配置预览</h3>
              </div>
              <span className="editor-tip">CSV / XLSX in, Markdown out</span>
            </div>

            <div className="draft-preview-card">
              <div className="draft-preview-row">
                <span>任务名称</span>
                <strong>{draftValues.name || '等待聊天生成名称'}</strong>
              </div>
              <div className="draft-preview-row">
                <span>输入文件</span>
                <strong>{draftValues.inputFilePath || '请补充 CSV / XLSX 文件路径'}</strong>
              </div>
              <div className="draft-preview-row">
                <span>执行方式</span>
                <strong>
                  {draftValues.schedule ? getScheduleLabel(draftValues.schedule) : '待确认'}
                  {draftValues.scheduleTime ? ` / ${draftValues.scheduleTime}` : ''}
                </strong>
              </div>
              <div className="draft-preview-row">
                <span>分析目标</span>
                <strong>{draftValues.analysisGoal || '等待补充输出目标'}</strong>
              </div>
              <div className="draft-preview-row">
                <span>输出格式</span>
                <strong>{(draftValues.outputFormat || 'markdown').toUpperCase()}</strong>
              </div>
            </div>

            <Form form={form} layout="vertical" className="task-form">
              <Form.Item
                name="name"
                label="任务名称"
                rules={[{ required: true, message: '请输入任务名称' }]}
              >
                <Input placeholder="例如：销售周报摘要任务" />
              </Form.Item>

              <Form.Item
                name="inputFilePath"
                label="输入文件路径"
                rules={[
                  { required: true, message: '请输入 CSV / XLSX 文件路径' },
                  {
                    pattern: /\.(csv|xlsx)$/i,
                    message: '首版仅支持 CSV / XLSX 文件',
                  },
                ]}
              >
                <Input placeholder="/workspace/reports/sales-weekly.xlsx" />
              </Form.Item>

              <div className="form-grid">
                <Form.Item
                  name="schedule"
                  label="执行方式"
                  rules={[{ required: true, message: '请选择执行方式' }]}
                >
                  <Select
                    options={[
                      { value: 'once', label: '单次' },
                      { value: 'daily', label: '每天' },
                      { value: 'weekly', label: '每周' },
                    ]}
                  />
                </Form.Item>

                <Form.Item name="scheduleTime" label="时间说明">
                  <Input placeholder="例如：周一 09:00 / 18:00 / 立即执行" />
                </Form.Item>
              </div>

              <Form.Item
                name="analysisGoal"
                label="分析目标"
                rules={[{ required: true, message: '请描述希望输出的分析结果' }]}
              >
                <Input.TextArea
                  rows={4}
                  placeholder="例如：输出销售摘要、异常门店和需要复盘的区域"
                />
              </Form.Item>

              <div className="form-grid">
                <Form.Item name="status" label="任务状态" initialValue="active">
                  <Select
                    options={[
                      { value: 'active', label: '运行中' },
                      { value: 'paused', label: '已暂停' },
                      { value: 'error', label: '异常' },
                    ]}
                  />
                </Form.Item>

                <Form.Item name="outputFormat" label="输出格式" initialValue="markdown">
                  <Input disabled />
                </Form.Item>
              </div>
            </Form>
          </section>
        </div>
      </Modal>
    </>
  );
}
