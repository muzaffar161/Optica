import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/auth-user';
import { PlanService, SmsPackageAdminService } from './plan.service';
import { SubscriptionService } from './subscription.service';
import { SmsWalletService } from './sms-wallet.service';
import { PlatformSmsService } from './platform-sms.service';
import { PaymentService } from './payment.service';
import { PaymentSettingsService } from './payment-settings.service';
import {
  AdjustSmsDto,
  AssignPlanDto,
  CreatePlanDto,
  CreateSmsPackageDto,
  RejectPaymentDto,
  SetPaymentStatusDto,
  StatusDto,
  UpdatePaymentSettingsDto,
  UpsertPlanDto,
  UpsertSmsPackageDto,
} from './dto/billing.dto';
import { OrgNetworkService } from './org-network.service';
import { CreateOpticsDto } from '../platform/dto/create-optics.dto';
import type { UploadedImage } from '../uploads/upload';
import { IMAGE_UPLOAD } from '../uploads/upload';
import { RateLimit } from '../common/rate-limit.decorator';

const qrUpload = FileInterceptor('qr', IMAGE_UPLOAD);

@Roles(Role.platform)
@Controller('platform')
export class PlatformBillingController {
  constructor(
    private readonly plans: PlanService,
    private readonly packages: SmsPackageAdminService,
    private readonly subscriptions: SubscriptionService,
    private readonly wallet: SmsWalletService,
    private readonly pot: PlatformSmsService,
    private readonly network: OrgNetworkService,
    private readonly payments: PaymentService,
    private readonly paymentSettings: PaymentSettingsService,
  ) {}

  @Get('plans')
  listPlans() {
    return this.plans.list();
  }

  @Post('plans')
  createPlan(@Body() dto: CreatePlanDto) {
    return this.plans.create(dto);
  }

  @Patch('plans/:id')
  updatePlan(@Param('id') id: string, @Body() dto: UpsertPlanDto) {
    return this.plans.update(id, dto);
  }

  @Patch('plans/:id/status')
  planStatus(@Param('id') id: string, @Body() dto: StatusDto) {
    return this.plans.update(id, { isActive: dto.isActive });
  }

  @Get('sms-packages')
  listPackages() {
    return this.packages.list();
  }

  @Post('sms-packages')
  createPackage(@Body() dto: CreateSmsPackageDto) {
    return this.packages.create(dto);
  }

  @Patch('sms-packages/:id')
  updatePackage(@Param('id') id: string, @Body() dto: UpsertSmsPackageDto) {
    return this.packages.update(id, dto);
  }

  @Patch('sms-packages/:id/status')
  packageStatus(@Param('id') id: string, @Body() dto: StatusDto) {
    return this.packages.update(id, { isActive: dto.isActive });
  }

  @Get('organizations')
  orgs() {
    return this.network.listOrganizations();
  }

  @Get('organizations/:id')
  org(@Param('id') id: string) {
    return this.network.getOrganization(id);
  }

  @Post('organizations/:id/plan')
  assign(@Param('id') id: string, @Body() dto: AssignPlanDto) {
    return this.subscriptions.assignPlan(id, dto.planId);
  }

  @Post('organizations/:id/sms/adjust')
  async adjust(@Param('id') id: string, @Body() dto: AdjustSmsDto) {
    if (dto.amount === 0) {
      return this.wallet.getWallet(id);
    }
    if (dto.amount > 0) {
      return this.pot.allocateFromPot({
        organizationId: id,
        amount: dto.amount,
        type: 'ADJUSTMENT',
        description: dto.reason,
      });
    }
    return this.pot.reclaimToPot({
      organizationId: id,
      amount: Math.abs(dto.amount),
      description: dto.reason,
    });
  }

  @Get('organizations/:id/sms/transactions')
  orgTxs(@Param('id') id: string) {
    return this.wallet.listTransactions(id, '1', '100');
  }

  @Post('organizations/:id/optics')
  addSalon(@Param('id') id: string, @Body() dto: CreateOpticsDto) {
    return this.network.addSalon(id, dto);
  }

  @Get('payments')
  listPayments(
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('method') method?: string,
    @Query('organizationId') organizationId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.payments.listForPlatform({
      status,
      type,
      method,
      organizationId,
      from,
      to,
      page,
      pageSize,
    });
  }

  @Get('payments/:id')
  getPayment(@Param('id') id: string) {
    return this.payments.getForPlatform(id);
  }

  @Post('payments/:id/confirm')
  confirmPayment(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.payments.confirm(id, user.username);
  }

  @Post('payments/:id/reject')
  rejectPayment(@Param('id') id: string, @Body() dto: RejectPaymentDto) {
    return this.payments.reject(id, dto.reason);
  }

  @Patch('payments/:id/status')
  setPaymentStatus(@Param('id') id: string, @Body() dto: SetPaymentStatusDto) {
    return this.payments.setReviewStatus(id, dto);
  }

  @Get('payment-settings')
  getPaymentSettings() {
    return this.paymentSettings.get();
  }

  @Patch('payment-settings')
  updatePaymentSettings(@Body() dto: UpdatePaymentSettingsDto) {
    return this.paymentSettings.update(dto);
  }

  @Post('payment-settings/qr')
  @RateLimit({ name: 'upload', limit: 20, windowMs: 10 * 60_000, by: 'user' })
  @UseInterceptors(qrUpload)
  uploadQr(@UploadedFile() file?: UploadedImage) {
    if (!file) throw new BadRequestException('Загрузите изображение QR');
    return this.paymentSettings.update({}, file);
  }
}
