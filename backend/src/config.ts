import { z } from 'zod';

/**
 * Atlased — Validates and exposes all environment variables for the application.
 *
 * Fails fast on startup if any required variable is missing or malformed —
 * a missing JWT_SECRET discovered at login time is far worse than a crash
 * at boot time.
 *
 * No secrets are hardcoded here. All values come from process.env,
 * which is populated from the .env file (local dev) or the compose
 * environment block (production).
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  PORT: z.coerce.number().int().min(1).max(65535).default(4000),

  // Database provider: "sqlite" (local dev) or "postgresql" (production)
  DATABASE_PROVIDER: z.enum(['sqlite', 'postgresql']).default('postgresql'),

  // Prisma reads DATABASE_URL directly from process.env, but we validate it
  // here too so a misconfigured URL causes an early, obvious error.
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // JWT signing secret — must be long enough to resist brute-force.
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('90d'),

  // bcrypt cost factor: 10–20 range. 12 ≈ 250ms on modern hardware.
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(20).default(12),

  // Exact frontend origin for CORS — never allow wildcards.
  CORS_ORIGIN: z.string().url('CORS_ORIGIN must be a valid URL (e.g. http://localhost:5173)'),

  // In some self-hosted LAN setups (HTTP behind local reverse proxy),
  // secure cookies must be disabled even in production.
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value ? value === 'true' : undefined)),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error('❌ Invalid or missing environment variables:');
  console.error(JSON.stringify(result.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

export const config = result.data;

if (typeof config.COOKIE_SECURE === 'undefined') {
  config.COOKIE_SECURE = config.NODE_ENV === 'production';
}
