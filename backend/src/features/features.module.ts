import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { AuditService } from './audit.service';
import { ReportsService } from './reports.service';
import { ExportService } from './export.service';
import { ApiKeyService } from './api-key.service';
import { FeaturesController } from './features.controller';
import { ExternalApiController } from './external.controller';
import { UsageController } from './usage.controller';
import { ApiKeyGuard } from './api-key.guard';
import { UsageService } from './usage.service';

@Module({
  imports: [BillingModule],
  controllers: [FeaturesController, ExternalApiController, UsageController],
  providers: [
    AuditService,
    ReportsService,
    ExportService,
    ApiKeyService,
    ApiKeyGuard,
    UsageService,
  ],
  exports: [AuditService, UsageService],
})
export class FeaturesModule {}
