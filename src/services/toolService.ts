/**
 * 工具服务 - 提供内置工具
 */

import { jsonSchema } from 'ai';
import type { ToolSet } from 'ai';
import fs from 'node:fs/promises';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import https from 'node:https';
import http from 'node:http';
import * as XLSX from 'xlsx';
import { getCurrentSessionId, getCurrentWorkspaceDir } from '../agent/process.js';
import { getDataSubdir } from '../utils/paths.js';

interface ToolResult {
  output: string;
  title: string;
  metadata: Record<string, unknown>;
}

export interface BuiltinToolCatalogEntry {
  id: string;
  name: string;
  type: 'script' | 'api' | 'shell';
  description: string;
}

function resolveToolPath(targetPath: string): string {
  if (path.isAbsolute(targetPath)) {
    return targetPath;
  }
  const workspaceDir = getCurrentWorkspaceDir();
  return path.resolve(workspaceDir || process.cwd(), targetPath);
}

function parseStructuredRows(rowsJson: string): Array<Record<string, unknown>> {
  const parsed = JSON.parse(rowsJson);
  if (!Array.isArray(parsed)) {
    throw new Error('rowsJson 必须是 JSON 数组');
  }

  return parsed.map((row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw new Error('rowsJson 内的每一项都必须是对象');
    }
    return row as Record<string, unknown>;
  });
}

function parseCsvLine(line: string, delimiter = ','): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      result.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
}

function parseCsvContent(content: string, delimiter = ','): Array<Record<string, string>> {
  const normalized = content.replace(/^\uFEFF/, '').trim();
  if (!normalized) {
    return [];
  }

  const lines = normalized.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvLine(lines[0], delimiter);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line, delimiter);
    return headers.reduce<Record<string, string>>((row, header, index) => {
      row[header] = values[index] ?? '';
      return row;
    }, {});
  });
}

function stringifyCsvValue(value: unknown, delimiter = ','): string {
  const normalized = value == null ? '' : String(value);
  if (normalized.includes('"')) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  if (normalized.includes(delimiter) || normalized.includes('\n')) {
    return `"${normalized}"`;
  }
  return normalized;
}

const readTool = {
  id: 'read',
  description: '读取文件内容',
  inputSchema: jsonSchema({
    type: 'object',
    properties: {
      path: { type: 'string', description: '文件路径' }
    },
    required: ['path']
  }),
  async execute({ path: targetPath }: { path: string }): Promise<ToolResult> {
    try {
      const resolvedPath = resolveToolPath(targetPath);
      const content = await fs.readFile(resolvedPath, 'utf-8');
      return { output: content, title: `文件: ${resolvedPath}`, metadata: { path: resolvedPath } };
    } catch (error) {
      return { output: `读取失败: ${(error as Error).message}`, title: '错误', metadata: { error: (error as Error).message } };
    }
  }
};

const writeTool = {
  id: 'write',
  description: '写入内容到文件',
  inputSchema: jsonSchema({
    type: 'object',
    properties: {
      path: { type: 'string', description: '文件路径' },
      content: { type: 'string', description: '文件内容' }
    },
    required: ['path', 'content']
  }),
  async execute({ path: targetPath, content }: { path: string; content: string }): Promise<ToolResult> {
    try {
      const resolvedPath = resolveToolPath(targetPath);
      await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
      await fs.writeFile(resolvedPath, content, 'utf-8');
      return {
        output: `已写入文件: ${resolvedPath}`,
        title: '写入成功',
        metadata: { path: resolvedPath, bytes: Buffer.byteLength(content, 'utf-8') }
      };
    } catch (error) {
      return { output: `写入失败: ${(error as Error).message}`, title: '错误', metadata: { error: (error as Error).message } };
    }
  }
};

const editTool = {
  id: 'edit',
  description: '编辑文件，通过替换字符串',
  inputSchema: jsonSchema({
    type: 'object',
    properties: {
      path: { type: 'string', description: '文件路径' },
      oldString: { type: 'string', description: '要替换的字符串' },
      newString: { type: 'string', description: '新字符串' }
    },
    required: ['path', 'oldString', 'newString']
  }),
  async execute({ path: targetPath, oldString, newString }: { path: string; oldString: string; newString: string }): Promise<ToolResult> {
    try {
      const resolvedPath = resolveToolPath(targetPath);
      const content = await fs.readFile(resolvedPath, 'utf-8');
      if (!content.includes(oldString)) {
        return { output: `未找到要替换的字符串`, title: '错误', metadata: { error: 'oldString not found in file' } };
      }
      const newContent = content.replace(oldString, newString);
      await fs.writeFile(resolvedPath, newContent, 'utf-8');
      return { output: `已编辑文件: ${resolvedPath}`, title: '编辑成功', metadata: { path: resolvedPath } };
    } catch (error) {
      return { output: `编辑失败: ${(error as Error).message}`, title: '错误', metadata: { error: (error as Error).message } };
    }
  }
};

const excelInspectTool = {
  id: 'excel_inspect',
  description: '读取 Excel 工作簿结构、列名和预览数据',
  inputSchema: jsonSchema({
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Excel 文件路径（.xlsx）' },
      sheet: { type: 'string', description: '可选：要读取的 sheet 名称' },
      maxRows: { type: 'number', description: '预览行数，默认 20' }
    },
    required: ['path']
  }),
  async execute({ path: targetPath, sheet, maxRows = 20 }: { path: string; sheet?: string; maxRows?: number }): Promise<ToolResult> {
    try {
      const resolvedPath = resolveToolPath(targetPath);
      const workbook = XLSX.read(await fs.readFile(resolvedPath), { type: 'buffer', cellDates: true });
      const selectedSheet = sheet || workbook.SheetNames[0];
      if (!selectedSheet || !workbook.Sheets[selectedSheet]) {
        return {
          output: `未找到 sheet: ${sheet || '(空)'}`,
          title: '错误',
          metadata: { path: resolvedPath, availableSheets: workbook.SheetNames }
        };
      }

      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[selectedSheet], {
        defval: '',
        raw: false
      });
      const previewRows = rows.slice(0, Math.max(1, Math.min(maxRows, 100)));
      const columns = previewRows.length > 0
        ? Array.from(new Set(previewRows.flatMap((row) => Object.keys(row))))
        : [];

      const output = [
        `path: ${resolvedPath}`,
        `sheets: ${workbook.SheetNames.join(', ')}`,
        `selectedSheet: ${selectedSheet}`,
        `rowCount: ${rows.length}`,
        `columns: ${columns.join(', ') || '(none)'}`,
        'preview:',
        JSON.stringify(previewRows, null, 2)
      ].join('\n');

      return {
        output,
        title: `Excel 预览: ${path.basename(resolvedPath)}`,
        metadata: {
          path: resolvedPath,
          sheets: workbook.SheetNames,
          selectedSheet,
          rowCount: rows.length,
          columns
        }
      };
    } catch (error) {
      return { output: `读取 Excel 失败: ${(error as Error).message}`, title: '错误', metadata: { error: (error as Error).message } };
    }
  }
};

const excelWriteTool = {
  id: 'excel_write',
  description: '将 JSON 数组写入 Excel 文件中的指定 sheet',
  inputSchema: jsonSchema({
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Excel 文件路径（.xlsx）' },
      sheet: { type: 'string', description: 'sheet 名称' },
      rowsJson: { type: 'string', description: 'JSON 数组字符串，例如 [{\"name\":\"A\",\"value\":1}]' },
      mode: { type: 'string', description: 'replace 或 append，默认 replace' }
    },
    required: ['path', 'sheet', 'rowsJson']
  }),
  async execute({ path: targetPath, sheet, rowsJson, mode = 'replace' }: { path: string; sheet: string; rowsJson: string; mode?: 'replace' | 'append' }): Promise<ToolResult> {
    try {
      const resolvedPath = resolveToolPath(targetPath);
      await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
      const incomingRows = parseStructuredRows(rowsJson);
      let workbook: XLSX.WorkBook;
      let finalRows = incomingRows;

      try {
        workbook = XLSX.read(await fs.readFile(resolvedPath), { type: 'buffer' });
      } catch {
        workbook = XLSX.utils.book_new();
      }

      if (mode === 'append' && workbook.Sheets[sheet]) {
        const existingRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheet], {
          defval: '',
          raw: false
        });
        finalRows = [...existingRows, ...incomingRows];
      }

      workbook.Sheets[sheet] = XLSX.utils.json_to_sheet(finalRows);
      if (!workbook.SheetNames.includes(sheet)) {
        workbook.SheetNames.push(sheet);
      }

      XLSX.writeFile(workbook, resolvedPath);

      return {
        output: `已写入 Excel 文件 ${resolvedPath} 的 sheet ${sheet}，共 ${finalRows.length} 行。`,
        title: 'Excel 写入成功',
        metadata: { path: resolvedPath, sheet, mode, rowCount: finalRows.length }
      };
    } catch (error) {
      return { output: `写入 Excel 失败: ${(error as Error).message}`, title: '错误', metadata: { error: (error as Error).message } };
    }
  }
};

const csvInspectTool = {
  id: 'csv_inspect',
  description: '读取 CSV 的列名、行数和预览数据',
  inputSchema: jsonSchema({
    type: 'object',
    properties: {
      path: { type: 'string', description: 'CSV 文件路径' },
      delimiter: { type: 'string', description: '分隔符，默认英文逗号' },
      maxRows: { type: 'number', description: '预览行数，默认 20' }
    },
    required: ['path']
  }),
  async execute({ path: targetPath, delimiter = ',', maxRows = 20 }: { path: string; delimiter?: string; maxRows?: number }): Promise<ToolResult> {
    try {
      const resolvedPath = resolveToolPath(targetPath);
      const content = await fs.readFile(resolvedPath, 'utf-8');
      const rows = parseCsvContent(content, delimiter);
      const previewRows = rows.slice(0, Math.max(1, Math.min(maxRows, 100)));
      const columns = previewRows.length > 0 ? Object.keys(previewRows[0]) : [];

      const output = [
        `path: ${resolvedPath}`,
        `delimiter: ${delimiter}`,
        `rowCount: ${rows.length}`,
        `columns: ${columns.join(', ') || '(none)'}`,
        'preview:',
        JSON.stringify(previewRows, null, 2)
      ].join('\n');

      return {
        output,
        title: `CSV 预览: ${path.basename(resolvedPath)}`,
        metadata: { path: resolvedPath, delimiter, rowCount: rows.length, columns }
      };
    } catch (error) {
      return { output: `读取 CSV 失败: ${(error as Error).message}`, title: '错误', metadata: { error: (error as Error).message } };
    }
  }
};

const csvWriteTool = {
  id: 'csv_write',
  description: '将 JSON 数组写入 CSV 文件',
  inputSchema: jsonSchema({
    type: 'object',
    properties: {
      path: { type: 'string', description: 'CSV 文件路径' },
      rowsJson: { type: 'string', description: 'JSON 数组字符串，例如 [{\"name\":\"A\",\"value\":1}]' },
      delimiter: { type: 'string', description: '分隔符，默认英文逗号' },
      mode: { type: 'string', description: 'replace 或 append，默认 replace' }
    },
    required: ['path', 'rowsJson']
  }),
  async execute({ path: targetPath, rowsJson, delimiter = ',', mode = 'replace' }: { path: string; rowsJson: string; delimiter?: string; mode?: 'replace' | 'append' }): Promise<ToolResult> {
    try {
      const resolvedPath = resolveToolPath(targetPath);
      await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
      const incomingRows = parseStructuredRows(rowsJson);
      let finalRows = incomingRows;

      if (mode === 'append') {
        try {
          const existingContent = await fs.readFile(resolvedPath, 'utf-8');
          const existingRows = parseCsvContent(existingContent, delimiter);
          finalRows = [...existingRows, ...incomingRows];
        } catch {
          finalRows = incomingRows;
        }
      }

      const headers = Array.from(new Set(finalRows.flatMap((row) => Object.keys(row))));
      const lines = [
        headers.join(delimiter),
        ...finalRows.map((row) => headers.map((header) => stringifyCsvValue(row[header], delimiter)).join(delimiter))
      ];

      await fs.writeFile(resolvedPath, `${lines.join('\n')}\n`, 'utf-8');

      return {
        output: `已写入 CSV 文件 ${resolvedPath}，共 ${finalRows.length} 行。`,
        title: 'CSV 写入成功',
        metadata: { path: resolvedPath, delimiter, mode, rowCount: finalRows.length, columns: headers }
      };
    } catch (error) {
      return { output: `写入 CSV 失败: ${(error as Error).message}`, title: '错误', metadata: { error: (error as Error).message } };
    }
  }
};

const execAsync = promisify(exec);

async function searchFiles(dir: string, pattern: RegExp, include?: string, results: string[] = [], depth = 0): Promise<string[]> {
  if (depth > 10) return results;
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        await searchFiles(fullPath, pattern, include, results, depth + 1);
      } else if (entry.isFile()) {
        if (include && !entry.name.match(new RegExp(include.replace(/\*/g, '.*')))) continue;
        try {
          const content = await fs.readFile(fullPath, 'utf-8');
          const lines = content.split('\n');
          lines.forEach((line, index) => {
            if (pattern.test(line)) {
              results.push(`${fullPath}:${index + 1}: ${line}`);
            }
          });
        } catch {}
      }
    }
  } catch {}
  return results;
}

const grepTool = {
  id: 'grep',
  description: '在文件中搜索内容',
  inputSchema: jsonSchema({
    type: 'object',
    properties: {
      pattern: { type: 'string', description: '搜索模式(正则表达式)' },
      path: { type: 'string', description: '搜索目录路径' },
      include: { type: 'string', description: '文件类型过滤，如 *.ts' }
    },
    required: ['pattern']
  }),
  async execute({ pattern, path: searchPath, include }: { pattern: string; path?: string; include?: string }): Promise<ToolResult> {
    try {
      const regex = new RegExp(pattern, 'g');
      const cwd = resolveToolPath(searchPath || '.');
      const results = await searchFiles(cwd, regex, include);
      if (results.length === 0) {
        return { output: '未找到匹配结果', title: '搜索结果', metadata: { pattern, path: cwd } };
      }
      return { output: results.join('\n'), title: `找到 ${results.length} 个匹配`, metadata: { pattern, path: cwd, count: results.length } };
    } catch (error) {
      return { output: `搜索失败: ${(error as Error).message}`, title: '错误', metadata: { error: (error as Error).message } };
    }
  }
};

const bashTool = {
  id: 'bash',
  description: '执行 bash 命令',
  inputSchema: jsonSchema({
    type: 'object',
    properties: {
      command: { type: 'string', description: 'bash 命令' },
      cwd: { type: 'string', description: '工作目录' }
    },
    required: ['command']
  }),
  async execute({ command, cwd }: { command: string; cwd?: string }): Promise<ToolResult> {
    try {
      const effectiveCwd = cwd ? resolveToolPath(cwd) : (getCurrentWorkspaceDir() || process.cwd());
      const { stdout, stderr } = await execAsync(command, { cwd: effectiveCwd });
      const output = stderr || stdout;
      return { output: output || '(无输出)', title: '命令执行结果', metadata: { command, cwd: effectiveCwd, stdout, stderr } };
    } catch (error) {
      return { output: `命令执行失败: ${(error as Error).message}`, title: '错误', metadata: { error: (error as Error).message } };
    }
  }
};

async function fetchUrl(url: string, format: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const options = {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 30000
    };
    
    protocol.get(url, options, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchUrl(res.headers.location, format).then(resolve).catch(reject);
        return;
      }
      
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (format === 'html') {
          resolve(data);
        } else if (format === 'text') {
          resolve(data.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim());
        } else {
          resolve(data);
        }
      });
    }).on('error', reject).on('timeout', () => reject(new Error('请求超时')));
  });
}

const webfetchTool = {
  id: 'webfetch',
  description: '从指定 URL 获取内容 - 支持 markdown/text/html 格式',
  inputSchema: jsonSchema({
    type: 'object',
    properties: {
      url: { type: 'string', description: '要获取的 URL 地址' },
      format: { type: 'string', description: '返回格式: markdown (默认), text, html' }
    },
    required: ['url']
  }),
  async execute({ url, format = 'markdown' }: { url: string; format?: string }): Promise<ToolResult> {
    try {
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return { output: 'URL 必须以 http:// 或 https:// 开头', title: '错误', metadata: { error: 'Invalid URL protocol' } };
      }
      const content = await fetchUrl(url, format);
      const title = `获取成功: ${url}`;
      return { output: content, title, metadata: { url, format, size: content.length } };
    } catch (error) {
      return { output: `获取失败: ${(error as Error).message}`, title: '错误', metadata: { error: (error as Error).message } };
    }
  }
};

interface TodoItem {
  id: string;
  sessionId: string;
  content: string;
  status: 'pending' | 'done';
  createdAt: number;
  updatedAt: number;
}

interface TodoData {
  todos: TodoItem[];
}

async function getTodoFilePath(): Promise<string> {
  const sessionDir = getDataSubdir('sessions');
  try {
    await fs.access(sessionDir);
  } catch {
    await fs.mkdir(sessionDir, { recursive: true });
  }
  return path.join(sessionDir, 'todos.json');
}

async function readTodoData(): Promise<TodoData> {
  const filePath = await getTodoFilePath();
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return { todos: [] };
  }
}

async function writeTodoData(data: TodoData): Promise<void> {
  const filePath = await getTodoFilePath();
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

const writeTodoTool = {
  id: 'writeTodo',
  description: '写入或更新待办事项',
  inputSchema: jsonSchema({
    type: 'object',
    properties: {
      content: { type: 'string', description: '待办事项内容' },
      status: { type: 'string', description: '状态: pending（待办）或 done（已完成）', enum: ['pending', 'done'] },
      id: { type: 'string', description: '可选：更新已存在的待办事项ID' }
    },
    required: ['content', 'status']
  }),
  async execute({ content, status, id }: { content: string; status: 'pending' | 'done'; id?: string }): Promise<ToolResult> {
    try {
      const sessionId = getCurrentSessionId();
      if (!sessionId) {
        return { output: '无法获取会话ID', title: '错误', metadata: { error: 'Session ID not available' } };
      }
      
      const data = await readTodoData();
      const now = Date.now();
      
      if (id) {
        const todo = data.todos.find(t => t.id === id);
        if (todo) {
          todo.content = content;
          todo.status = status;
          todo.updatedAt = now;
        } else {
          return { output: `未找到 ID 为 ${id} 的待办事项`, title: '错误', metadata: { error: 'Todo not found' } };
        }
      } else {
        data.todos.push({
          id: `todo_${now}_${Math.random().toString(36).slice(2, 8)}`,
          sessionId,
          content,
          status,
          createdAt: now,
          updatedAt: now
        });
      }
      
      await writeTodoData(data);
      
      const action = id ? '更新' : '添加';
      return { output: `${action}待办成功`, title: `${action}成功`, metadata: { count: data.todos.length } };
    } catch (error) {
      return { output: `操作失败: ${(error as Error).message}`, title: '错误', metadata: { error: (error as Error).message } };
    }
  }
};

const readTodoTool = {
  id: 'readTodo',
  description: '读取待办事项列表',
  inputSchema: jsonSchema({
    type: 'object',
    properties: {
      status: { type: 'string', description: '可选：按状态筛选 pending 或 done' }
    }
  }),
  async execute({ status }: { status?: 'pending' | 'done' }): Promise<ToolResult> {
    try {
      const sessionId = getCurrentSessionId();
      if (!sessionId) {
        return { output: '无法获取会话ID', title: '错误', metadata: { error: 'Session ID not available' } };
      }
      
      const data = await readTodoData();
      
      let todos = data.todos.filter(t => t.sessionId === sessionId);
      if (status) {
        todos = todos.filter(t => t.status === status);
      }
      
      todos.sort((a, b) => b.createdAt - a.createdAt);
      
      if (todos.length === 0) {
        return { output: '暂无待办事项', title: '待办列表为空', metadata: { count: 0 } };
      }
      
      const lines = todos.map(t => {
        const check = t.status === 'done' ? '[x]' : '[ ]';
        const time = new Date(t.createdAt).toLocaleString('zh-CN');
        return `${check} ${t.content} (${time}) [ID: ${t.id}]`;
      });
      
      const pendingCount = todos.filter(t => t.status === 'pending').length;
      const doneCount = todos.filter(t => t.status === 'done').length;
      
      return {
        output: lines.join('\n'),
        title: `待办列表 (待办: ${pendingCount}, 已完成: ${doneCount})`,
        metadata: { count: todos.length, pendingCount, doneCount }
      };
    } catch (error) {
      return { output: `读取失败: ${(error as Error).message}`, title: '错误', metadata: { error: (error as Error).message } };
    }
  }
};

export const BUILTIN_TOOL_CATALOG: BuiltinToolCatalogEntry[] = [
  { id: 'read', name: '文件读取', type: 'script', description: readTool.description },
  { id: 'write', name: '文件写入', type: 'script', description: writeTool.description },
  { id: 'edit', name: '文件编辑', type: 'script', description: editTool.description },
  { id: 'grep', name: '内容搜索', type: 'script', description: grepTool.description },
  { id: 'bash', name: '命令执行', type: 'shell', description: bashTool.description },
  { id: 'webfetch', name: '网页抓取', type: 'api', description: webfetchTool.description },
  { id: 'excel_inspect', name: 'Excel 读取', type: 'script', description: excelInspectTool.description },
  { id: 'excel_write', name: 'Excel 写入', type: 'script', description: excelWriteTool.description },
  { id: 'csv_inspect', name: 'CSV 读取', type: 'script', description: csvInspectTool.description },
  { id: 'csv_write', name: 'CSV 写入', type: 'script', description: csvWriteTool.description },
  { id: 'writeTodo', name: '待办写入', type: 'script', description: writeTodoTool.description },
  { id: 'readTodo', name: '待办读取', type: 'script', description: readTodoTool.description }
];

export const TOOLS: ToolSet = {
  read: readTool,
  write: writeTool,
  edit: editTool,
  grep: grepTool,
  bash: bashTool,
  webfetch: webfetchTool,
  excel_inspect: excelInspectTool,
  excel_write: excelWriteTool,
  csv_inspect: csvInspectTool,
  csv_write: csvWriteTool,
  writeTodo: writeTodoTool,
  readTodo: readTodoTool
} as ToolSet;

export async function executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult | { error: string }> {
  const tool = TOOLS[name];
  if (!tool) {
    return { error: `Unknown tool: ${name}` };
  }
  return (tool as { execute: (args: Record<string, unknown>) => Promise<ToolResult> }).execute(args);
}
