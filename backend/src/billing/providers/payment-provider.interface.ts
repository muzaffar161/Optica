import type { Payment } from '@prisma/client';

export type PaymentVerifyResult = {
  paid: boolean;
  externalId?: string;
};

export interface PaymentProvider {
  readonly key: string;
  createPayment(payment: Payment): Promise<{ reference?: string }>;
  verifyPayment(payment: Payment): Promise<PaymentVerifyResult>;
}

export const PAYMENT_PROVIDER = 'PAYMENT_PROVIDER';
