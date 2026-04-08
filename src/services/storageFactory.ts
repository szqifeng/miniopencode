export const STORAGE_TYPES = {
  FILE: 'file',
  MYSQL: 'mysql'
} as const;
import { getDataSubdir } from '../utils/paths.js';

export type StorageType = typeof STORAGE_TYPES[keyof typeof STORAGE_TYPES];

const STORAGE_TYPE: StorageType = (process.env.STORAGE_TYPE as StorageType) || STORAGE_TYPES.FILE;

interface Storage {
  save: (record: unknown) => Promise<unknown>;
  get: (id: string) => Promise<unknown | null>;
  getAll: () => Promise<unknown[]>;
  delete: (id: string) => Promise<boolean>;
  list: (limit?: number, offset?: number) => Promise<{ records: unknown[]; total: number; limit: number; offset: number }>;
}

async function createFileStorage(): Promise<Storage> {
  const fs = await import('fs/promises');
  const path = await import('path');
  const DATA_DIR = getDataSubdir('records');

  async function ensureDir(): Promise<void> {
    try {
      await fs.access(DATA_DIR);
    } catch {
      await fs.mkdir(DATA_DIR, { recursive: true });
    }
  }

  return {
    async save(record: unknown) {
      await ensureDir();
      const filePath = path.join(DATA_DIR, `${(record as { id: string }).id}.json`);
      await fs.writeFile(filePath, JSON.stringify(record, null, 2), 'utf-8');
      return record;
    },

    async get(id: string) {
      const filePath = path.join(DATA_DIR, `${id}.json`);
      try {
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data);
      } catch {
        return null;
      }
    },

    async getAll() {
      await ensureDir();
      const files = await fs.readdir(DATA_DIR);
      const records: unknown[] = [];
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readFile(path.join(DATA_DIR, file), 'utf-8');
          records.push(JSON.parse(data));
        }
      }
      return records.sort((a, b) => new Date((b as { createdAt: string }).createdAt).getTime() - new Date((a as { createdAt: string }).createdAt).getTime());
    },

    async delete(id: string) {
      const filePath = path.join(DATA_DIR, `${id}.json`);
      try {
        await fs.unlink(filePath);
        return true;
      } catch {
        return false;
      }
    },

    async list(limit = 20, offset = 0) {
      const allRecords = await this.getAll();
      return {
        records: allRecords.slice(offset, offset + limit),
        total: allRecords.length,
        limit,
        offset
      };
    }
  };
}

async function createMySQLStorage(): Promise<Storage> {
  return {
    async save(record: unknown) {
      return record;
    },

    async get(_id: string) {
      return null;
    },

    async getAll() {
      return [];
    },

    async delete(_id: string) {
      return false;
    },

    async list(limit = 20, offset = 0) {
      return { records: [], total: 0, limit, offset };
    }
  };
}

let storageInstance: Storage | null = null;

export async function getStorage(): Promise<Storage> {
  if (storageInstance) {
    return storageInstance;
  }

  switch (STORAGE_TYPE) {
    case STORAGE_TYPES.FILE:
      storageInstance = await createFileStorage();
      break;
    case STORAGE_TYPES.MYSQL:
      storageInstance = await createMySQLStorage();
      break;
    default:
      throw new Error(`Unknown storage type: ${STORAGE_TYPE}`);
  }

  return storageInstance;
}

export function getStorageType(): StorageType {
  return STORAGE_TYPE;
}
