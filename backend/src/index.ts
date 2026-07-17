/**
 * Atlased — Backend server entry point
 */

// MUST import loadEnv FIRST — before any other imports!
// This ensures dotenv loads environment variables before config.ts validates them.
import './loadEnv';

import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import authRouter from './routes/auth';
import countriesRouter from './routes/countries';
import userRouter from './routes/user';

const app = express();

// Required when running behind a reverse proxy (Nginx Proxy Manager).
// This allows middleware such as express-rate-limit to use X-Forwarded-For safely.
if (config.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// ─── Security middleware ─────────────────────────────────────────────────────

// helmet sets a suite of security headers:
//   X-Content-Type-Options: nosniff
//   X-Frame-Options: DENY
//   Strict-Transport-Security (HSTS)
//   Content-Security-Policy, etc.
app.use(helmet());

// CORS is locked to the exact frontend origin from config.
// `credentials: true` is required for the browser to send the httpOnly
// JWT cookie on cross-origin requests during local development.
app.use(
  cors({
    origin: config.CORS_ORIGIN,
    credentials: true,
  }),
);

// ─── Body and cookie parsing ──────────────────────────────────────────────────

// 16 KB JSON limit — prevents payload-size DoS attacks on this endpoint.
app.use(express.json({ limit: '16kb' }));

// cookie-parser makes req.cookies available; required for JWT extraction.
app.use(cookieParser());

// ─── Health check ─────────────────────────────────────────────────────────────
// Used by Docker healthcheck and monitoring. Returns 200 when the process is up.
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// ─── API routes ───────────────────────────────────────────────────────────────
// All routes are prefixed with /api for easy reverse-proxy routing in production.
app.use('/api/auth', authRouter);
app.use('/api/countries', countriesRouter);
app.use('/api/user', userRouter);

// ─── 404 handler ──────────────────────────────────────────────────────────────
// Must come after all routes.
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// ─── Global error handler ─────────────────────────────────────────────────────
// Must have exactly 4 parameters for Express to recognise it as an error handler.
// Stack traces are never sent to the client in production.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  const statusCode = (err as Error & { statusCode?: number }).statusCode ?? 500;
  const message =
    config.NODE_ENV === 'production' && statusCode === 500
      ? 'Internal server error'
      : err.message;

  if (statusCode === 500) {
    console.error('[error]', err);
  }

  res.status(statusCode).json({ error: message });
});

// ─── Start server ─────────────────────────────────────────────────────────────
app.listen(config.PORT, () => {
  console.log(`[server] Listening on port ${config.PORT} (${config.NODE_ENV})`);
});

export default app;
