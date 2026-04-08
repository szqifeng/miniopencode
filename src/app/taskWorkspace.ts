import fs from 'node:fs/promises';
import path from 'node:path';
import { getDataSubdir } from '../utils/paths.js';
import type { TaskFile } from './types.js';

function sanitizeFileName(fileName: string): string {
  const baseName = path.basename(fileName).replace(/[^\w.\-()\u4e00-\u9fa5]+/g, '_');
  return baseName || `upload_${Date.now()}`;
}

export function getTaskRootDir(taskId: string): string {
  return path.join(getDataSubdir('tasks'), taskId);
}

export function getTaskWorkspaceDir(taskId: string): string {
  return getTaskRootDir(taskId);
}

export async function ensureTaskWorkspace(taskId: string): Promise<string> {
  const workspaceDir = getTaskWorkspaceDir(taskId);
  await fs.mkdir(workspaceDir, { recursive: true });
  return workspaceDir;
}

export async function deleteTaskWorkspace(taskId: string): Promise<void> {
  await fs.rm(getTaskRootDir(taskId), { recursive: true, force: true });
}

export async function saveTaskUpload(taskId: string, originalFileName: string, content: Buffer) {
  const workspaceDir = await ensureTaskWorkspace(taskId);
  const safeName = sanitizeFileName(originalFileName);
  const ext = path.extname(safeName);
  const stem = path.basename(safeName, ext);
  const finalName = `${stem}_${Date.now()}${ext}`;
  const relativePath = path.posix.join('uploads', finalName);
  const absolutePath = path.join(workspaceDir, relativePath);

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, content);

  const uploadedAt = new Date().toISOString();
  const file: TaskFile = {
    name: originalFileName,
    path: relativePath,
    size: content.byteLength,
    uploadedAt
  };

  return {
    workspaceDir,
    inputFilePath: relativePath,
    file
  };
}
