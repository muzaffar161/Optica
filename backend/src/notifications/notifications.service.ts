import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { TelegramService } from '../telegram/telegram.service';
import { SmsService } from './sms.service';
import { SmsWalletService } from '../billing/sms-wallet.service';
import { renderTemplate, firstNameOf, moneyVars, withPaymentPlaceholders, publicPlace, langsOf, attachRxPlaceholder, pickSmsBody, prepareSms } from '../common/template';
import { formatRxBody, formatRxTitle, parseRxJson } from '../common/rx';
import { MessageTemplatesService } from '../settings/message-templates.service';
import { pageParams } from '../common/pagination';
import { PlatformSmsService } from '../billing/platform-sms.service';
import {
  archiveCutoff,
  archiveData,
  archivedWhere,
  currentArchiveWhere,
  isArchivedRow,
} from '../common/archive';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly telegram: TelegramService,
    private readonly sms: SmsService,
    private readonly wallet: SmsWalletService,
    private readonly events: EventEmitter2,
    private readonly catalog: MessageTemplatesService,
    private readonly platformSms: PlatformSmsService,
  ) {}

  async findAll(
    opticsId: string,
    page?: string,
    pageSize?: string,
    archive?: string,
  ) {
    const settings = await this.prisma.settings.findUnique({
      where: { opticsId },
      select: { archiveAfterDays: true },
    });
    const cutoff = archiveCutoff(settings?.archiveAfterDays);
    const inArchive = archive === '1' || archive === 'true';
    const where = {
      opticsId,
      ...(inArchive ? archivedWhere(cutoff) : currentArchiveWhere(cutoff)),
    };
    const { page: p, take, skip } = pageParams(page, pageSize);
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          order: { include: { client: true } },
        },
      }),
      this.prisma.notification.count({ where }),
    ]);
    return {
      items: items.map((item) => ({
        ...item,
        archived: isArchivedRow(item, cutoff),
      })),
      total,
      page: p,
      pageSize: take,
      archive: inArchive,
      archiveAfterDays: settings?.archiveAfterDays ?? 10,
    };
  }

  async setArchived(opticsId: string, id: string, archived: boolean) {
    const row = await this.prisma.notification.findFirst({
      where: { id, opticsId },
    });
    if (!row) {
      return null;
    }
    return this.prisma.notification.update({
      where: { id },
      data: archiveData(archived),
      include: { order: { include: { client: true } } },
    });
  }

  async notifyOrderReady(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { client: true, optics: { select: { organizationId: true } } },
    });
    if (!order) {
      this.logger.warn(`Заказ ${orderId} не найден для уведомления`);
      return { ok: false };
    }

    const settings = await this.settings.get(order.opticsId);
    const rx = parseRxJson(order.rxJson);
    const lens = rx?.lens?.trim() ?? '';
    const frame = rx?.frame?.trim() ?? '';
    const rxText = rx ? formatRxBody(rx) : '';
    const tpl = settings.templateId
      ? await this.prisma.messageTemplate.findUnique({ where: { id: settings.templateId } })
      : await this.catalog.defaultRow();
    const pay = moneyVars(order.amount, order.paidAmount);
    const vars = {
      fullName: order.client.fullName,
      firstName: firstNameOf(order.client.fullName),
      orderTitle: rx ? formatRxTitle(rx, order.amount) || order.title : order.title,
      rx: rxText,
      lens,
      frame,
      ...pay,
      address: publicPlace(settings.address),
      opticsName: settings.opticsName,
      landmark: publicPlace(settings.landmark),
      hours: settings.hours || '',
      phone: settings.phone || '',
    };
    const telegram: string[] = [];
    const sms: string[] = [];
    const prefs = await this.platformSms.prefs();
    for (const lang of langsOf(settings.messageLang)) {
      let body =
        lang === 'uz'
          ? (tpl?.bodyUz || '').trim()
          : (tpl?.bodyRu || settings.template || '').trim();
      if (!body && lang === 'uz') continue;
      if (!body) body = settings.template;
      body = attachRxPlaceholder(body, rxText);
      body = withPaymentPlaceholders(body, order.paidAmount, lang);
      const text = renderTemplate(body, vars);
      const smsBody = pickSmsBody(tpl, lang, settings.template);
      const smsOpts = {
        toLatin: prefs.smsToLatin,
        lang,
        truncate: !prefs.smsViaDevice,
      } as const;
      const smsText = smsBody
        ? prepareSms(renderTemplate(smsBody, vars), prefs.smsCharLimit, smsOpts)
        : prepareSms(text, prefs.smsCharLimit, smsOpts);
      if (!text && !smsText) continue;
      telegram.push(text || smsText);
      sms.push(smsText || text);
    }
    if (!telegram.length && !sms.length) {
      this.logger.warn(`Пустой шаблон для заказа ${orderId}`);
      return { ok: false };
    }

    const result = await this.deliver({
      opticsId: order.opticsId,
      organizationId: order.optics.organizationId,
      client: order.client,
      orderId,
      messages: telegram,
      smsMessages: sms,
      kind: 'order',
      allowDevice: true,
      smsDescription:
        sms.length > 1
          ? `SMS клиенту ${order.client.fullName} (2)`
          : `SMS клиенту ${order.client.fullName}`,
    });
    if (result.ok) {
      await this.markNotified(orderId);
    }
    return result;
  }

  async deliver(opts: {
    opticsId: string;
    organizationId: string;
    client: {
      fullName: string;
      phone: string;
      telegramChatId: string | null;
    };
    orderId: string;
    message?: string;
    messages?: string[];
    smsMessages?: string[];
    kind?: string;
    smsDescription?: string;
    allowDevice?: boolean;
  }): Promise<{ ok: boolean; deviceSms?: { phone: string; messages: string[] }; smsSkipped?: boolean }> {
    const kind = opts.kind || 'order';
    const telegram = (opts.messages?.length ? opts.messages : opts.message ? [opts.message] : [])
      .map((row) => row.trim())
      .filter(Boolean);
    const smsTexts = (opts.smsMessages?.length ? opts.smsMessages : telegram)
      .map((row) => row.trim())
      .filter(Boolean);
    if (!telegram.length && !smsTexts.length) return { ok: false };
    const chatId = opts.client.telegramChatId;
    let remaining = smsTexts;
    if (chatId && telegram.length) {
      let sentTg = 0;
      for (const text of telegram) {
        const tg = await this.telegram.sendMessage(chatId, text);
        if (tg.ok) {
          await this.log({
            opticsId: opts.opticsId,
            orderId: opts.orderId,
            kind,
            channel: 'telegram',
            status: 'sent',
            message: text,
          });
          this.trackNotify(opts, 'telegram', true, kind);
          sentTg += 1;
        } else {
          await this.log({
            opticsId: opts.opticsId,
            orderId: opts.orderId,
            kind,
            channel: 'telegram',
            status: 'failed',
            message: text,
            error: tg.error,
          });
          this.logger.warn(
            `Telegram не доставлен (${tg.blocked ? 'бот заблокирован' : tg.error}) — fallback на SMS`,
          );
          break;
        }
      }
      if (sentTg === telegram.length) return { ok: true };
      remaining = smsTexts.slice(sentTg);
    }
    if (!remaining.length) return { ok: true };

    const prefs = await this.platformSms.prefs();
    if (prefs.smsViaDevice) {
      if (!opts.allowDevice) {
        return { ok: false, smsSkipped: true };
      }
      for (const text of remaining) {
        await this.log({
          opticsId: opts.opticsId,
          orderId: opts.orderId,
          kind,
          channel: 'sms',
          status: 'mocked',
          message: text,
        });
      }
      this.trackNotify(opts, 'sms', true, kind);
      return {
        ok: true,
        deviceSms: { phone: opts.client.phone, messages: remaining },
      };
    }

    const cost = remaining.length;
    let debitId: string | null = null;
    try {
      const debit = await this.wallet.debit({
        organizationId: opts.organizationId,
        amount: cost,
        type: 'MESSAGE_SENT',
        description: opts.smsDescription || `SMS клиенту ${opts.client.fullName}`,
      });
      debitId = debit.transaction.id;
    } catch (err) {
      const reason =
        err instanceof Error ? err.message : 'Недостаточно SMS на балансе';
      await this.log({
        opticsId: opts.opticsId,
        orderId: opts.orderId,
        kind,
        channel: 'sms',
        status: 'failed',
        message: remaining.join('\n'),
        error: reason,
      });
      this.logger.warn(`SMS не отправлено: ${reason}`);
      this.trackNotify(opts, 'sms', false, kind);
      return { ok: false };
    }

    let sent = 0;
    try {
      for (const text of remaining) {
        await this.sms.send(opts.client.phone, text);
        const logged = await this.log({
          opticsId: opts.opticsId,
          orderId: opts.orderId,
          kind,
          channel: 'sms',
          status: 'mocked',
          message: text,
        });
        if (debitId && sent === 0) {
          await this.prisma.smsTransaction.update({
            where: { id: debitId },
            data: { notificationId: logged.id },
          });
        }
        sent += 1;
      }
    } catch (err) {
      const leftover = cost - sent;
      if (leftover > 0) {
        await this.wallet.credit({
          organizationId: opts.organizationId,
          amount: leftover,
          type: 'REFUND',
          description: 'Возврат: SMS не отправилось',
        });
      }
      await this.log({
        opticsId: opts.opticsId,
        orderId: opts.orderId,
        kind,
        channel: 'sms',
        status: 'failed',
        message: remaining.join('\n'),
        error: err instanceof Error ? err.message : 'Ошибка SMS',
      });
      this.trackNotify(opts, 'sms', false, kind);
      return { ok: sent > 0 };
    }
    this.trackNotify(opts, 'sms', true, kind);
    return { ok: true };
  }

  private trackNotify(
    opts: { opticsId: string; organizationId: string },
    channel: 'telegram' | 'sms',
    ok: boolean,
    kind: string,
  ) {
    this.events.emit('usage.track', {
      name: 'notify',
      meta: { channel, ok, kind },
      opticsId: opts.opticsId,
      organizationId: opts.organizationId,
    });
  }

  private markNotified(orderId: string) {
    return this.prisma.order.update({
      where: { id: orderId },
      data: { notifiedAt: new Date() },
    });
  }

  private log(data: {
    opticsId: string;
    orderId: string;
    kind?: string;
    channel: 'telegram' | 'sms';
    status: 'sent' | 'mocked' | 'failed';
    message: string;
    error?: string;
  }) {
    return this.prisma.notification.create({ data });
  }
}
