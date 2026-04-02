/**
 * 工具服务 - 提供内置工具
 */

import { jsonSchema } from 'ai';
import type { ToolSet } from 'ai';
import fs from 'node:fs/promises';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

interface ToolResult {
  output: string;
  title: string;
  metadata: Record<string, unknown>;
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
  async execute({ path }: { path: string }): Promise<ToolResult> {
    try {
      const content = await fs.readFile(path, 'utf-8');
      return { output: content, title: `文件: ${path}`, metadata: { path } };
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
  async execute({ path, content }: { path: string; content: string }): Promise<ToolResult> {
    try {
      await fs.writeFile(path, content, 'utf-8');
      return { output: `已写入文件: ${path}`, title: '写入成功', metadata: { path, bytes: Buffer.byteLength(content, 'utf-8') } };
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
  async execute({ path, oldString, newString }: { path: string; oldString: string; newString: string }): Promise<ToolResult> {
    try {
      const content = await fs.readFile(path, 'utf-8');
      if (!content.includes(oldString)) {
        return { output: `未找到要替换的字符串`, title: '错误', metadata: { error: 'oldString not found in file' } };
      }
      const newContent = content.replace(oldString, newString);
      await fs.writeFile(path, newContent, 'utf-8');
      return { output: `已编辑文件: ${path}`, title: '编辑成功', metadata: { path } };
    } catch (error) {
      return { output: `编辑失败: ${(error as Error).message}`, title: '错误', metadata: { error: (error as Error).message } };
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
      const cwd = searchPath || process.cwd();
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
      const { stdout, stderr } = await execAsync(command, { cwd });
      const output = stderr || stdout;
      return { output: output || '(无输出)', title: '命令执行结果', metadata: { command, cwd, stdout, stderr } };
    } catch (error) {
      return { output: `命令执行失败: ${(error as Error).message}`, title: '错误', metadata: { error: (error as Error).message } };
    }
  }
};

export const TOOLS: ToolSet = {
  read: readTool,
  write: writeTool,
  edit: editTool,
  grep: grepTool,
  bash: bashTool
} as ToolSet;

export async function executeTool(name: string, args: Record<string, unknown>): Promise<ToolResult | { error: string }> {
  const tool = TOOLS[name];
  if (!tool) {
    return { error: `Unknown tool: ${name}` };
  }
  return (tool as { execute: (args: Record<string, unknown>) => Promise<ToolResult> }).execute(args);
}
