import express from 'express';
import apiRoutes from './routes/api.js';
import sdkRoutes from './routes/sdk.js';
import { authMiddleware } from './middleware/auth.js';

const app = express();

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api', authMiddleware, apiRoutes);
app.use('/api/sdk', authMiddleware, sdkRoutes);

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message || 'An unexpected error occurred'
  });
});

export default app;