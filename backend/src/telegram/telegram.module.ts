import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
