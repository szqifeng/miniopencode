import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export function getDataRootDir() {
    if (process.env.MINIOPENCODE_DATA_DIR) {
        return path.resolve(process.env.MINIOPENCODE_DATA_DIR);
    }
    return path.join(__dirname, '../../data');
}
export function getDataSubdir(name) {
    return path.join(getDataRootDir(), name);
}
