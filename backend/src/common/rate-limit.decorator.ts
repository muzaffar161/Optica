import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rateLimit';

export type RateLimitBy =
  | 'ip'
  | 'user'
  | 'ip+user'
  | 'ip+login'
  | 'param:id'
  | 'optics'
  | 'org'
  | 'apiKey';

export type RateLimitRule = {
  name: string;
  limit: number;
  windowMs: number;
  by?: RateLimitBy;
};

export const RateLimit = (...rules: RateLimitRule[]) =>
  SetMetadata(RATE_LIMIT_KEY, rules);
