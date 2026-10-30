import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ServerEnvSchema } from '@paw/config';

async function bootstrap() {
  const config = ServerEnvSchema.parse(process.env);
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new HttpExceptionFilter());

  // Only allow explicitly configured browser origins. Never combine wildcard CORS with credentials.
  const allowedOrigins = new Set(
    (process.env.APP_ORIGIN || 'http://localhost:3000,http://127.0.0.1:3000')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  );

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow non-browser clients (mobile app, CLI, server-side calls) that omit Origin.
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin is not allowed by CORS'), false);
    },
    credentials: false,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Trace-Id', 'If-Match'],
  });

  await app.listen(config.PORT, config.HOST);
  console.log(`Personal AI Workspace API listening on http://${config.HOST}:${config.PORT}/api/v1`);
  console.log(`Allowed browser origins: ${[...allowedOrigins].join(', ')}`);
}

bootstrap().catch((err) => {
  console.error('Fatal error starting Personal AI Workspace API:', err);
  process.exit(1);
});

