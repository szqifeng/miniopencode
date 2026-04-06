export interface Tool {
  id: string;
  name: string;
  type: 'script' | 'api' | 'shell';
  description: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  name: string;
  toolId: string;
  toolName: string;
  status: 'enabled' | 'disabled';
  schedule: {
    enabled: boolean;
    type: 'daily' | 'weekly';
    time: string;
    weekday?: number;
  };
  lastRunTime: string;
  nextRunTime: string;
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

export interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  category?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Response<T = any> {
  success: boolean;
  data?: T;
  errorMessage?: string;
  total?: number;
}