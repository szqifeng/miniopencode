export const STORAGE_TYPES = {
    FILE: 'file',
    MYSQL: 'mysql'
};
import { getDataSubdir } from '../utils/paths.js';
const STORAGE_TYPE = process.env.STORAGE_TYPE || STORAGE_TYPES.FILE;
async function createFileStorage() {
    const fs = await import('fs/promises');
    const path = await import('path');
    const DATA_DIR = getDataSubdir('records');
    async function ensureDir() {
        try {
            await fs.access(DATA_DIR);
        }
        catch {
            await fs.mkdir(DATA_DIR, { recursive: true });
        }
    }
    return {
        async save(record) {
            await ensureDir();
            const filePath = path.join(DATA_DIR, `${record.id}.json`);
            await fs.writeFile(filePath, JSON.stringify(record, null, 2), 'utf-8');
            return record;
        },
        async get(id) {
            const filePath = path.join(DATA_DIR, `${id}.json`);
            try {
                const data = await fs.readFile(filePath, 'utf-8');
                return JSON.parse(data);
            }
            catch {
                return null;
            }
        },
        async getAll() {
            await ensureDir();
            const files = await fs.readdir(DATA_DIR);
            const records = [];
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const data = await fs.readFile(path.join(DATA_DIR, file), 'utf-8');
                    records.push(JSON.parse(data));
                }
            }
            return records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        },
        async delete(id) {
            const filePath = path.join(DATA_DIR, `${id}.json`);
            try {
                await fs.unlink(filePath);
                return true;
            }
            catch {
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
async function createMySQLStorage() {
    return {
        async save(record) {
            return record;
        },
        async get(_id) {
            return null;
        },
        async getAll() {
            return [];
        },
        async delete(_id) {
            return false;
        },
        async list(limit = 20, offset = 0) {
            return { records: [], total: 0, limit, offset };
        }
    };
}
let storageInstance = null;
export async function getStorage() {
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
export function getStorageType() {
    return STORAGE_TYPE;
}
