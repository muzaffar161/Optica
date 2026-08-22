import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { SmsService } from './sms.service';
import { PlatformSmsService } from '../billing/platform-sms.service';
import { TelegramService } from '../telegram/telegram.service';
import { prepareSms } from '../common/template';

type AlertVia = 'auto' | 'sms' | 'telegram';

type PaymentAlert = {
  kind: 'created' | 'submitted';
  payment: {
    paymentNumber: string;
    amount: number;
    purpose: string;
    paymentMethod: 'CLICK' | 'CARD_TRANSFER' | null;
    payerName: string | null;
    cardLast4: string | null;
    organization?: { name: string } | null;
  };
};

@Injectable()
export class PaymentAlertService {
  private readonly logger = new Logger(PaymentAlertService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
    private readonly pot: PlatformSmsService,
    private readonly telegram: TelegramService,
  ) {}

  @OnEvent('payment.alert')
  async onPayment(payload: PaymentAlert) {
    const row = await this.prisma.platformConfig.findUnique({
      where: { id: 'default' },
      select: {
        adminAlertPhone: true,
        adminAlertVia: true,
        adminTelegramChatId: true,
      },
    });
    const phone = row?.adminAlertPhone?.trim() || '';
    const chatId = row?.adminTelegramChatId?.trim() || '';
    const via = parseVia(row?.adminAlertVia);
    if (!phone && !chatId) return;

    const text = formatAlert(payload);
    const wantTg = via !== 'sms' && Boolean(chatId);
    const wantSms = via !== 'telegram' && Boolean(phone);

    if (wantTg) {
      const sent = await this.telegram.sendMessage(chatId, text);
      if (sent.ok) return;
      this.logger.warn(`Заявка не ушла в Telegram: ${sent.error}`);
      if (via === 'telegram' || !wantSms) return;
    }

    if (!wantSms) return;
    const prefs = await this.pot.prefs();
    const smsText = prepareSms(text, prefs.smsCharLimit, {
      toLatin: prefs.smsToLatin,
      lang: 'ru',
    });
    if (!smsText) return;
    const sent = await this.sms.send(phone, smsText);
    if (!sent.ok) {
      this.logger.warn(`Заявка не ушла SMS на ${phone}`);
    }
  }
}

function parseVia(value?: string | null): AlertVia {
  if (value === 'sms' || value === 'telegram') return value;
  return 'auto';
}

function formatAlert(payload: PaymentAlert) {
  const p = payload.payment;
  const org = p.organization?.name || 'Салон';
  const sum = `${p.amount.toLocaleString('ru-RU')} сум`;
  if (payload.kind === 'created') {
    return `Заявка: ${org}. ${p.purpose}, ${sum}. № ${p.paymentNumber}`;
  }
  const method =
    p.paymentMethod === 'CLICK'
      ? 'Click'
      : p.paymentMethod === 'CARD_TRANSFER'
        ? 'карта'
        : 'перевод';
  const extra = [p.payerName, p.cardLast4 ? `*${p.cardLast4}` : '']
    .filter(Boolean)
    .join(' ');
  return `Проверка: ${org}. ${p.purpose}, ${sum}, ${method}${extra ? `, ${extra}` : ''}. № ${p.paymentNumber}`;
}
