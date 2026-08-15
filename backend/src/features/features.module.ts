import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { AuditService } from './audit.service';
import { ReportsService } from './reports.service';
import { ExportService } from './export.service';
import { ApiKeyService } from './api-key.service';
import { FeaturesController } from './features.controller';
import { ExternalApiController } from './external.controller';
import { ApiKeyGuard } from './api-key.guard';

@Module({
  imports: [BillingModule],
  controllers: [FeaturesController, ExternalApiController],
  providers: [AuditService, ReportsService, ExportService, ApiKeyService, ApiKeyGuard],
  exports: [AuditService],
})
export class FeaturesModule {}
