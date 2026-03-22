export class MiniOpenCodeServer {
  constructor() {
    this.app = null;
    this.port = process.env.PORT || 3000;
    this.modules = new Map();
  }

  register(name, module) {
    this.modules.set(name, module);
  }

  async start() {
    const { default: express } = await import('express');
    this.app = express();

    this.app.use(express.json());

    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    for (const [name, module] of this.modules) {
      if (module.setup) {
        module.setup(this.app);
      }
      console.log(`✓ Module loaded: ${name}`);
    }

    this.app.use((err, req, res, next) => {
      console.error('Error:', err);
      res.status(500).json({
        error: 'Internal Server Error',
        message: err.message || 'An unexpected error occurred'
      });
    });

    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        console.log(`🚀 MiniOpenCode server running on http://localhost:${this.port}`);
        console.log(`📋 API Key: ${process.env.API_KEY ? 'configured' : 'NOT SET'}`);
        console.log(`🤖 AI Provider: ${process.env.MINIMAX_CN_API_KEY ? 'configured' : 'NOT SET'}`);
        resolve();
      });
    });
  }

  async stop() {
    if (this.server) {
      this.server.close();
    }
  }
}

export default MiniOpenCodeServer;
