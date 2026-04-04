import { describe, it, expect } from 'vitest';

import { createMessage, createTextPart, createToolCallPart, createToolResultPart, messageToLLMFormat, messagesToLLMFormat } from '../src/agent/session.js';

describe('Session Module', () => {
  describe('Message Creation', () => {
    it('should create text part correctly', () => {
      const part = createTextPart('test_id', 'Hello world');
      expect(part.type).toBe('text');
      expect(part.id).toBe('test_id');
      expect(part.content).toBe('Hello world');
    });

    it('should create tool call part correctly', () => {
      const part = createToolCallPart('bash', { command: 'ls' });
      expect(part.type).toBe('tool-call');
      expect(part.tool).toBe('bash');
      expect(part.args).toEqual({ command: 'ls' });
    });

    it('should create tool result part correctly', () => {
      const part = createToolResultPart('bash', { output: 'test' });
      expect(part.type).toBe('tool-result');
      expect(part.tool).toBe('bash');
      expect(part.result).toEqual({ output: 'test' });
    });

    it('should create message correctly', () => {
      const parts = [
        createTextPart('text_1', 'User message'),
        createToolCallPart('bash', { command: 'ls' })
      ];
      const message = createMessage('user', parts);
      expect(message.role).toBe('user');
      expect(message.parts).toEqual(parts);
      expect(message.id).toBeTruthy();
      expect(message.createdAt).toBeTruthy();
    });
  });

  describe('Message Conversion to LLM Format', () => {
    it('should convert text-only message to LLM format', () => {
      const message = createMessage('user', [createTextPart('text_1', 'Hello')]);
      const llmMsg = messageToLLMFormat(message);
      expect(llmMsg.role).toBe('user');
      expect(llmMsg.content).toBe('Hello');
      expect(llmMsg.tool_calls).toBeUndefined();
    });

    it('should convert message with tool calls to LLM format', () => {
      const message = createMessage('assistant', [
        createTextPart('text_1', 'Thinking...'),
        createToolCallPart('bash', { command: 'ls' })
      ]);
      const llmMsg = messageToLLMFormat(message);
      expect(llmMsg.role).toBe('assistant');
      expect(llmMsg.content).toBe('Thinking...');
      expect(llmMsg.tool_calls).toHaveLength(1);
      expect(llmMsg.tool_calls?.[0].type).toBe('function');
      expect(llmMsg.tool_calls?.[0].function.name).toBe('bash');
    });

    it('should convert multiple messages to LLM format', () => {
      const messages = [
        createMessage('user', [createTextPart('text_1', 'Hello')]),
        createMessage('assistant', [createTextPart('text_2', 'Hi there')])
      ];
      const llmMessages = messagesToLLMFormat(messages);
      expect(llmMessages).toHaveLength(2);
      expect(llmMessages[0].content).toBe('Hello');
      expect(llmMessages[1].content).toBe('Hi there');
    });
  });
});
