import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let appDataDir = '';

async function loadService() {
  vi.resetModules();
  return import('../src/app/service.js');
}

describe('app service task flow', () => {
  beforeEach(async () => {
    appDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'miniopencode-app-'));
    process.env.APP_DATA_DIR = appDataDir;
    process.env.MOCK_TASK_RUN_RESULT = '# Demo Report\n\n- task executed\n- markdown generated';
  });

  afterEach(async () => {
    delete process.env.APP_DATA_DIR;
    delete process.env.MOCK_TASK_RUN_RESULT;
    await fs.rm(appDataDir, { recursive: true, force: true });
  });

  it('seeds builtin tools including excel and csv helpers', async () => {
    const service = await loadService();
    const tools = await service.listTools();

    expect(tools.some((tool) => tool.id === 'excel_inspect')).toBe(true);
    expect(tools.some((tool) => tool.id === 'excel_write')).toBe(true);
    expect(tools.some((tool) => tool.id === 'csv_inspect')).toBe(true);
    expect(tools.some((tool) => tool.id === 'csv_write')).toBe(true);
  });

  it('creates, pauses, resumes and runs a task into run/report records', async () => {
    const service = await loadService();

    const task = await service.createTask({
      name: '深圳天气任务',
      inputFilePath: './data/demo/weather.xlsx',
      schedule: 'daily',
      scheduleTime: '09:00',
      status: 'active',
      analysisGoal: '输出天气摘要和邮编信息'
    });

    expect(task.id).toBeTruthy();
    expect(task.outputFormat).toBe('markdown');
    expect(task.nextRunAt).toBeTruthy();

    const pausedTask = await service.disableTask(task.id);
    expect(pausedTask.status).toBe('paused');
    expect(pausedTask.nextRunAt).toBeUndefined();

    const resumedTask = await service.enableTask(task.id);
    expect(resumedTask.status).toBe('active');
    expect(resumedTask.nextRunAt).toBeTruthy();

    const { run, report } = await service.executeTask(task.id);
    expect(run.status).toBe('success');
    expect(run.reportId).toBe(report.id);
    expect(report.taskId).toBe(task.id);
    expect(report.contentMarkdown).toContain('# Demo Report');

    const runs = await service.listTaskRuns(task.id);
    const reports = await service.listTaskReports(task.id);
    const latestTask = await service.getTaskById(task.id);

    expect(runs).toHaveLength(1);
    expect(reports).toHaveLength(1);
    expect(latestTask?.lastRunAt).toBeTruthy();
    expect(latestTask?.status).toBe('active');
  });
});
