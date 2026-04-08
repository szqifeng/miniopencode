/**
 * Session 模块 - 会话上下文管理
 * 
 * 职责：管理多轮对话的会话上下文
 */

import { Message, Part, MessageRole, LLMMessage, Session, ToolCallPart, TodoItem } from './types.js';
import { getStorage } from '../services/storageFactory.js';
import { getDataSubdir } from '../utils/paths.js';

let sessionStorage: {
  save: (session: Session) => Promise<Session>;
  get: (id: string) => Promise<Session | null>;
  delete: (id: string) => Promise<boolean>;
} | null = null;

async function getSessionStorage() {
  if (sessionStorage) return sessionStorage;

  const fs = await import('fs/promises');
  const path = await import('path');
  const DATA_DIR = getDataSubdir('sessions');

  console.log('session.ts DATA_DIR:', DATA_DIR);

  async function ensureDir() {
    try {
      await fs.access(DATA_DIR);
    } catch {
      await fs.mkdir(DATA_DIR, { recursive: true });
    }
  }

  sessionStorage = {
    async save(session: Session) {
      await ensureDir();
      const filePath = path.join(DATA_DIR, `${session.id}.json`);
      await fs.writeFile(filePath, JSON.stringify(session), 'utf-8');
      return session;
    },

    async get(id: string) {
      const filePath = path.join(DATA_DIR, `${id}.json`);
      try {
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data) as Session;
      } catch {
        return null;
      }
    },

    async delete(id: string) {
      const filePath = path.join(DATA_DIR, `${id}.json`);
      try {
        await fs.unlink(filePath);
        return true;
      } catch {
        return false;
      }
    }
  };

  return sessionStorage;
}

function generateMsgId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createTextPart(id: string, content: string): Part {
  return { type: 'text', id, content };
}

export function createToolCallPart(tool: string, args: Record<string, unknown>): Part {
  return { type: 'tool-call', tool, args };
}

export function createToolResultPart(tool: string, result: unknown): Part {
  return { type: 'tool-result', tool, result };
}

export function createMessage(role: MessageRole, parts: Part[] = []): Message {
  return {
    role,
    id: generateMsgId(),
    parts,
    createdAt: Date.now()
  };
}

export async function getSession(sessionId: string): Promise<Session> {
  const storage = await getSessionStorage();
  let session = await storage.get(sessionId);

  if (!session) {
    session = {
      id: sessionId,
      messages: [],
      todos: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    await storage.save(session);
  }

  // 兼容旧版本 Session 数据（没有 todos 字段）
  if (!session.todos) {
    session.todos = [];
  }

  return session;
}

export async function addMessage(sessionId: string, message: Message, session?: Session): Promise<Session> {
  const storage = await getSessionStorage();
  const s = session || await getSession(sessionId);

  s.messages.push(message);
  s.updatedAt = Date.now();

  await storage.save(s);
  return s;
}

export async function getMessages(sessionId: string, session?: Session): Promise<Message[]> {
  const s = session || await getSession(sessionId);
  return s.messages;
}

export function messageToLLMFormat(message: Message): LLMMessage {
  const parts = message.parts || [];
  const hasToolCalls = parts.some(p => p.type === 'tool-call');

  if (hasToolCalls) {
    return {
      role: message.role,
      content: parts.filter(p => p.type === 'text').map(p => (p as { type: 'text'; content: string }).content).join(''),
      tool_calls: parts
        .filter(p => p.type === 'tool-call')
        .map((p) => {
          const toolPart = p as ToolCallPart;
          return {
            id: `call_${Date.now()}`,
            type: 'function' as const,
            function: {
              name: toolPart.tool,
              arguments: JSON.stringify(toolPart.args)
            }
          };
        })
    };
  }

  return {
    role: message.role,
    content: parts.filter(p => p.type === 'text').map(p => (p as { type: 'text'; content: string }).content).join('')
  };
}

export function messagesToLLMFormat(messages: Message[]): LLMMessage[] {
  return messages.map(messageToLLMFormat);
}

export async function clearSession(sessionId: string): Promise<boolean> {
  const storage = await getSessionStorage();
  return await storage.delete(sessionId);
}

export async function updateSessionTitle(sessionId: string, title: string): Promise<void> {
  const storage = await getSessionStorage();
  const session = await storage.get(sessionId);
  if (session) {
    session.title = title;
    await storage.save(session);
  }
}
