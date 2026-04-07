import type {
  ChatMessage,
  ChatSettings,
  KnowledgeItem,
  Report,
  Response,
  Run,
  Task,
  Tool,
} from './types';

const API_BASE = '/api';

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<Response<T>> {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });
  return (await response.json()) as Response<T>;
}

export const toolsAPI = {
  getList: () => fetchJSON<Tool[]>('/tools'),
  getById: (id: string) => fetchJSON<Tool>(`/tools/${id}`),
  create: (data: Partial<Tool>) => 
    fetchJSON<Tool>('/tools', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Tool>) => 
    fetchJSON<Tool>(`/tools/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => 
    fetchJSON<void>(`/tools/${id}`, { method: 'DELETE' }),
};

export const tasksAPI = {
  getList: () => fetchJSON<Task[]>('/tasks'),
  getById: (id: string) => fetchJSON<Task>(`/tasks/${id}`),
  create: (data: Partial<Task>) => 
    fetchJSON<Task>('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Task>) => 
    fetchJSON<Task>(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => 
    fetchJSON<void>(`/tasks/${id}`, { method: 'DELETE' }),
  run: (id: string) => fetchJSON<Run>(`/tasks/${id}/run`, { method: 'POST' }),
  enable: (id: string) => fetchJSON<Task>(`/tasks/${id}/enable`, { method: 'POST' }),
  disable: (id: string) => fetchJSON<Task>(`/tasks/${id}/disable`, { method: 'POST' }),
  getRuns: (taskId: string) => fetchJSON<Run[]>(`/tasks/${taskId}/runs`),
  getReports: (taskId: string) => fetchJSON<Report[]>(`/tasks/${taskId}/reports`),
};

export const runsAPI = {
  getList: () => fetchJSON<Run[]>('/runs'),
  getById: (id: string) => fetchJSON<Run>(`/runs/${id}`),
};

export const reportsAPI = {
  getList: () => fetchJSON<Report[]>('/reports'),
  getById: (id: string) => fetchJSON<Report>(`/reports/${id}`),
};

export const knowledgeAPI = {
  getList: () => fetchJSON<KnowledgeItem[]>('/knowledge'),
  getById: (id: string) => fetchJSON<KnowledgeItem>(`/knowledge/${id}`),
  create: (data: Partial<KnowledgeItem>) =>
    fetchJSON<KnowledgeItem>('/knowledge', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<KnowledgeItem>) =>
    fetchJSON<KnowledgeItem>(`/knowledge/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    fetchJSON<void>(`/knowledge/${id}`, { method: 'DELETE' }),
};

export const chatAPI = {
  send: (message: string) => 
    fetchJSON<{ reply: string }>('/chat', { method: 'POST', body: JSON.stringify({ message }) }),
  getHistory: (limit = 20) => fetchJSON<ChatMessage[]>(`/chat/history?limit=${limit}`),
  getSettings: () => fetchJSON<ChatSettings>('/chat/settings'),
  updateSettings: (settings: ChatSettings) => 
    fetchJSON<ChatSettings>('/chat/settings', { method: 'PUT', body: JSON.stringify(settings) }),
};
