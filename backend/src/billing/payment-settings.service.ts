import { BadRequestException, Injectable } from '@nestjs/common';
import { PaymentMethod } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { deleteUpload, savePlatformImage, type UploadedImage } from '../uploads/upload';
import { personName } from '../common/person-name';
import { toE164 } from '../common/phone';

export type PaymentSettings = {
  clickInstructions: string;
  clickQrPath: string;
  clickAccount: string;
  cardInstructions: string;
  cardNumber: string;
  cardOwner: string;
  paymentExpireHours: number;
  clickEnabled: boolean;
  cardEnabled: boolean;
  adminAlertPhone: string;
  adminAlertVia: 'auto' | 'sms' | 'telegram';
  adminTelegramLinked: boolean;
};

const DEFAULTS: PaymentSettings = {
  clickInstructions: 'Оплатите сумму через Click. В комментарии укажите номер платежа.',
  clickQrPath: '',
  clickAccount: '',
  cardInstructions: 'Переведите сумму на карту. В назначении платежа укажите номер платежа.',
  cardNumber: '',
  cardOwner: '',
  paymentExpireHours: 24,
  clickEnabled: true,
  cardEnabled: true,
  adminAlertPhone: '',
  adminAlertVia: 'auto',
  adminTelegramLinked: false,
};

@Injectable()
export class PaymentSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<PaymentSettings> {
    const row = await this.prisma.platformConfig.findUnique({
      where: { id: 'default' },
    });
    if (!row) return { ...DEFAULTS };
    return {
      clickInstructions: row.clickInstructions || DEFAULTS.clickInstructions,
      clickQrPath: row.clickQrPath,
      clickAccount: row.clickAccount,
      cardInstructions: row.cardInstructions || DEFAULTS.cardInstructions,
      cardNumber: row.cardNumber,
      cardOwner: row.cardOwner,
      paymentExpireHours: row.paymentExpireHours || 24,
      clickEnabled: row.clickEnabled,
      cardEnabled: row.cardEnabled,
      adminAlertPhone: row.adminAlertPhone || '',
      adminAlertVia: parseVia(row.adminAlertVia),
      adminTelegramLinked: Boolean(row.adminTelegramChatId?.trim()),
    };
  }

  isMethodEnabled(settings: PaymentSettings, method: PaymentMethod) {
    if (method === 'CLICK') return settings.clickEnabled;
    if (method === 'CARD_TRANSFER') return settings.cardEnabled;
    return false;
  }

  assertMethodEnabled(settings: PaymentSettings, method: PaymentMethod) {
    if (!this.isMethodEnabled(settings, method)) {
      throw new BadRequestException('Этот способ оплаты сейчас выключен');
    }
  }

  async publicView() {
    const settings = await this.get();
    const { adminAlertPhone: _p, adminAlertVia: _v, adminTelegramLinked: _l, ...rest } =
      settings;
    return rest;
  }

  async update(dto: Partial<PaymentSettings>, qr?: UploadedImage | null) {
    const current = await this.get();
    let clickQrPath = current.clickQrPath;
    if (qr) {
      deleteUpload(clickQrPath);
      clickQrPath = savePlatformImage('click-qr', qr);
    }
    const hours = dto.paymentExpireHours;
    const clickEnabled = dto.clickEnabled ?? current.clickEnabled;
    const cardEnabled = dto.cardEnabled ?? current.cardEnabled;
    if (!clickEnabled && !cardEnabled) {
      throw new BadRequestException('Включите хотя бы один способ оплаты');
    }
    const nextPhone =
      dto.adminAlertPhone != null ? parseAlertPhone(dto.adminAlertPhone) : null;
    await this.prisma.platformConfig.update({
      where: { id: 'default' },
      data: {
        clickInstructions: dto.clickInstructions ?? current.clickInstructions,
        clickAccount: dto.clickAccount ?? current.clickAccount,
        clickQrPath,
        cardInstructions: dto.cardInstructions ?? current.cardInstructions,
        cardNumber: dto.cardNumber ?? current.cardNumber,
        cardOwner:
          dto.cardOwner != null ? personName(dto.cardOwner) : current.cardOwner,
        paymentExpireHours:
          typeof hours === 'number'
            ? Math.min(168, Math.max(1, hours))
            : current.paymentExpireHours,
        clickEnabled,
        cardEnabled,
        ...(dto.adminAlertVia != null ? { adminAlertVia: parseVia(dto.adminAlertVia) } : {}),
        ...(nextPhone != null
          ? {
              adminAlertPhone: nextPhone,
              ...(nextPhone !== current.adminAlertPhone ? { adminTelegramChatId: '' } : {}),
            }
          : {}),
      },
    });
    return this.get();
  }
}

function parseVia(value?: string | null): 'auto' | 'sms' | 'telegram' {
  if (value === 'sms' || value === 'telegram') return value;
  return 'auto';
}

function parseAlertPhone(raw: string) {
  const text = raw.trim();
  if (!text) return '';
  const phone = toE164(text);
  if (!phone) {
    throw new BadRequestException('Проверьте номер для SMS-заявок');
  }
  return phone;
}
