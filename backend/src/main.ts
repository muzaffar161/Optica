import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import { join } from 'path';
import { mkdirSync } from 'fs';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  if (process.env.TRUST_PROXY === '1') {
    app.set('trust proxy', 1);
  }
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(json({ limit: '200kb' }));
  app.use(urlencoded({ extended: true, limit: '200kb' }));
  const uploads = join(process.cwd(), 'uploads');
  mkdirSync(uploads, { recursive: true });
  app.useStaticAssets(uploads, {
    prefix: '/uploads/',
    index: false,
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, max-age=86400');
    },
  });
  app.setGlobalPrefix('api');
  const origins = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const allowLan =
    process.env.ALLOW_LAN_CORS === '1' || process.env.NODE_ENV !== 'production';
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || origins.includes(origin) || origins.includes('*')) {
        callback(null, true);
        return;
      }
      if (!allowLan) {
        callback(null, false);
        return;
      }
      try {
        const host = new URL(origin).hostname;
        const lan =
          host.startsWith('192.168.') ||
          host.startsWith('10.') ||
          /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);
        callback(null, lan);
      } catch {
        callback(null, false);
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
