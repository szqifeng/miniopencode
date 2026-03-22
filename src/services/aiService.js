const API_KEY = process.env.MINIMAX_CN_API_KEY;
const BASE_URL = 'https://api.minimaxi.com/anthropic';
const MODEL = 'MiniMax-M2.7-highspeed';

export const DEFAULT_CATEGORIES = ['科技', '娱乐', '新闻', '生活', '其他'];

function extractTextFromContent(content) {
  for (const item of content) {
    if (item.type === 'text' && item.text) {
      return item.text.trim();
    }
  }
  return '';
}

export async function summarizeText(text, maxLength = 200) {
  const response = await fetch(`${BASE_URL}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: `请将以下文本总结为不超过 ${maxLength} 个字符的简短摘要，保持核心含义：

${text}

请直接输出摘要，不要额外的解释。`
        }
      ]
    })
  });

  const data = await response.json();
  return extractTextFromContent(data.content);
}

export async function classifyText(text, categories = DEFAULT_CATEGORIES) {
  const categoriesStr = categories.join('、');

  const response = await fetch(`${BASE_URL}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `请分析以下文本，从给定类别中选择最合适的一个。

文本：${text}

可选类别：${categoriesStr}

请按以下 JSON 格式输出（只输出 JSON，不要其他内容）：
{
  "category": "选择的类别",
  "confidence": 0.95
}`
        }
      ]
    })
  });

  const data = await response.json();
  const responseText = extractTextFromContent(data.content);

  try {
    const parsed = JSON.parse(responseText);
    return {
      category: parsed.category || categories[0],
      confidence: Math.min(Math.max(parsed.confidence || 0.5, 0), 1)
    };
  } catch {
    return {
      category: categories[0],
      confidence: 0.5
    };
  }
}