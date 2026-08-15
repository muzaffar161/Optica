import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const uploads = join(process.cwd(), 'uploads');
  mkdirSync(uploads, { recursive: true });
  app.useStaticAssets(uploads, { prefix: '/uploads/' });
  app.setGlobalPrefix('api');
  const origins = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || origins.includes(origin) || origins.includes('*')) {
        callback(null, true)
        return
      }
      try {
        const host = new URL(origin).hostname
        const lan =
          host.startsWith('192.168.') ||
          host.startsWith('10.') ||
          /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
        callback(null, lan)
      } catch {
        callback(null, false)
      }
    },
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
