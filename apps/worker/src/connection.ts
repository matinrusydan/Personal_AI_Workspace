import { Redis } from 'ioredis';
import { ServerEnvSchema } from '@paw/config';

let redisInstance: Redis | undefined;

export function getRedisConnection(): Redis {
  if (!redisInstance) {
    const config = ServerEnvSchema.parse(process.env);
    redisInstance = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    redisInstance.on('error', (err) => {
      console.error('[Worker:Redis] Connection error:', err.message);
    });
  }
  return redisInstance;
}
