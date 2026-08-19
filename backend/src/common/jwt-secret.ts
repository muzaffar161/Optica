import { ConfigService } from '@nestjs/config';

const WEAK = new Set([
  '',
  'optika-dev-jwt-secret',
  'change-me-in-production',
  'change-me',
]);

export function jwtSecret(config: ConfigService) {
  const secret = config.get<string>('JWT_SECRET')?.trim() ?? '';
  if (WEAK.has(secret)) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Задайте JWT_SECRET в backend/.env');
    }
    return secret || 'optika-dev-jwt-secret';
  }
  return secret;
}
