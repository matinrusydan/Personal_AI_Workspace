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

  // Auth secrets (MFA, JWT sessions)
  JWT_SECRET: z.string().min(32).default('dev-secret-must-be-changed-in-production-min-32-chars'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // Owner allowlist
  OWNER_EMAIL: z.string().email().default('owner@example.com'),

  // Optional integrations (disabled by default in Phase 0/1)
  TELEGRAM_BOT_TOKEN: z.string().optional(),
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
