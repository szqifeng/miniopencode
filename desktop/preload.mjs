import { contextBridge } from 'electron';

const apiBaseArg = process.argv.find((arg) => arg.startsWith('--miniopencode-api-base='));
const apiBase = apiBaseArg ? apiBaseArg.replace('--miniopencode-api-base=', '') : '';

contextBridge.exposeInMainWorld('__MINIOPENCODE_DESKTOP__', {
  apiBase
});
