import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';
import { optionalAuth } from './middleware/auth.js';
import { notFound, errorHandler } from './middleware/errors.js';
import authRoutes from './routes/auth.routes.js';
import energyRoutes from './routes/energy.routes.js';
import recommendationsRoutes from './routes/recommendations.routes.js';
import operationsRoutes from './routes/operations.routes.js';
import systemRoutes from './routes/system.routes.js';
import userRoutes from './routes/user.routes.js';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: env.corsOrigin === '*' ? true : env.corsOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(optionalAuth);
app.use('/api/auth', authRoutes);
app.use('/api', systemRoutes);
app.use('/api', energyRoutes);
app.use('/api/recommendations', recommendationsRoutes);
app.use('/api', operationsRoutes);
app.use('/api/user', userRoutes);
app.use(express.static(path.resolve(__dirname, '..')));
app.use((_req, res, next) => {
  if (res.headersSent) return next();
  return res.sendFile(path.resolve(__dirname, '..', 'index.html'));
});
app.use(notFound);
app.use(errorHandler);

let server;
export function startServer(port = env.port) {
  if (server) return server;
  server = app.listen(port, '0.0.0.0', () => console.log(`AXIS API listening on http://0.0.0.0:${port} (${env.demoMode ? 'demo-ready' : 'configured'})`));
  process.on('SIGTERM', () => server.close());
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) startServer();
export { app, server };
