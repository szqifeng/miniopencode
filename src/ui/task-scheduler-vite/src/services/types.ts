export interface TaskScheduleConfig {
  minute?: number;
  time?: string;
  weekday?: number;
}

export interface TaskFile {
  name: string;
  path: string;
  size: number;
  uploadedAt: string;
}

export interface Task {
  id: string;
  name: string;
  editorSessionId?: string;
  inputFilePath: string;
  workspaceDir: string;
  uploadedFiles: TaskFile[];
  schedule: 'manual' | 'hourly' | 'daily' | 'weekly';
  scheduleConfig?: TaskScheduleConfig;
  scheduleTime?: string;
  status: 'active' | 'paused' | 'error';
  analysisGoal?: string;
  outputFormat: 'markdown' | 'file';
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Run {
  id: string;
  taskId: string;
  status: 'running' | 'success' | 'failed';
  reportId?: string;
  startedAt: string;
  finishedAt?: string;
  errorMessage?: string;
}

export interface Report {
  id: string;
  taskId: string;
  runId: string;
  contentMarkdown: string;
  createdAt: string;
}

export interface Tool {
  id: string;
  name: string;
  type: 'script' | 'api' | 'shell';
  description: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  category?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface ChatSettings {
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface AgentSessionPart {
  type: string;
  id?: string;
  content?: string;
  tool?: string;
  result?: unknown;
  args?: Record<string, unknown>;
}

export interface AgentSessionMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts: AgentSessionPart[];
  createdAt: number;
}

export interface AgentSessionDetail {
  sessionId: string;
  title: string;
  messages: AgentSessionMessage[];
  createdAt: number;
  updatedAt: number;
}

export type ChatStreamMessageRole = 'user' | 'assistant';

export interface ChatStreamMessage {
  role: ChatStreamMessageRole;
  content: string;
}

export interface ChatStreamRequest {
  sessionId: string;
  messages: ChatStreamMessage[];
  useTools: boolean;
  workspaceDir?: string;
}

export interface TaskDraftResolveRequest {
  sessionId: string;
}

export interface TaskDraftResolveResult {
  name: string;
  analysisGoal: string;
  schedule: Task['schedule'] | '';
  scheduleConfig: {
    minute: number | null;
    time: string;
    weekday: number | null;
  };
  scheduleTime: string;
  summary: string[];
  missing: string[];
  warnings: string[];
}

export interface TaskFileUploadResult {
  taskId: string;
  workspaceDir: string;
  inputFilePath: string;
  file: TaskFile;
}

export interface ChatStreamStartEvent {
  type: 'start';
}

export interface ChatStreamStartStepEvent {
  type: 'start-step';
  request: {
    body: Record<string, unknown>;
    warnings?: unknown[];
  };
}

export interface ChatStreamReasoningStartEvent {
  type: 'reasoning-start';
  id: string;
}

export interface ChatStreamReasoningDeltaEvent {
  type: 'reasoning-delta';
  id: string;
  text: string;
  providerMetadata?: Record<string, unknown>;
}

export interface ChatStreamReasoningEndEvent {
  type: 'reasoning-end';
  id: string;
}

export interface ChatStreamTextStartEvent {
  type: 'text-start';
  id: string;
}

export interface ChatStreamTextDeltaEvent {
  type: 'text-delta';
  id: string;
  text: string;
}

export interface ChatStreamTextEndEvent {
  type: 'text-end';
  id: string;
}

export interface ChatStreamToolInputStartEvent {
  type: 'tool-input-start';
  id: string;
  toolName: string;
  dynamic?: boolean;
}

export interface ChatStreamToolInputDeltaEvent {
  type: 'tool-input-delta';
  id: string;
  delta: string;
}

export interface ChatStreamToolInputEndEvent {
  type: 'tool-input-end';
  id: string;
}

export interface ChatStreamToolCallEvent {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  input: Record<string, unknown>;
}

export interface ChatStreamToolResultEvent {
  type: 'tool-result';
  toolCallId: string;
  toolName: string;
  input: Record<string, unknown>;
  output: unknown;
  dynamic?: boolean;
}

export interface ChatStreamFinishStepEvent {
  type: 'finish-step';
  finishReason: 'tool-calls' | 'stop' | string;
  rawFinishReason?: string;
  usage?: Record<string, unknown>;
  totalUsage?: Record<string, unknown>;
  response?: Record<string, unknown>;
  providerMetadata?: Record<string, unknown>;
}

export interface ChatStreamFinishEvent {
  type: 'finish';
  finishReason: 'tool-calls' | 'stop' | string;
  rawFinishReason?: string;
  usage?: Record<string, unknown>;
  totalUsage?: Record<string, unknown>;
}

export type ChatStreamEvent =
  | ChatStreamStartEvent
  | ChatStreamStartStepEvent
  | ChatStreamReasoningStartEvent
  | ChatStreamReasoningDeltaEvent
  | ChatStreamReasoningEndEvent
  | ChatStreamTextStartEvent
  | ChatStreamTextDeltaEvent
  | ChatStreamTextEndEvent
  | ChatStreamToolInputStartEvent
  | ChatStreamToolInputDeltaEvent
  | ChatStreamToolInputEndEvent
  | ChatStreamToolCallEvent
  | ChatStreamToolResultEvent
  | ChatStreamFinishStepEvent
  | ChatStreamFinishEvent;

export interface Response<T = any> {
  success: boolean;
  data?: T;
  errorMessage?: string;
  total?: number;
}
