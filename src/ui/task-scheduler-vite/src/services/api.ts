import type {
  ChatMessage,
  ChatSettings,
  AgentSessionDetail,
  KnowledgeItem,
  Report,
  Response,
  Run,
  Task,
  TaskDraftResolveRequest,
  TaskDraftResolveResult,
  TaskFileUploadResult,
  Tool,
} from './types';

export function getApiBase() {
  const desktopApiBase = window.__MINIOPENCODE_DESKTOP__?.apiBase;
  if (desktopApiBase) {
    return desktopApiBase;
  }

  const urlApiBase = new URLSearchParams(window.location.search).get('miniopencodeApiBase');
  return urlApiBase || '/api';
}

const API_BASE = getApiBase();

async function parseApiResponse<T>(response: globalThis.Response): Promise<Response<T>> {
  const raw = await response.text();
  const contentType = response.headers.get('content-type') || '';

  if (!raw.trim()) {
    if (response.ok) {
      return { success: true } as Response<T>;
    }

    return {
      success: false,
      errorMessage: `请求失败 (${response.status})，后端可能未启动或代理不可用`,
    };
  }

  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(raw) as Response<T>;
    } catch {
      return {
        success: false,
        errorMessage: `接口返回了无效 JSON (${response.status})`,
      };
    }
  }

  if (!response.ok) {
    return {
      success: false,
      errorMessage: raw.trim() || `请求失败 (${response.status})`,
    };
  }

  return {
    success: false,
    errorMessage: '接口返回了非 JSON 响应',
  };
}

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<Response<T>> {
  try {
    const response = await fetch(`${API_BASE}${url}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      ...options,
    });
    return parseApiResponse<T>(response);
  } catch (error) {
    return {
      success: false,
      errorMessage: (error as Error).message || '网络请求失败',
    };
  }
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
  resolveDraft: (data: TaskDraftResolveRequest) =>
    fetchJSON<TaskDraftResolveResult>('/tasks/draft/resolve', { method: 'POST', body: JSON.stringify(data) }),
  uploadFile: async (taskId: string, file: File): Promise<Response<TaskFileUploadResult>> => {
    try {
      const response = await fetch(`${API_BASE}/tasks/${taskId}/files`, {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'X-File-Name': encodeURIComponent(file.name),
        },
        body: file,
      });
      return parseApiResponse<TaskFileUploadResult>(response);
    } catch (error) {
      return {
        success: false,
        errorMessage: (error as Error).message || '文件上传失败',
      };
    }
  }
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
  getSession: (sessionId: string) => fetchJSON<AgentSessionDetail>(`/chat/session/${sessionId}`),
  getSettings: () => fetchJSON<ChatSettings>('/chat/settings'),
  updateSettings: (settings: ChatSettings) => 
    fetchJSON<ChatSettings>('/chat/settings', { method: 'PUT', body: JSON.stringify(settings) }),
};
