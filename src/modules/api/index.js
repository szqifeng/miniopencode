import apiRoutes from '../../routes/api.js';
import sdkRoutes from '../../routes/sdk.js';
import { authMiddleware } from '../../middleware/auth.js';

export function setup(app) {
  app.use('/api', authMiddleware, apiRoutes);
  app.use('/api/sdk', authMiddleware, sdkRoutes);
}

export default { setup };
