import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/auth-user';
import { organizationIdOf } from '../common/optics-scope';
import { BillingService } from './billing.service';
import { PaymentService } from './payment.service';
import { PaymentSettingsService } from './payment-settings.service';
import { SmsWalletService } from './sms-wallet.service';
import { SmsPackageAdminService } from './plan.service';
import { CreatePaymentDto, SubmitPaymentDto } from './dto/billing.dto';

@Roles(Role.optics)
@Controller()
export class OrgBillingController {
  constructor(
    private readonly overview: BillingService,
    private readonly payments: PaymentService,
    private readonly settings: PaymentSettingsService,
    private readonly wallet: SmsWalletService,
    private readonly packages: SmsPackageAdminService,
  ) {}

  @Get('billing')
  billing(@CurrentUser() user: AuthUser) {
    this.ensureOrgOwner(user);
    return this.overview.orgOverview(organizationIdOf(user));
  }

  @Get('billing/payment-settings')
  paymentSettings(@CurrentUser() user: AuthUser) {
    this.ensureOrgOwner(user);
    return this.settings.publicView();
  }

  @Get('billing/payments')
  listPayments(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    this.ensureOrgOwner(user);
    return this.payments.listForOrg(organizationIdOf(user), page, pageSize);
  }

  @Post('billing/payments')
  createPayment(@CurrentUser() user: AuthUser, @Body() dto: CreatePaymentDto) {
    this.ensureOrgOwner(user);
    return this.payments.create({
      organizationId: organizationIdOf(user),
      type: dto.type,
      planId: dto.planId,
      smsPackageId: dto.smsPackageId,
    });
  }

  @Get('billing/payments/:id')
  getPayment(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    this.ensureOrgOwner(user);
    return this.payments.getForOrg(organizationIdOf(user), id);
  }

  @Post('billing/payments/:id/submit')
  submitPayment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SubmitPaymentDto,
  ) {
    this.ensureOrgOwner(user);
    return this.payments.submit(organizationIdOf(user), id, dto);
  }

  @Get('sms/balance')
  async balance(@CurrentUser() user: AuthUser) {
    this.ensureOrgOwner(user);
    return this.wallet.stats(organizationIdOf(user));
  }

  @Get('sms/transactions')
  transactions(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    this.ensureOrgOwner(user);
    return this.wallet.listTransactions(organizationIdOf(user), page, pageSize);
  }

  @Get('sms/packages')
  packagesList(@CurrentUser() user: AuthUser) {
    this.ensureOrgOwner(user);
    return this.packages.list(true);
  }

  @Post('sms/packages/:id/purchase')
  buy(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    this.ensureOrgOwner(user);
    return this.payments.createSmsPackage(organizationIdOf(user), id);
  }

  private ensureOrgOwner(user: AuthUser) {
    if (!user.orgOwner) {
      throw new ForbiddenException('Только владелец сети управляет подпиской и SMS');
    }
  }
}
