import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const API_KEY = 'om_fixed_api_key_12345';
const BASE_URL = 'http://localhost:3000';

describe('MiniOpenCode API', () => {
  beforeAll(async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  describe('Health Check', () => {
    it('should return 200 OK', async () => {
      const response = await fetch(`${BASE_URL}/health`);
      const data = await response.json() as any;
      expect(response.status).toBe(200);
      expect(data.status).toBe('ok');
    });
  });

  describe('Sessions API', () => {
    it('GET /api/web/sessions should return sessions list', async () => {
      const response = await fetch(`${BASE_URL}/api/web/sessions`, {
        headers: { 'X-API-Key': API_KEY }
      });
      const data = await response.json() as any[];
      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });

    it('GET /api/web/sessions should return 401 without API key', async () => {
      const response = await fetch(`${BASE_URL}/api/web/sessions`);
      expect(response.status).toBe(401);
    });
  });

  describe('Chat Stream API', () => {
    it('POST /api/web/chat/stream should return SSE stream', async () => {
      const response = await fetch(`${BASE_URL}/api/web/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'hello' }],
          system: '你是助手',
          useTools: false
        })
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/event-stream');
    });

    it('should create new session when no sessionId provided', async () => {
      const response = await fetch(`${BASE_URL}/api/web/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'test message' }],
          useTools: false
        })
      });

      expect(response.headers.get('x-session-id')).toBeTruthy();
    });
  });
});
