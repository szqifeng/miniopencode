/**
 * Prompts 模块 - 系统提示词管理
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface Prompt {
  name: string;
  description: string;
  content: string;
}

let promptsCache: Prompt[] | null = null;

export async function loadPrompts(): Promise<Prompt[]> {
  if (promptsCache) return promptsCache;

  const promptsDir = path.join(__dirname, '../../prompts');
  
  try {
    const files = await fs.readdir(promptsDir);
    const mdFiles = files.filter(f => f.endsWith('.md'));
    
    promptsCache = await Promise.all(
      mdFiles.map(async (file) => {
        const filePath = path.join(promptsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const name = file.replace('.md', '');
        
        // 从内容中提取描述（第一行或 # 后面内容）
        const lines = content.split('\n');
        let description = '';
        
        if (lines[0]?.startsWith('# ')) {
          description = lines[0].replace('# ', '').trim();
        }
        
        return {
          name,
          description,
          content: content.trim()
        };
      })
    );
    
    return promptsCache;
  } catch (error) {
    console.error('Failed to load prompts:', error);
    return [];
  }
}

export async function getPrompt(name: string): Promise<string | null> {
  const prompts = await loadPrompts();
  const prompt = prompts.find(p => p.name === name);
  return prompt?.content || null;
}

export async function getDefaultPrompt(): Promise<string> {
  const defaultContent = await getPrompt('default');
  return defaultContent || '你是 MiniOpenCode，一个专业的 AI 助手。';
}

export async function listPrompts(): Promise<Prompt[]> {
  return loadPrompts();
}