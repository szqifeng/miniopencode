import type { Express } from 'express';

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
}

export default MiniOpenCodeServer;
