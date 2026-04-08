import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function getDataRootDir(): string {
  if (process.env.MINIOPENCODE_DATA_DIR) {
    return path.resolve(process.env.MINIOPENCODE_DATA_DIR);
  }

  return path.join(__dirname, '../../data');
}

export function getDataSubdir(name: string): string {
  return path.join(getDataRootDir(), name);
}
