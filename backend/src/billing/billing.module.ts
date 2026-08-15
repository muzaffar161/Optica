import { Module } from '@nestjs/common';
import { PlanService, SmsPackageAdminService } from './plan.service';
import { SubscriptionService } from './subscription.service';
import { SmsWalletService } from './sms-wallet.service';
import { PaymentService } from './payment.service';
import { PaymentNumberService } from './payment-number.service';
import { PaymentSettingsService } from './payment-settings.service';
import { BillingService } from './billing.service';
import { SmsPurchaseService } from './sms-purchase.service';
import { OrgNetworkService } from './org-network.service';
import { OrgBillingController } from './org-billing.controller';
import { PlatformBillingController } from './platform-billing.controller';
import { ManualPaymentProvider } from './providers/manual-payment.provider';
import { PAYMENT_PROVIDER } from './providers/payment-provider.interface';

@Module({
  controllers: [OrgBillingController, PlatformBillingController],
  providers: [
    PlanService,
    SmsPackageAdminService,
    SubscriptionService,
    SmsWalletService,
    PaymentNumberService,
    PaymentSettingsService,
    PaymentService,
    BillingService,
    SmsPurchaseService,
    OrgNetworkService,
    ManualPaymentProvider,
    { provide: PAYMENT_PROVIDER, useExisting: ManualPaymentProvider },
  ],
  exports: [SubscriptionService, SmsWalletService, PlanService, PaymentService],
})
export class BillingModule {}
