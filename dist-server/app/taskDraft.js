import { llmChat } from '../agent/llm.js';
const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
function createEmptyScheduleConfig() {
    return {
        minute: null,
        time: '',
        weekday: null,
    };
}
function inferTaskName(goal, inputFilePath) {
    const cleanGoal = goal
        ?.replace(/^基于.+?(进行|做)/, '')
        .replace(/^输出/, '')
        .replace(/^生成/, '')
        .replace(/[。！!；;]+$/g, '')
        .trim();
    if (cleanGoal) {
        const concise = cleanGoal.slice(0, 24);
        return concise.endsWith('任务') ? concise : `${concise}任务`;
    }
    if (inputFilePath) {
        const fileName = inputFilePath.split(/[\\/]/).pop()?.replace(/\.(csv|xlsx)$/i, '');
        if (fileName) {
            return `${fileName}分析任务`;
        }
    }
    return undefined;
}
function parseJsonBlock(text) {
    const trimmed = text.trim();
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenced?.[1] || trimmed;
    try {
        return JSON.parse(candidate);
    }
    catch {
        return null;
    }
}
function toTimeString(hour, minute = 0) {
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
function normalizeTimeExpression(text) {
    const direct = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
    if (direct) {
        return `${direct[1].padStart(2, '0')}:${direct[2]}`;
    }
    const zh = text.match(/(凌晨|早上|上午|中午|下午|晚上)?\s*(\d{1,2})\s*点(?:(\d{1,2})\s*分?)?/);
    if (!zh) {
        return undefined;
    }
    let hour = Number(zh[2]);
    const minute = zh[3] ? Number(zh[3]) : 0;
    const period = zh[1] || '';
    if ((period === '下午' || period === '晚上') && hour < 12) {
        hour += 12;
    }
    if (period === '凌晨' && hour === 12) {
        hour = 0;
    }
    if (period === '中午' && hour < 11) {
        hour += 12;
    }
    if (hour > 23 || minute > 59) {
        return undefined;
    }
    return toTimeString(hour, minute);
}
function extractWeeklyDay(text) {
    const match = text.match(/周([一二三四五六日天])/);
    if (!match) {
        return undefined;
    }
    const map = {
        一: 1,
        二: 2,
        三: 3,
        四: 4,
        五: 5,
        六: 6,
        日: 0,
        天: 0
    };
    return map[match[1]];
}
function extractHourlyMinute(text) {
    const minuteMatch = text.match(/每小时(?:的)?\s*(\d{1,2})\s*分/);
    if (minuteMatch) {
        const minute = Number(minuteMatch[1]);
        return minute >= 0 && minute <= 59 ? minute : undefined;
    }
    const time = normalizeTimeExpression(text);
    if (!time) {
        return undefined;
    }
    return Number(time.split(':')[1]);
}
function buildScheduleTime(schedule, config) {
    if (schedule === 'manual') {
        return '仅手动执行';
    }
    if (schedule === 'hourly') {
        return `每小时 ${String(config?.minute ?? 0).padStart(2, '0')} 分`;
    }
    if (schedule === 'daily') {
        return config?.time || '09:00';
    }
    const weekday = typeof config?.weekday === 'number' ? WEEKDAY_LABELS[config.weekday] : '周一';
    return `${weekday} ${config?.time || '09:00'}`;
}
function fallbackResolveTaskDraft({ messages, draft }) {
    const userText = messages
        .filter((message) => message.role === 'user')
        .map((message) => message.content.trim())
        .filter(Boolean)
        .join('\n');
    const result = {
        name: draft?.name || '',
        analysisGoal: draft?.analysisGoal || '',
        schedule: draft?.schedule || '',
        scheduleConfig: {
            minute: draft?.scheduleConfig?.minute ?? null,
            time: draft?.scheduleConfig?.time || '',
            weekday: draft?.scheduleConfig?.weekday ?? null,
        },
        scheduleTime: draft?.scheduleTime || '',
        summary: [],
        missing: [],
        warnings: []
    };
    if (/每小时|每个小时|hourly/i.test(userText)) {
        result.schedule = 'hourly';
        result.scheduleConfig = {
            ...createEmptyScheduleConfig(),
            minute: extractHourlyMinute(userText) ?? draft?.scheduleConfig?.minute ?? 0
        };
    }
    else if (/每周|weekly|周[一二三四五六日天]/i.test(userText)) {
        result.schedule = 'weekly';
        result.scheduleConfig = {
            ...createEmptyScheduleConfig(),
            weekday: extractWeeklyDay(userText) ?? draft?.scheduleConfig?.weekday ?? 1,
            time: normalizeTimeExpression(userText) || draft?.scheduleConfig?.time || '09:00'
        };
    }
    else if (/每天|每日|daily/i.test(userText)) {
        result.schedule = 'daily';
        result.scheduleConfig = {
            ...createEmptyScheduleConfig(),
            time: normalizeTimeExpression(userText) || draft?.scheduleConfig?.time || '09:00'
        };
    }
    else if (/手动|立即|单次|需要时再执行|manual/i.test(userText)) {
        result.schedule = 'manual';
        result.scheduleConfig = createEmptyScheduleConfig();
    }
    const goalMatch = userText.match(/(?:输出|生成|整理|给出)([\s\S]+?)(?:。|！|!|$)/);
    if (goalMatch?.[1]?.trim()) {
        const goalText = goalMatch[1].trim().replace(/^(成|为)/, '');
        result.analysisGoal = draft?.inputFilePath
            ? `基于 ${draft.inputFilePath} 进行数据分析，输出${goalText}，并补充关键异常、风险点和建议动作`
            : `输出${goalText}，并补充关键异常、风险点和建议动作`;
    }
    else if (!result.analysisGoal && userText) {
        result.analysisGoal = userText
            .replace(/每周[\s\S]*$/g, '')
            .replace(/每天[\s\S]*$/g, '')
            .replace(/每小时[\s\S]*$/g, '')
            .replace(/手动执行[\s\S]*$/g, '')
            .trim();
    }
    if (!result.name) {
        result.name = inferTaskName(result.analysisGoal, draft?.inputFilePath);
    }
    if (result.schedule) {
        result.scheduleTime = buildScheduleTime(result.schedule, result.scheduleConfig);
        result.summary.push(`执行方式已更新为${result.scheduleTime}`);
    }
    if (result.name) {
        result.summary.push(`建议任务名称：${result.name}`);
    }
    if (result.analysisGoal) {
        result.summary.push('分析目标已抽象为可执行文本');
    }
    if (!draft?.inputFilePath) {
        result.missing.push('输入文件');
    }
    if (!result.analysisGoal) {
        result.missing.push('分析目标');
    }
    if (!result.schedule) {
        result.missing.push('执行方式');
    }
    return result;
}
function sanitizeDraftResult(input, fallback) {
    const scheduleValue = typeof input.schedule === 'string' ? input.schedule : fallback.schedule;
    const allowedSchedule = scheduleValue && ['manual', 'hourly', 'daily', 'weekly'].includes(scheduleValue)
        ? scheduleValue
        : fallback.schedule;
    const scheduleConfigInput = input.scheduleConfig && typeof input.scheduleConfig === 'object'
        ? input.scheduleConfig
        : {};
    const scheduleConfig = {
        minute: typeof scheduleConfigInput.minute === 'number'
            ? Math.max(0, Math.min(59, Math.round(scheduleConfigInput.minute)))
            : fallback.scheduleConfig.minute,
        time: typeof scheduleConfigInput.time === 'string' ? scheduleConfigInput.time : fallback.scheduleConfig.time,
        weekday: typeof scheduleConfigInput.weekday === 'number'
            ? Math.max(0, Math.min(6, Math.round(scheduleConfigInput.weekday)))
            : fallback.scheduleConfig.weekday
    };
    return {
        name: typeof input.name === 'string' && input.name.trim()
            ? input.name.trim()
            : fallback.name,
        analysisGoal: typeof input.analysisGoal === 'string' && input.analysisGoal.trim()
            ? input.analysisGoal.trim()
            : fallback.analysisGoal,
        schedule: allowedSchedule,
        scheduleConfig,
        scheduleTime: typeof input.scheduleTime === 'string' && input.scheduleTime.trim()
            ? input.scheduleTime.trim()
            : allowedSchedule
                ? buildScheduleTime(allowedSchedule, scheduleConfig)
                : fallback.scheduleTime,
        summary: Array.isArray(input.summary) ? input.summary.filter((item) => typeof item === 'string') : fallback.summary,
        missing: Array.isArray(input.missing) ? input.missing.filter((item) => typeof item === 'string') : fallback.missing,
        warnings: Array.isArray(input.warnings) ? input.warnings.filter((item) => typeof item === 'string') : fallback.warnings
    };
}
export async function resolveTaskDraft(params) {
    const fallback = fallbackResolveTaskDraft(params);
    if (!process.env.MINIMAX_CN_API_KEY) {
        return fallback;
    }
    try {
        const result = await llmChat({
            messages: [
                {
                    role: 'user',
                    content: [
                        '当前草稿：',
                        JSON.stringify(params.draft || {}, null, 2),
                        '对话：',
                        JSON.stringify(params.messages, null, 2),
                    ].join('\n')
                }
            ],
            system: [
                '你是任务配置解析器。',
                '你的任务是把用户的自然语言任务描述解析为固定 JSON 结构。',
                '不要调用工具，不要输出 Markdown，不要输出解释，不要包裹代码块，只返回一个 JSON 对象。',
                '需要返回一个建议任务名称 name，名称要简洁明确，便于用户后续手动修改。',
                'analysisGoal 必须是一个具体、可执行、可交付的分析目标文本，尽量写成完整目标句。',
                'analysisGoal 要尽量包含：输入数据范围、分析维度、输出物、关键异常/风险、建议动作。',
                'schedule 只能是 "manual" | "hourly" | "daily" | "weekly"。',
                'scheduleConfig 规则：',
                '- manual: 返回空对象 {}',
                '- hourly: 使用 minute，范围 0-59',
                '- daily: 使用 time，格式 HH:mm',
                '- weekly: 使用 weekday 和 time，其中 weekday 范围 0-6，0=周日，1=周一',
                'scheduleTime 需要返回适合前端直接展示的字符串：',
                '- manual => "仅手动执行"',
                '- hourly => "每小时 XX 分"',
                '- daily => "HH:mm"',
                '- weekly => "周X HH:mm"',
                '如果信息不足，用 missing 返回缺失项，例如：输入文件、分析目标、执行方式。',
                'warnings 只放必要提醒。',
                'summary 返回本次识别到的关键信息数组。',
                '固定 JSON 结构如下：',
                JSON.stringify({
                    name: 'string',
                    analysisGoal: 'string',
                    schedule: 'manual|hourly|daily|weekly|empty-string',
                    scheduleConfig: {
                        minute: 15,
                        time: '09:00',
                        weekday: 1
                    },
                    scheduleTime: 'string',
                    summary: ['string'],
                    missing: ['string'],
                    warnings: ['string']
                }, null, 2)
            ].join('\n')
        });
        let text = '';
        for await (const delta of result.fullStream) {
            const event = delta;
            if (event.type === 'text-delta') {
                text += (event.textDelta || event.text || '');
            }
        }
        const parsed = parseJsonBlock(text);
        if (!parsed) {
            return fallback;
        }
        return sanitizeDraftResult(parsed, fallback);
    }
    catch {
        return fallback;
    }
}
export function getScheduleLabel(schedule) {
    if (schedule === 'hourly') {
        return '每小时';
    }
    if (schedule === 'daily') {
        return '每日';
    }
    if (schedule === 'weekly') {
        return '每周';
    }
    return '手动执行';
}
export function formatScheduleTime(schedule, config) {
    return buildScheduleTime(schedule, config);
}
