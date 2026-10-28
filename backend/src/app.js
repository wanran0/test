import express from 'express';
import { router } from './routes/index.js';
import { errorHandler } from './middleware/error.js';

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', router);
  app.use((req, res) => res.status(404).json({ error: 'Not Found' }));
  app.use(errorHandler);
  return app;
}
