/**
 * Session 模块 - 会话上下文管理
 *
 * 职责：管理多轮对话的会话上下文
 */
import { getDataSubdir } from '../utils/paths.js';
let sessionStorage = null;
async function getSessionStorage() {
    if (sessionStorage)
        return sessionStorage;
    const fs = await import('fs/promises');
    const path = await import('path');
    const DATA_DIR = getDataSubdir('sessions');
    console.log('session.ts DATA_DIR:', DATA_DIR);
    async function ensureDir() {
        try {
            await fs.access(DATA_DIR);
        }
        catch {
            await fs.mkdir(DATA_DIR, { recursive: true });
        }
    }
    sessionStorage = {
        async save(session) {
            await ensureDir();
            const filePath = path.join(DATA_DIR, `${session.id}.json`);
            await fs.writeFile(filePath, JSON.stringify(session), 'utf-8');
            return session;
        },
        async get(id) {
            const filePath = path.join(DATA_DIR, `${id}.json`);
            try {
                const data = await fs.readFile(filePath, 'utf-8');
                return JSON.parse(data);
            }
            catch {
                return null;
            }
        },
        async delete(id) {
            const filePath = path.join(DATA_DIR, `${id}.json`);
            try {
                await fs.unlink(filePath);
                return true;
            }
            catch {
                return false;
            }
        }
    };
    return sessionStorage;
}
function generateMsgId() {
    return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
export function createTextPart(id, content) {
    return { type: 'text', id, content };
}
export function createToolCallPart(tool, args) {
    return { type: 'tool-call', tool, args };
}
export function createToolResultPart(tool, result) {
    return { type: 'tool-result', tool, result };
}
export function createMessage(role, parts = []) {
    return {
        role,
        id: generateMsgId(),
        parts,
        createdAt: Date.now()
    };
}
export async function getSession(sessionId) {
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
export async function addMessage(sessionId, message, session) {
    const storage = await getSessionStorage();
    const s = session || await getSession(sessionId);
    s.messages.push(message);
    s.updatedAt = Date.now();
    await storage.save(s);
    return s;
}
export async function getMessages(sessionId, session) {
    const s = session || await getSession(sessionId);
    return s.messages;
}
export function messageToLLMFormat(message) {
    const parts = message.parts || [];
    const hasToolCalls = parts.some(p => p.type === 'tool-call');
    if (hasToolCalls) {
        return {
            role: message.role,
            content: parts.filter(p => p.type === 'text').map(p => p.content).join(''),
            tool_calls: parts
                .filter(p => p.type === 'tool-call')
                .map((p) => {
                const toolPart = p;
                return {
                    id: `call_${Date.now()}`,
                    type: 'function',
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
        content: parts.filter(p => p.type === 'text').map(p => p.content).join('')
    };
}
export function messagesToLLMFormat(messages) {
    return messages.map(messageToLLMFormat);
}
export async function clearSession(sessionId) {
    const storage = await getSessionStorage();
    return await storage.delete(sessionId);
}
export async function updateSessionTitle(sessionId, title) {
    const storage = await getSessionStorage();
    const session = await storage.get(sessionId);
    if (session) {
        session.title = title;
        await storage.save(session);
    }
}
