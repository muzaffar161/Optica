import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  async send(phone: string, text: string) {
    this.logger.log(`[SMS MOCK] → ${phone}: ${text}`);
    return { ok: true as const, mocked: true as const };
  }
}
