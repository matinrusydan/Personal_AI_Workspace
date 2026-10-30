import { z } from 'zod';

export const NodeEnvSchema = z
  .enum(['development', 'test', 'staging', 'production'])
  .default('development');

export const ServerEnvSchema = z.object({
  NODE_ENV: NodeEnvSchema,
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('127.0.0.1'),

  // Database configuration
  DATABASE_URL: z.string().url().default('postgresql://postgres:postgres@localhost:5432/paw_dev'),

  // Redis configuration
  REDIS_URL: z.string().url().default('redis://localhost:6379'),

  // Opaque sessions and one-time, explicitly enabled owner bootstrap.
  AUTH_ENCRYPTION_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/, 'Expected a 32-byte hex key').optional(),
  AUTH_BOOTSTRAP_ENABLED: z.enum(['true', 'false']).default('false'),
  AUTH_SETUP_TOKEN: z.string().min(32).optional(),
  APP_ORIGIN: z.string().url().optional(),
  PAW_API_URL: z.string().url().optional(),

  // Legacy JWT config remains for compatibility with non-auth modules only.
  JWT_SECRET: z.string().min(32).optional(),
  JWT_EXPIRES_IN: z.string().optional(),

  // Owner identity must be explicitly configured; no fixture account is accepted.
  OWNER_EMAIL: z.string().email().optional(),

  // Optional integrations (disabled by default in Phase 0/1)
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_OWNER_USER_ID: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  ZOOM_CLIENT_ID: z.string().optional(),
  ZOOM_CLIENT_SECRET: z.string().optional(),
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

export function validateEnv(env: Record<string, string | undefined>): ServerEnv {
  const parsed = ServerEnvSchema.safeParse(env);
  if (!parsed.success) {
    console.error('Invalid environment variables:', parsed.error.format());
    throw new Error('Environment configuration validation failed');
  }
  return parsed.data;
}
