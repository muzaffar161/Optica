import { Injectable } from '@nestjs/common';
import { PaymentService } from './payment.service';

@Injectable()
export class SmsPurchaseService {
  constructor(private readonly payments: PaymentService) {}

  purchase(organizationId: string, packageId: string) {
    return this.payments.createSmsPackage(organizationId, packageId);
  }
}
