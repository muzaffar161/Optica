import { Injectable } from '@nestjs/common';
import type { Payment } from '@prisma/client';
import type { PaymentProvider, PaymentVerifyResult } from './payment-provider.interface';

/** Manual Click / card transfer. Admin confirms; Click API comes later as ClickPaymentProvider. */
@Injectable()
export class ManualPaymentProvider implements PaymentProvider {
  readonly key = 'manual';

  async createPayment(_payment: Payment) {
    return { reference: 'manual' };
  }

  async verifyPayment(_payment: Payment): Promise<PaymentVerifyResult> {
    return { paid: false };
  }
}
