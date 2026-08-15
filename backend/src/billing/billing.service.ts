import { Injectable } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { PaymentService } from './payment.service';
import { PaymentSettingsService } from './payment-settings.service';

@Injectable()
export class BillingService {
  constructor(
    private readonly subscriptions: SubscriptionService,
    private readonly payments: PaymentService,
    private readonly settings: PaymentSettingsService,
  ) {}

  async orgOverview(organizationId: string) {
    const [summary, history, paymentSettings] = await Promise.all([
      this.subscriptions.summary(organizationId),
      this.payments.listForOrg(organizationId, '1', '30'),
      this.settings.publicView(),
    ]);
    return {
      ...summary,
      payments: history.items,
      paymentSettings,
    };
  }
}
