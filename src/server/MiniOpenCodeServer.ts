import type { Express } from 'express';
import fs from 'node:fs';
import path from 'node:path';

interface Module {
  setup?: (app: Express) => void;
}

export class MiniOpenCodeServer {
  private app: Express | null = null;
  private port: number;
  private modules: Map<string, Module> = new Map();
  private server: ReturnType<Express['listen']> | null = null;

  constructor(options: { port?: number } = {}) {
    this.port = options.port ?? parseInt(process.env.PORT || '3000', 10);
  }

  register(name: string, module: Module): void {
    this.modules.set(name, module);
  }

  async start(): Promise<void> {
    const { default: express } = await import('express');
    this.app = express();

    this.app.use(express.json());
    this.app.use((req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
      if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
      }
      next();
    });

    this.app.get('/health', (_req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    for (const [name, module] of this.modules) {
      if (module.setup && this.app) {
        module.setup(this.app);
      }
      console.log(`✓ Module loaded: ${name}`);
    }

    this.configureStaticUi(express);

    if (this.app) {
      this.app.use((err: Error, _req: unknown, res: unknown, _next: unknown) => {
        console.error('Error:', err);
        (res as { status: (code: number) => { json: (data: object) => void } }).status(500).json({
          error: 'Internal Server Error',
          message: err.message || 'An unexpected error occurred'
        });
      });
    }

    return new Promise((resolve) => {
      if (this.app) {
        this.server = this.app.listen(this.port, () => {
          const address = this.server?.address();
          if (address && typeof address === 'object') {
          this.port = address.port;
          }
          console.log(`🚀 MiniOpenCode server running on http://localhost:${this.port}`);
          console.log(`🖥️  MiniOpenCode UI available at http://localhost:${this.port}`);
          console.log(`📋 API Key: ${process.env.API_KEY ? 'configured' : 'NOT SET'}`);
          console.log(`🤖 AI Provider: ${process.env.MINIMAX_CN_API_KEY ? 'configured' : 'NOT SET'}`);
          resolve();
        });
      }
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      this.server.close();
    }
  }

  getPort(): number {
    return this.port;
  }

  private configureStaticUi(expressModule: { static: (root: string) => unknown }): void {
    if (!this.app) {
      return;
    }

    const uiDistPath = this.resolveUiDistPath();
    if (!uiDistPath) {
      console.warn('⚠️ UI dist not found. Web UI hosting is disabled for this run.');
      return;
    }

    (this.app as any).use('/', expressModule.static(uiDistPath));
    (this.app as any).get(/^(?!\/api|\/health).*/, (_req: unknown, res: { sendFile: (filePath: string) => void }) => {
      res.sendFile(path.join(uiDistPath, 'index.html'));
    });
  }

  private resolveUiDistPath(): string | null {
    const candidates = [
      process.env.UI_DIST_PATH,
      path.resolve(process.cwd(), 'src/ui/task-scheduler-vite/dist'),
      path.resolve(process.cwd(), 'ui-dist'),
    ].filter(Boolean) as string[];

    for (const candidate of candidates) {
      if (fs.existsSync(path.join(candidate, 'index.html'))) {
        return candidate;
      }
    }

    return null;
  }
}

export default MiniOpenCodeServer;
