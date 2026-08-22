import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SmsService } from './sms.service';
import { PlatformSmsService } from '../billing/platform-sms.service';
import { TelegramService } from '../telegram/telegram.service';
import { MessageTemplatesService } from '../settings/message-templates.service';
import {
  firstNameOf,
  prepareSms,
  renderTemplate,
} from '../common/template';

@Injectable()
export class WelcomeSmsService {
  private readonly logger = new Logger(WelcomeSmsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
    private readonly wallet: PlatformSmsService,
    private readonly telegram: TelegramService,
    private readonly catalog: MessageTemplatesService,
  ) {}

  @OnEvent('client.created')
  async onClientCreated(payload: {
    phone: string;
    fullName: string;
    opticsId: string;
    clientId: string;
  }) {
    try {
      await this.maybeSend(payload);
    } catch (err) {
      this.logger.warn(
        `Приветствие не ушло: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  private async maybeSend(payload: {
    phone: string;
    fullName: string;
    opticsId: string;
    clientId: string;
  }) {
    const phone = payload.phone.trim();
    if (!phone) return;
    const older = await this.prisma.client.findFirst({
      where: { phone, id: { not: payload.clientId } },
      select: { id: true },
    });
    if (older) {
      await this.prisma.productPhone.upsert({
        where: { phone },
        create: { phone, welcomedAt: new Date() },
        update: {},
      });
      return;
    }
    const claimed = await this.claim(phone);
    if (!claimed) return;

    const tpl = await this.catalog.welcome();
    const link =
      (await this.wallet.config()).botLink.trim() || this.telegram.botLink();
    const firstName = firstNameOf(payload.fullName);
    const settings = await this.prisma.settings.findUnique({
      where: { opticsId: payload.opticsId },
      select: { messageLang: true },
    });
    const lang = settings?.messageLang === 'uz' ? 'uz' : 'ru';
    const raw =
      lang === 'uz'
        ? (tpl?.smsUz || tpl?.bodyUz || '').trim()
        : (tpl?.smsRu || tpl?.bodyRu || '').trim();
    if (!raw) {
      await this.release(phone);
      return;
    }
    const prefs = await this.wallet.prefs();
    const text = prepareSms(
      renderTemplate(raw, { firstName, fullName: payload.fullName, link }),
      prefs.smsCharLimit,
      { toLatin: prefs.smsToLatin, keepSuffix: link, lang },
    );
    if (!text) {
      await this.release(phone);
      return;
    }

    const optics = await this.prisma.optics.findUnique({
      where: { id: payload.opticsId },
      select: { organizationId: true, name: true },
    });
    try {
      await this.wallet.debit(1, `Приветствие · ${optics?.name || ''} ${phone}`, {
        kind: 'welcome',
        organizationId: optics?.organizationId,
      });
    } catch (err) {
      await this.release(phone);
      throw err;
    }

    try {
      await this.sms.send(phone, text);
      await this.prisma.productPhone.update({
        where: { phone },
        data: { welcomedAt: new Date() },
      });
    } catch (err) {
      await this.wallet.credit(1, `Возврат: приветствие ${phone} не отправилось`, {
        kind: 'welcome',
        organizationId: optics?.organizationId,
      });
      await this.release(phone);
      throw err;
    }
  }

  private async claim(phone: string) {
    try {
      await this.prisma.productPhone.create({ data: { phone } });
      return true;
    } catch (err) {
      if (
        !(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')
      ) {
        throw err;
      }
      const row = await this.prisma.productPhone.findUnique({ where: { phone } });
      return !!row && !row.welcomedAt;
    }
  }

  private release(phone: string) {
    return this.prisma.productPhone.deleteMany({
      where: { phone, welcomedAt: null },
    });
  }
}
