import { IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { BillingPeriod, PaymentMethod, PaymentType } from '@prisma/client';

export class UpsertPlanDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsEnum(BillingPeriod)
  billingPeriod?: BillingPeriod;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxSalons?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxEmployees?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  includedSms?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsIn(['basic', 'extended', 'network'])
  statsLevel?: 'basic' | 'extended' | 'network';

  @IsOptional()
  @IsIn(['none', 'salon', 'extended'])
  auditLevel?: 'none' | 'salon' | 'extended';

  @IsOptional()
  @IsBoolean()
  canExport?: boolean;

  @IsOptional()
  @IsBoolean()
  advancedRoles?: boolean;

  @IsOptional()
  @IsBoolean()
  apiAccess?: boolean;

  @IsOptional()
  @IsBoolean()
  prioritySupport?: boolean;

  @IsOptional()
  @IsBoolean()
  recommended?: boolean;
}

export class CreatePlanDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  price: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsEnum(BillingPeriod)
  billingPeriod?: BillingPeriod;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxSalons: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxEmployees: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  includedSms: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsIn(['basic', 'extended', 'network'])
  statsLevel?: 'basic' | 'extended' | 'network';

  @IsOptional()
  @IsIn(['none', 'salon', 'extended'])
  auditLevel?: 'none' | 'salon' | 'extended';

  @IsOptional()
  @IsBoolean()
  canExport?: boolean;

  @IsOptional()
  @IsBoolean()
  advancedRoles?: boolean;

  @IsOptional()
  @IsBoolean()
  apiAccess?: boolean;

  @IsOptional()
  @IsBoolean()
  prioritySupport?: boolean;

  @IsOptional()
  @IsBoolean()
  recommended?: boolean;
}

export class UpsertSmsPackageDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  smsCount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateSmsPackageDto {
  @IsString()
  @MinLength(1)
  name: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  smsCount: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  price: number;

  @IsOptional()
  @IsString()
  currency?: string;
}

export class AssignPlanDto {
  @IsString()
  planId: string;
}

export class AdjustSmsDto {
  @Type(() => Number)
  @IsInt()
  amount: number;

  @IsString()
  @MinLength(2)
  reason: string;
}

export class StatusDto {
  @IsBoolean()
  isActive: boolean;
}

export class CreatePaymentDto {
  @IsIn(['SUBSCRIPTION', 'SMS_PACKAGE'])
  type: PaymentType;

  @IsOptional()
  @IsString()
  planId?: string;

  @IsOptional()
  @IsString()
  smsPackageId?: string;
}

export class SubmitPaymentDto {
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  payerName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}$/, { message: 'Нужны ровно 4 последние цифры карты' })
  cardLast4?: string;
}

export class RejectPaymentDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}

export class SetPaymentStatusDto {
  @IsIn(['PENDING', 'WAITING_CONFIRMATION', 'REJECTED'])
  status: 'PENDING' | 'WAITING_CONFIRMATION' | 'REJECTED';

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason?: string;
}

export class UpdatePaymentSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  clickInstructions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  clickAccount?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  cardInstructions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  cardNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  cardOwner?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(168)
  paymentExpireHours?: number;

  @IsOptional()
  @IsBoolean()
  clickEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  cardEnabled?: boolean;
}
