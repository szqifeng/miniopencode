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
      inputFilePath: 'uploads/weather.xlsx',
      schedule: 'daily',
      scheduleConfig: { time: '09:00' },
      scheduleTime: '09:00',
      status: 'active',
      analysisGoal: '输出天气摘要和邮编信息'
    });

    expect(task.id).toBeTruthy();
    expect(task.outputFormat).toBe('markdown');
    expect(task.nextRunAt).toBeTruthy();
    expect(task.workspaceDir).toContain(task.id);
    expect(task.uploadedFiles).toEqual([]);

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
    expect(latestTask?.status).toBe('completed');
  });

  it('resolves task draft into concrete analysis goal and schedule config', async () => {
    const service = await loadService();

    const draft = await service.resolveTaskDraftInput({
      messages: [
        {
          role: 'user',
          content: '每周三下午2点输出投诉归因、升级风险和待跟进客户清单'
        }
      ],
      draft: {
        inputFilePath: 'uploads/complaints.csv'
      }
    });

    expect(draft.analysisGoal).toContain('投诉归因');
    expect(draft.name).toContain('投诉');
    expect(draft.schedule).toBe('weekly');
    expect(draft.scheduleConfig?.weekday).toBe(3);
    expect(draft.scheduleConfig?.time).toBe('14:00');
    expect(draft.missing).not.toContain('输入文件');
  });

  it('creates task workspace and removes it on delete', async () => {
    const service = await loadService();

    const task = await service.createTask({
      id: 'task_workspace_spec',
      name: '库存巡检任务',
      inputFilePath: 'uploads/inventory.csv',
      uploadedFiles: [
        {
          name: 'inventory.csv',
          path: 'uploads/inventory.csv',
          size: 128,
          uploadedAt: new Date().toISOString()
        }
      ],
      schedule: 'hourly',
      scheduleConfig: { minute: 15 },
      scheduleTime: '每小时 15 分',
      status: 'active',
      analysisGoal: '输出库存变化、缺货风险与补货建议'
    });

    await fs.access(task.workspaceDir);

    const deleted = await service.deleteTask(task.id);
    expect(deleted).toBe(true);
    await expect(fs.access(task.workspaceDir)).rejects.toThrow();
  });
});
