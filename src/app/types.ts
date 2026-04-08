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
  inputFilePath: string;
  workspaceDir: string;
  uploadedFiles: TaskFile[];
  schedule: 'manual' | 'hourly' | 'daily' | 'weekly';
  scheduleConfig?: TaskScheduleConfig;
  scheduleTime?: string;
  status: 'active' | 'completed' | 'paused' | 'error';
  analysisGoal?: string;
  outputFormat: 'markdown';
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

export interface ToolRecord {
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

export interface AppState {
  tasks: Task[];
  runs: Run[];
  reports: Report[];
  tools: ToolRecord[];
  knowledge: KnowledgeItem[];
  chatHistory: ChatMessage[];
  chatSettings: ChatSettings;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  errorMessage?: string;
  total?: number;
}
