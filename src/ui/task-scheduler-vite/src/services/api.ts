import type { Tool, Task, ChatMessage, ChatSettings, Response } from './types';

const API_BASE = '/api';

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<Response<T>> {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });
  return response.json();
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
  run: (id: string) => fetchJSON<void>(`/tasks/${id}/run`, { method: 'POST' }),
  enable: (id: string) => fetchJSON<void>(`/tasks/${id}/enable`, { method: 'POST' }),
  disable: (id: string) => fetchJSON<void>(`/tasks/${id}/disable`, { method: 'POST' }),
};

export const chatAPI = {
  send: (message: string) => 
    fetchJSON<{ reply: string }>('/chat', { method: 'POST', body: JSON.stringify({ message }) }),
  getHistory: (limit = 20) => fetchJSON<ChatMessage[]>(`/chat/history?limit=${limit}`),
  getSettings: () => fetchJSON<ChatSettings>('/chat/settings'),
  updateSettings: (settings: ChatSettings) => 
    fetchJSON<ChatSettings>('/chat/settings', { method: 'PUT', body: JSON.stringify(settings) }),
};