import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { app, BrowserWindow, dialog } from 'electron';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

let backendServer = null;

function reportStartupError(error) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  console.error('Desktop startup failed:', error);

  if (app.isReady()) {
    dialog.showErrorBox('MiniOpenCode 启动失败', message);
  }
}

async function startBackend() {
  process.env.MINIOPENCODE_DATA_DIR = path.join(app.getPath('userData'), 'data');

  const serverModulePath = path.join(appRoot, 'dist-server/server/createConfiguredServer.js');
  const serverModule = await import(pathToFileURL(serverModulePath).href);
  backendServer = await serverModule.startConfiguredServer(0);
  return `http://127.0.0.1:${backendServer.getPort()}`;
}

async function createMainWindow() {
  const backendBaseUrl = await startBackend();
  const desktopApiBase = `${backendBaseUrl}/api`;

  const window = new BrowserWindow({
    width: 1480,
    height: 980,
    minWidth: 1200,
    minHeight: 760,
    title: 'MiniOpenCode',
    backgroundColor: '#f4f7fb',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.mjs'),
      additionalArguments: [`--miniopencode-api-base=${desktopApiBase}`]
    }
  });

  if (isDev) {
    const devUrl = new URL(process.env.VITE_DEV_SERVER_URL);
    devUrl.searchParams.set('miniopencodeApiBase', desktopApiBase);
    await window.loadURL(devUrl.toString());
    window.webContents.openDevTools({ mode: 'detach' });
    return;
  }

  await window.loadFile(path.join(appRoot, 'src/ui/task-scheduler-vite/dist/index.html'), {
    query: {
      miniopencodeApiBase: desktopApiBase,
    },
  });
}

app.whenReady().then(async () => {
  try {
    await createMainWindow();
  } catch (error) {
    reportStartupError(error);
    app.quit();
    return;
  }

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      try {
        await createMainWindow();
      } catch (error) {
        reportStartupError(error);
        app.quit();
      }
    }
  });
});

process.on('unhandledRejection', (error) => {
  reportStartupError(error);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  if (backendServer) {
    await backendServer.stop();
  }
});
