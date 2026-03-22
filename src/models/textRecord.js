import { v4 as uuidv4 } from 'uuid';

export function createRecord({ originalText, summary = null, category = null, confidence = null, operation }) {
  return {
    id: uuidv4(),
    originalText,
    summary,
    category,
    confidence,
    operation,
    createdAt: new Date().toISOString()
  };
}

export function toPublicRecord(record) {
  return {
    id: record.id,
    summary: record.summary,
    category: record.category,
    confidence: record.confidence,
    operation: record.operation,
    createdAt: record.createdAt
  };
}