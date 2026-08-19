import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { MessageTemplatesService } from './message-templates.service';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [BillingModule],
  controllers: [SettingsController],
  providers: [SettingsService, MessageTemplatesService],
  exports: [SettingsService, MessageTemplatesService],
})
export class SettingsModule {}
