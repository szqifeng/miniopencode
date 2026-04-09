import './index.css';
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  Button,
  Card,
  Empty,
  Form,
  Input,
  Layout,
  Modal,
  Select,
  Spin,
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
  UploadOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Run, Report, Task, TaskDraftResolveResult, TaskFile } from '../../services/types';
import { getApiBase, reportsAPI, runsAPI, tasksAPI } from '../../services/api';

const { Sider, Content } = Layout;

type TaskFormValues = Pick<
  Task,
  'name' | 'inputFilePath' | 'schedule' | 'analysisGoal' | 'status' | 'outputFormat'
> & {
  scheduleConfig: {
    minute: number | null;
    time: string;
    weekday: number | null;
  };
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
  '手动执行 finance-snapshot.xlsx，输出费用异常说明',
];

const initialAssistantMessage =
  '只描述任务本身即可，例如文件、执行频率和想输出的摘要。我会把内容整理成右侧结构化草稿。';
const chatApiKey = 'om_fixed_api_key_12345';
function createEmptyScheduleConfig() {
  return {
    minute: null,
    time: '',
    weekday: null,
  };
}

function buildScheduleTime(schedule: Task['schedule'] | undefined) {
  if (!schedule) {
    return '';
  }
  if (schedule === 'manual') {
    return '仅手动执行';
  }
  return '仅手动执行';
}

function buildDraftAssistantReply(result: TaskDraftResolveResult) {
  const sections: string[] = [];

  if (result.summary.length > 0) {
    sections.push(`已更新草稿：${result.summary.join('，')}。`);
  }
  if (result.missing.length > 0) {
    sections.push(`还需要补充：${result.missing.join('、')}。`);
  }
  if (result.warnings.length > 0) {
    sections.push(result.warnings.join(' '));
  }

  return sections.join('\n\n') || '这条描述还不足以更新任务草稿，请继续补充文件、频率或分析目标。';
}

function normalizeAssistantMarkdown(content: string) {
  const normalized = String(content || '').trimStart();
  const duplicateFileHeader = normalized.match(/^(【文件：[^】]+】)(?:\s*\1)+/);
  if (!duplicateFileHeader) {
    return normalized;
  }
  return normalized.replace(/^(【文件：[^】]+】)(?:\s*\1)+/, duplicateFileHeader[1]);
}

function joinWorkspaceFilePath(workspaceDir?: string, inputFilePath?: string) {
  const base = String(workspaceDir || '').trim();
  const relative = String(inputFilePath || '').trim();
  if (!base || !relative) {
    return '';
  }
  if (relative.startsWith('/')) {
    return relative;
  }
  return `${base}/${relative}`.replace(/\/+/g, '/');
}

function createDraftTaskId() {
  return `task_${Date.now()}`;
}

function getScheduleLabel(schedule: Task['schedule']) {
  if (schedule === 'hourly') {
    return '手动';
  }
  if (schedule === 'daily') {
    return '手动';
  }
  if (schedule === 'weekly') {
    return '手动';
  }
  return '手动';
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

export default function Dashboard() {
  const isDesktopRuntime =
    window.location.protocol === 'file:' ||
    Boolean(window.__MINIOPENCODE_DESKTOP__?.apiBase) ||
    Boolean(new URLSearchParams(window.location.search).get('miniopencodeApiBase'));
  const [tasks, setTasks] = useState<Task[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskModalVisible, setTaskModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>();
  const [connectionIssue, setConnectionIssue] = useState<string | null>(null);
  const [chatSessionId, setChatSessionId] = useState(() => `task_editor_${Date.now()}`);
  const [editorTaskId, setEditorTaskId] = useState(() => createDraftTaskId());
  const [editorWorkspaceDir, setEditorWorkspaceDir] = useState('');
  const [editorUploadedFiles, setEditorUploadedFiles] = useState<TaskFile[]>([]);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [isResolvingDraft, setIsResolvingDraft] = useState(false);
  const [isDraftPreviewLoading, setIsDraftPreviewLoading] = useState(false);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [isRunningTask, setIsRunningTask] = useState(false);
  const [modalChatInput, setModalChatInput] = useState('');
  const [draftResolveResult, setDraftResolveResult] = useState<TaskDraftResolveResult | null>(null);
  const [chatContextNotes, setChatContextNotes] = useState<string[]>([]);
  const [modalChatMessages, setModalChatMessages] = useState<ModalChatMessage[]>([
    { id: 'assistant-init', role: 'assistant', content: initialAssistantMessage, kind: 'text' },
  ]);
  const chatLogRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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
        setConnectionIssue(null);
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
        setConnectionIssue(result.errorMessage || '任务接口不可用，请先启动后端服务');
        message.error(result.errorMessage || '获取任务列表失败');
      }
    } catch {
      setConnectionIssue('任务接口不可用，请先启动后端服务');
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
    const nextDraftTaskId = createDraftTaskId();
    setEditingTask(null);
    setChatSessionId(`task_editor_${Date.now()}`);
    setEditorTaskId(nextDraftTaskId);
    setEditorWorkspaceDir('');
    setEditorUploadedFiles([]);
    setDraftResolveResult(null);
    setChatContextNotes([]);
    form.resetFields();
    form.setFieldsValue({
      name: '',
      inputFilePath: '',
      schedule: 'manual',
      scheduleConfig: createEmptyScheduleConfig(),
      analysisGoal: '',
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
    setEditorTaskId(selectedTask.id);
    setEditorWorkspaceDir(selectedTask.workspaceDir);
    setEditorUploadedFiles(selectedTask.uploadedFiles || []);
    setDraftResolveResult(null);
    setChatContextNotes([]);
    form.setFieldsValue({
      name: selectedTask.name,
      inputFilePath: selectedTask.inputFilePath,
      schedule: 'manual',
      scheduleConfig: createEmptyScheduleConfig(),
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

  const applyDraftResultToForm = (result: TaskDraftResolveResult) => {
    form.setFieldsValue({
      name: result.name,
      inputFilePath: form.getFieldValue('inputFilePath'),
      schedule: 'manual',
      scheduleConfig: createEmptyScheduleConfig(),
      analysisGoal: result.analysisGoal,
      status: form.getFieldValue('status') || 'active',
      outputFormat: form.getFieldValue('outputFormat') || 'markdown',
    });
    setDraftResolveResult(result);
  };

  const handleUploadButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    if (!/\.(csv|xlsx)$/i.test(file.name)) {
      message.error('当前仅支持上传 CSV 或 XLSX 文件');
      return;
    }

    try {
      setIsUploadingFile(true);
      const result = await tasksAPI.uploadFile(editorTaskId, file);
      if (!result.success || !result.data) {
        throw new Error(result.errorMessage || '文件上传失败');
      }
      const uploadData = result.data;

      setEditorWorkspaceDir(uploadData.workspaceDir);
      setEditorUploadedFiles(prev => {
        const nextFiles = prev.filter(item => item.path !== uploadData.file.path);
        nextFiles.unshift(uploadData.file);
        return nextFiles;
      });
      form.setFieldValue('inputFilePath', uploadData.inputFilePath);
      const note = `已上传 ${file.name}，并设为当前输入文件。`;
      setChatContextNotes(prev => [...prev, note].slice(-8));
      setModalChatMessages(prev => [
        ...prev,
        {
          id: `assistant-upload-${Date.now()}`,
          role: 'assistant',
          content: `${note}继续描述任务目标、执行频率或时间即可。`,
          kind: 'text',
        },
      ]);
      message.success(`已上传 ${file.name}`);
    } catch (error) {
      message.error((error as Error).message || '文件上传失败');
    } finally {
      setIsUploadingFile(false);
    }
  };

  const handleUseUploadedFile = (file: TaskFile) => {
    form.setFieldValue('inputFilePath', file.path);
    const note = `已切换到文件 ${file.name}。`;
    setChatContextNotes(prev => [...prev, note].slice(-8));
    setModalChatMessages(prev => [
      ...prev,
      {
        id: `assistant-file-${Date.now()}`,
        role: 'assistant',
        content: note,
        kind: 'text',
      },
    ]);
  };

  const handleRemoveUploadedFile = (filePath: string) => {
    setEditorUploadedFiles(prev => {
      const nextFiles = prev.filter(item => item.path !== filePath);
      if (form.getFieldValue('inputFilePath') === filePath) {
        form.setFieldValue('inputFilePath', nextFiles[0]?.path || '');
      }
      return nextFiles;
    });
  };

  const handleSubmitTask = async () => {
    try {
      setIsSavingTask(true);
      const values = await form.validateFields();
      // 保存任务时再次触发解析：只传 sessionId，消息正文由后端从存储中读取。
      // 用于把“聊天中的任务描述”抽象为稳定的 `analysisGoal` 文本。
      setIsDraftPreviewLoading(true);
      const draftResolution = await tasksAPI.resolveDraft({ sessionId: chatSessionId });
      setIsDraftPreviewLoading(false);
      const finalAnalysisGoal =
        draftResolution.success && draftResolution.data?.analysisGoal
          ? draftResolution.data.analysisGoal
          : values.analysisGoal;

      const payload: Partial<Task> = {
        name: values.name,
        inputFilePath: values.inputFilePath,
        schedule: 'manual',
        scheduleConfig: {},
        scheduleTime: buildScheduleTime('manual'),
        analysisGoal: finalAnalysisGoal,
        status: values.status || 'active',
        outputFormat: values.outputFormat || 'markdown',
        uploadedFiles: editorUploadedFiles,
        workspaceDir: editingTask ? editorWorkspaceDir || editingTask.workspaceDir : editorWorkspaceDir || undefined,
      };

      if (editingTask) {
        const result = await tasksAPI.update(editingTask.id, payload);
        if (!result.success) {
          throw new Error(result.errorMessage || '任务更新失败');
        }
        message.success('任务已更新');
        setSelectedTaskId(editingTask.id);
      } else {
        payload.id = editorTaskId;
        const result = await tasksAPI.create(payload);
        if (!result.success || !result.data) {
          throw new Error(result.errorMessage || '任务创建失败');
        }
        message.success('任务已创建');
        setSelectedTaskId(result.data.id);
      }

      closeTaskModal();
      await Promise.all([fetchTasks(), fetchRuns(), fetchReports()]);
    } catch (error) {
      message.error((error as Error).message || '请先补全任务配置');
    } finally {
      setIsSavingTask(false);
      setIsDraftPreviewLoading(false);
    }
  };

  const handleRunTask = async () => {
    if (!selectedTask) {
      return;
    }

    try {
      setIsRunningTask(true);
      const result = await tasksAPI.run(selectedTask.id);
      if (!result.success) {
        throw new Error(result.errorMessage || '执行失败');
      }
      message.success('任务已触发执行');
      await Promise.all([fetchTasks(), fetchRuns(), fetchReports()]);
    } catch (error) {
      message.error((error as Error).message || '执行失败');
    } finally {
      setIsRunningTask(false);
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

  const resolveDraftFromSession = async (sessionId: string) => {
    setIsDraftPreviewLoading(true);
    try {
      const result = await tasksAPI.resolveDraft({ sessionId });

      if (!result.success || !result.data) {
        throw new Error(result.errorMessage || '任务草稿解析失败');
      }

      applyDraftResultToForm(result.data);
      return result.data;
    } finally {
      setIsDraftPreviewLoading(false);
    }
  };

  const streamChatReply = async (statusMessageId: string, content: string) => {
    setAssistantContent(statusMessageId, '正在连接对话...', 'status', '处理中');
    const currentInputFilePath = String(form.getFieldValue('inputFilePath') || '').trim();
    const currentAbsoluteFilePath = joinWorkspaceFilePath(editorWorkspaceDir, currentInputFilePath);
    const response = await fetch(`${getApiBase()}/web/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': chatApiKey,
      },
      body: JSON.stringify({
        sessionId: chatSessionId,
        messages: [{ role: 'user', content }],
        useTools: true,
        workspaceDir: editorWorkspaceDir || undefined,
        context: {
          actualWorkspaceDir: editorWorkspaceDir || undefined,
          inputFilePath: currentInputFilePath || undefined,
          absoluteFilePath: currentAbsoluteFilePath || undefined,
          notes: chatContextNotes.length > 0 ? chatContextNotes : undefined,
        },
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`聊天服务不可用 (${response.status})`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let accumulatedText = '';
    let accumulatedReasoning = '';

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

        let event: { type: string } & Record<string, any>;
        try {
          event = JSON.parse(payload) as { type: string } & Record<string, any>;
        } catch {
          continue;
        }

        if (event.type === 'start') {
          setAssistantContent(statusMessageId, '正在处理...', 'status', '处理中');
          continue;
        }

        if (event.type === 'reasoning-start') {
          accumulatedReasoning = '';
          // 只保留一个 assistant 气泡：后续阶段会覆盖本条消息内容。
          setAssistantContent(statusMessageId, '开始推理...', 'reasoning', '推理中');
          continue;
        }

        if (event.type === 'reasoning-delta') {
          const delta = String(event.text || '');
          if (!delta) {
            continue;
          }
          accumulatedReasoning += delta;
          // 推理过程仅作为临时展示，进入 text 阶段后会被覆盖。
          setAssistantContent(statusMessageId, accumulatedReasoning, 'reasoning', '推理中');
          continue;
        }

        if (event.type === 'tool-call') {
          const toolCallId = String(event.toolCallId || '');
          const toolName = String(event.toolName || 'tool');
          const toolInput = event.input ?? {};
          const prettyInput = (() => {
            try {
              return JSON.stringify(toolInput, null, 2);
            } catch {
              return String(toolInput);
            }
          })();
          setAssistantContent(
            statusMessageId,
            `调用：${toolName}\n输入：\n${prettyInput}`,
            'tool',
            toolCallId ? '工具调用' : '工具',
          );
          continue;
        }

        if (event.type === 'tool-result') {
          const toolCallId = String(event.toolCallId || '');
          const toolName = String(event.toolName || 'tool');
          const output = event.output ?? event.result ?? '';
          const prettyOutput = (() => {
            try {
              return typeof output === 'string' ? output : JSON.stringify(output, null, 2);
            } catch {
              return String(output);
            }
          })();
          setAssistantContent(
            statusMessageId,
            `调用：${toolName}\n结果：\n${prettyOutput}`,
            'tool',
            toolCallId ? '工具结果' : '工具',
          );
          continue;
        }

        if (event.type === 'text-start') {
          // 进入最终文本阶段：后续只渲染 markdown 拼接结果。
          accumulatedText = '';
          setAssistantContent(statusMessageId, '', 'text', '回复');
          continue;
        }

        if (event.type === 'text-delta') {
          const delta = String(event.text || '');
          if (!delta) {
            continue;
          }
          accumulatedText += delta;
          // 最终只保留这条 markdown（同一个 messageId 持续覆盖）。
          setAssistantContent(statusMessageId, normalizeAssistantMarkdown(accumulatedText), 'text', '回复');
          continue;
        }

        if (event.type === 'finish' && event.finishReason === 'stop') {
          // finish 仅表示请求结束；如果已经进入 text 阶段，保留 markdown 不再覆盖。
          if (!accumulatedText.trim()) {
            setAssistantContent(statusMessageId, '对话完成', 'status', '完成');
          }
          continue;
        }
      }
    }

    return normalizeAssistantMarkdown(accumulatedText).trim();
  };

  const submitPrompt = async (prompt: string) => {
    const content = prompt.trim();
    if (!content) {
      return;
    }

    const userMessageId = `user-${Date.now()}`;
    const assistantStatusId = `assistant-status-${Date.now()}`;
    setModalChatMessages(prev => [
      ...prev,
      { id: userMessageId, role: 'user', content },
      {
        id: assistantStatusId,
        role: 'assistant',
        content: '正在解析任务草稿...',
        kind: 'status',
        stageLabel: '处理中',
      },
    ]);
    setModalChatInput('');
    try {
      setIsResolvingDraft(true);
      setAssistantContent(assistantStatusId, '正在发起对话...', 'status', '处理中');

      let streamError: Error | null = null;
      let streamedText = '';
      try {
        streamedText = await streamChatReply(assistantStatusId, content);
      } catch (error) {
        streamError = error as Error;
      }

      // 约定：聊天完成后再触发 resolve；resolve 只传 sessionId，消息从后端存储读取。
      const draftResult = await resolveDraftFromSession(chatSessionId);

      if (streamError) {
        setAssistantContent(
          assistantStatusId,
          `${buildDraftAssistantReply(draftResult)}\n\n聊天服务当前不可用，已先更新右侧任务草稿。`,
          'text',
          '回复',
        );
        return;
      }

      // chat 流式文本已在 `streamChatReply` 内部作为 assistant-text bubble 渲染；
      // 这里仅在没有产生任何文本时，用解析结果做兜底输出。
      if (!streamedText) {
        setAssistantContent(assistantStatusId, buildDraftAssistantReply(draftResult), 'text', '回复');
      }
    } catch (error) {
      setAssistantContent(
        assistantStatusId,
        (error as Error).message || '任务草稿解析失败，请继续补充信息。',
        'text',
        '回复',
      );
    } finally {
      setIsResolvingDraft(false);
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

          {connectionIssue ? (
            <Card className="task-alert-inline-card">
              <strong>后端未连接</strong>
              <p>{connectionIssue}</p>
              <span>
                {isDesktopRuntime
                  ? '桌面版会自动启动内置后端，请重启应用并确认使用的是最新打包版本。'
                  : '需要先启动根目录服务：`npm run dev`'}
              </span>
            </Card>
          ) : null}

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
                  <Button
                    type="primary"
                    className="run-task-button"
                    icon={<RocketOutlined />}
                    onClick={handleRunTask}
                    loading={isRunningTask}
                    disabled={isRunningTask}
                  >
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
          <Button key="cancel" onClick={closeTaskModal} disabled={isSavingTask}>
            取消
          </Button>,
          <Button key="submit" type="primary" onClick={handleSubmitTask} loading={isSavingTask}>
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
                <button key={prompt} type="button" onClick={() => submitPrompt(prompt)} disabled={isResolvingDraft}>
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

            {editorUploadedFiles.length > 0 ? (
              <div className="editor-upload-strip">
                <span className="editor-upload-label">当前文件</span>
                <div className="uploaded-file-list compact">
                  {editorUploadedFiles.map(file => (
                    <div
                      key={file.path}
                      className={`uploaded-file-item compact ${draftValues.inputFilePath === file.path ? 'active' : ''}`}
                    >
                      <div className="uploaded-file-item-main">
                        <strong>{file.name}</strong>
                        <span>{file.path}</span>
                      </div>
                      <div className="uploaded-file-item-actions">
                        {draftValues.inputFilePath !== file.path ? (
                          <Button size="small" onClick={() => handleUseUploadedFile(file)}>
                            使用
                          </Button>
                        ) : (
                          <Tag color="success">当前输入</Tag>
                        )}
                        <Button size="small" type="text" onClick={() => handleRemoveUploadedFile(file.path)}>
                          移除
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="editor-upload-empty">
                <span>点击左下角上传按钮，先放入一个 CSV / XLSX 文件。</span>
              </div>
            )}

            <div className="editor-input-row">
              <Button
                icon={<UploadOutlined />}
                onClick={handleUploadButtonClick}
                loading={isUploadingFile}
                className="editor-icon-button"
              />
              <Input
                value={modalChatInput}
                onChange={event => setModalChatInput(event.target.value)}
                onPressEnter={() => submitPrompt(modalChatInput)}
                placeholder="描述任务文件、执行频率和想要的结果"
                disabled={isResolvingDraft}
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={() => submitPrompt(modalChatInput)}
                loading={isResolvingDraft}
              />
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

            <div className="editor-form-body">
              {isDraftPreviewLoading ? (
                <div className="draft-preview-loading" role="status" aria-live="polite">
                  <Spin size="small" />
                  <span>正在更新预览...</span>
                </div>
              ) : null}

              <Form form={form} layout="vertical" className="task-form">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx"
                hidden
                aria-hidden="true"
                tabIndex={-1}
                className="hidden-file-input"
                onChange={handleFileSelect}
              />

              <Form.Item
                name="name"
                label="任务名称"
                rules={[{ required: true, message: '请输入任务名称' }]}
              >
                <Input placeholder="AI 会先自动生成，你也可以手动修改" />
              </Form.Item>

              <Form.Item
                name="inputFilePath"
                hidden
                rules={[
                  { required: true, message: '请输入 CSV / XLSX 文件路径' },
                  {
                    pattern: /\.(csv|xlsx)$/i,
                    message: '首版仅支持 CSV / XLSX 文件',
                  },
                ]}
              >
                <Input />
              </Form.Item>

              <div className="upload-selected-card">
                <div className="upload-selected-header">
                  <UploadOutlined />
                  <span className="summary-label">文件上传</span>
                </div>
                <strong>{draftValues.inputFilePath || '请在左侧输入区点击上传图标，添加 CSV / XLSX 文件'}</strong>
                <p>文件会被保存到当前任务工作目录，后续 agent 运行也会使用同一个工作空间。</p>
                {editorWorkspaceDir ? <p className="upload-workspace-hint">工作目录：{editorWorkspaceDir}</p> : null}
              </div>

              <div className="draft-summary-card">
                <div className="draft-summary-header">
                  <FileTextOutlined />
                  <span className="summary-label">解析摘要</span>
                </div>
                {draftResolveResult?.summary?.length ? (
                  <ul className="draft-summary-list">
                    {draftResolveResult.summary.map((item, index) => (
                      <li key={`${item}-${index}`}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="draft-summary-empty">发送一条任务描述后，这里会展示 AI 从对话中提取出的关键信息。</p>
                )}

                {draftResolveResult?.missing?.length ? (
                  <div className="draft-summary-tags">
                    <span>缺失：</span>
                    {draftResolveResult.missing.map((item, index) => (
                      <Tag key={`${item}-${index}`} color="warning">
                        {item}
                      </Tag>
                    ))}
                  </div>
                ) : null}

                {draftResolveResult?.warnings?.length ? (
                  <div className="draft-summary-tags">
                    <span>提醒：</span>
                    {draftResolveResult.warnings.map((item, index) => (
                      <Tag key={`${item}-${index}`} color="gold">
                        {item}
                      </Tag>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="schedule-row">
                <Form.Item
                  name="schedule"
                  label="执行方式"
                  rules={[{ required: true, message: '请选择执行方式' }]}
                  className="schedule-row-main"
                >
                  <Select
                    options={[
                      { value: 'manual', label: '手动执行' },
                    ]}
                  />
                </Form.Item>

                <div className="schedule-row-config">
                  <div className="schedule-row-empty" />
                </div>
              </div>

              <Form.Item
                name="analysisGoal"
                label="任务目标"
                rules={[{ required: true, message: '请描述希望输出的分析结果' }]}
              >
                <Input.TextArea
                  rows={4}
                  placeholder="保存时会自动整理成可执行的分析目标文本"
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
                  <Select
                    options={[
                      { value: 'markdown', label: 'Markdown' },
                      { value: 'file', label: '文件' },
                    ]}
                  />
                </Form.Item>
              </div>
              </Form>
            </div>
          </section>
        </div>
      </Modal>
    </>
  );
}
