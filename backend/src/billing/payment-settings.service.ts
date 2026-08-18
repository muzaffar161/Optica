import { BadRequestException, Injectable } from '@nestjs/common';
import { PaymentMethod } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { deleteUpload, savePlatformImage, type UploadedImage } from '../uploads/upload';
import { personName } from '../common/person-name';

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
    return settings;
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
      },
    });
    return this.get();
  }
}
