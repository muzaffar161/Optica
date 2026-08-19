import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

type Bucket = { times: number[]; windowMs: number };

@Injectable()
export class RateLimitService {
  private readonly buckets = new Map<string, Bucket>();

  consume(key: string, limit: number, windowMs: number) {
    const now = Date.now();
    const start = now - windowMs;
    const prev = this.buckets.get(key);
    const times = (prev?.times ?? []).filter((t) => t > start);
    if (times.length >= limit) {
      const wait = Math.max(1, Math.ceil((times[0] + windowMs - now) / 1000));
      throw new HttpException(
        `Слишком много запросов. Подождите ${wait} сек.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    times.push(now);
    this.buckets.set(key, { times, windowMs });
    if (this.buckets.size > 8000) this.prune(now);
  }

  private prune(now: number) {
    for (const [key, bucket] of this.buckets) {
      const alive = bucket.times.filter((t) => t > now - bucket.windowMs);
      if (alive.length === 0) this.buckets.delete(key);
      else bucket.times = alive;
    }
  }
}
