import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ServerEnvSchema } from '@paw/config';

async function bootstrap() {
  const config = ServerEnvSchema.parse(process.env);
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableCors({
    origin: '*',
    credentials: true,
  });

  await app.listen(config.PORT, config.HOST);
  console.log(`Personal AI Workspace API listening on http://${config.HOST}:${config.PORT}/api/v1`);
}

bootstrap().catch((err) => {
  console.error('Fatal error starting Personal AI Workspace API:', err);
  process.exit(1);
});
