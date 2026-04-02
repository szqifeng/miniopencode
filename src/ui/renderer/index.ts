export {};

interface ElectronAPI {
  appVersion: () => Promise<string>;
  platform: () => Promise<string>;
  onMessage: (callback: (message: string) => void) => void;
  sendMessage: (message: string) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

const messagesContainer = document.getElementById('messages')!;
const input = document.getElementById('input') as HTMLTextAreaElement;
const sendBtn = document.getElementById('sendBtn') as HTMLButtonElement;
const platformEl = document.getElementById('platform')!;
const versionEl = document.getElementById('version')!;

async function init() {
  try {
    if (window.electronAPI) {
      const platform = await window.electronAPI.platform();
      const version = await window.electronAPI.appVersion();
      platformEl.textContent = platform;
      versionEl.textContent = version;
    }
  } catch (e) {
    console.log('Running in browser mode');
  }
}

function addMessage(role: 'user' | 'assistant', content: string) {
  const div = document.createElement('div');
  div.className = `message ${role}`;
  div.innerHTML = `
    <div class="message-role">${role === 'user' ? 'You' : 'Assistant'}</div>
    <div class="message-content">${escapeHtml(content)}</div>
  `;
  messagesContainer.appendChild(div);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function setInputEnabled(enabled: boolean) {
  input.disabled = !enabled;
  sendBtn.disabled = !enabled;
}

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 120) + 'px';
});

sendBtn.addEventListener('click', sendMessage);

async function sendMessage() {
  const text = input.value.trim();
  if (!text) return;

  addMessage('user', text);
  input.value = '';
  input.style.height = 'auto';
  setInputEnabled(false);

  const assistantDiv = document.createElement('div');
  assistantDiv.className = 'message assistant';
  assistantDiv.innerHTML = `
    <div class="message-role">Assistant</div>
    <div class="message-content"><div class="typing-indicator"><span></span><span></span><span></span></div></div>
  `;
  messagesContainer.appendChild(assistantDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  const contentDiv = assistantDiv.querySelector('.message-content')!;

  try {
    const response = await fetch('http://localhost:3000/api/web/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'om_fixed_api_key_12345'
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: text }],
        system: '你是助手，可以调用工具，输出内容需要是 markdown 格式',
        useTools: true
      })
    });

    if (!response.ok) {
      contentDiv.textContent = `请求失败: ${response.status} ${response.statusText}`;
      setInputEnabled(true);
      input.focus();
      return;
    }

    contentDiv.innerHTML = '';

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          
          if (trimmed.startsWith('data: ')) {
            try {
              const jsonStr = trimmed.slice(6);
              const data = JSON.parse(jsonStr);
              
              if (data.type === 'text-delta') {
                const delta = data.textDelta || data.text || '';
                fullText += delta;
                contentDiv.textContent = fullText;
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
              } else if (data.type === 'error') {
                contentDiv.textContent = `错误: ${JSON.stringify(data.error)}`;
                return;
              }
            } catch (e) {
              console.error('Parse error:', e, trimmed);
            }
          }
        }
      }
    }

    if (!fullText) {
      contentDiv.textContent = '(无响应)';
    }
  } catch (e) {
    contentDiv.textContent = `错误: ${(e as Error).message}`;
  }

  setInputEnabled(true);
  input.focus();
}

init();