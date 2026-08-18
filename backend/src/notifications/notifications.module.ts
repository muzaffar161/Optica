import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { SmsService } from './sms.service';
import { CheckupReminderService } from './checkup-reminder.service';
import { SettingsModule } from '../settings/settings.module';
import { TelegramModule } from '../telegram/telegram.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [SettingsModule, TelegramModule, BillingModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, SmsService, CheckupReminderService],
})
export class NotificationsModule {}
