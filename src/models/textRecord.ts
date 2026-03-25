import { v4 as uuidv4 } from 'uuid';

export interface Record {
  id: string;
  originalText?: string;
  summary?: string | null;
  category?: string | null;
  confidence?: number | null;
  operation: string;
  createdAt: string;
}

export function createRecord({
  originalText,
  summary = null,
  category = null,
  confidence = null,
  operation
}: {
  originalText?: string;
  summary?: string | null;
  category?: string | null;
  confidence?: number | null;
  operation: string;
}): Record {
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

export function toPublicRecord(record: Record) {
  return {
    id: record.id,
    summary: record.summary,
    category: record.category,
    confidence: record.confidence,
    operation: record.operation,
    createdAt: record.createdAt
  };
}
