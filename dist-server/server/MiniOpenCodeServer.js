import fs from 'node:fs';
import path from 'node:path';
export class MiniOpenCodeServer {
    app = null;
    port;
    modules = new Map();
    server = null;
    constructor(options = {}) {
        this.port = options.port ?? parseInt(process.env.PORT || '3000', 10);
    }
    register(name, module) {
        this.modules.set(name, module);
    }
    async start() {
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
            this.app.use((err, _req, res, _next) => {
                console.error('Error:', err);
                res.status(500).json({
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
    async stop() {
        if (this.server) {
            this.server.close();
        }
    }
    getPort() {
        return this.port;
    }
    configureStaticUi(expressModule) {
        if (!this.app) {
            return;
        }
        const uiDistPath = this.resolveUiDistPath();
        if (!uiDistPath) {
            console.warn('⚠️ UI dist not found. Web UI hosting is disabled for this run.');
            return;
        }
        this.app.use('/', expressModule.static(uiDistPath));
        this.app.get(/^(?!\/api|\/health).*/, (_req, res) => {
            res.sendFile(path.join(uiDistPath, 'index.html'));
        });
    }
    resolveUiDistPath() {
        const candidates = [
            process.env.UI_DIST_PATH,
            path.resolve(process.cwd(), 'src/ui/task-scheduler-vite/dist'),
            path.resolve(process.cwd(), 'ui-dist'),
        ].filter(Boolean);
        for (const candidate of candidates) {
            if (fs.existsSync(path.join(candidate, 'index.html'))) {
                return candidate;
            }
        }
        return null;
    }
}
export default MiniOpenCodeServer;
