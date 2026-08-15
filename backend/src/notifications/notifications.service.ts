import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { TelegramService } from '../telegram/telegram.service';
import { SmsService } from './sms.service';
import { SmsWalletService } from '../billing/sms-wallet.service';
import { renderTemplate, firstNameOf, formatAmount } from '../common/template';
import { formatRxBody, formatRxTitle, parseRxJson } from '../common/rx';
import { pageParams } from '../common/pagination';
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
  ) {}

  @OnEvent('order.ready')
  async onOrderReady(payload: { orderId: string }) {
    await this.notifyOrderReady(payload.orderId);
  }

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
      return;
    }

    const settings = await this.settings.get(order.opticsId);
    const rx = parseRxJson(order.rxJson);
    const lens = rx?.lens?.trim() ?? '';
    const frame = rx?.frame?.trim() ?? '';
    const rxText = rx ? formatRxBody(rx) : '';
    let template = settings.template;
    if (rxText && !template.includes('{rx}') && !template.includes('{orderTitle}')) {
      template = template.includes('Линза:')
        ? template.replace('Линза:', 'Рецепт:\n{rx}\nЛинза:')
        : `${template}\n\n{rx}`;
    }
    const message = renderTemplate(template, {
      fullName: order.client.fullName,
      firstName: firstNameOf(order.client.fullName),
      orderTitle: rx ? formatRxTitle(rx, order.amount) || order.title : order.title,
      rx: rxText,
      lens,
      frame,
      amount: formatAmount(order.amount),
      address: settings.address,
      opticsName: settings.opticsName,
      landmark: settings.landmark,
      hours: settings.hours || '',
      phone: settings.phone || '',
    });

    const chatId = order.client.telegramChatId;
    if (chatId) {
      const tg = await this.telegram.sendMessage(chatId, message);
      if (tg.ok) {
        await this.log({
          opticsId: order.opticsId,
          orderId,
          channel: 'telegram',
          status: 'sent',
          message,
        });
        await this.markNotified(orderId);
        return;
      }
      await this.log({
        opticsId: order.opticsId,
        orderId,
        channel: 'telegram',
        status: 'failed',
        message,
        error: tg.error,
      });
      this.logger.warn(
        `Telegram не доставлен (${tg.blocked ? 'бот заблокирован' : tg.error}) — fallback на SMS`,
      );
    }

    const orgId = order.optics.organizationId;
    let debitId: string | null = null;
    try {
      const debit = await this.wallet.debit({
        organizationId: orgId,
        amount: 1,
        type: 'MESSAGE_SENT',
        description: `SMS клиенту ${order.client.fullName}`,
      });
      debitId = debit.transaction.id;
    } catch (err) {
      const reason =
        err instanceof Error ? err.message : 'Недостаточно SMS на балансе';
      await this.log({
        opticsId: order.opticsId,
        orderId,
        channel: 'sms',
        status: 'failed',
        message,
        error: reason,
      });
      this.logger.warn(`SMS не отправлено: ${reason}`);
      return;
    }

    try {
      await this.sms.send(order.client.phone, message);
    } catch (err) {
      await this.wallet.credit({
        organizationId: orgId,
        amount: 1,
        type: 'REFUND',
        description: 'Возврат: SMS не отправилось',
      });
      await this.log({
        opticsId: order.opticsId,
        orderId,
        channel: 'sms',
        status: 'failed',
        message,
        error: err instanceof Error ? err.message : 'Ошибка SMS',
      });
      return;
    }

    const logged = await this.log({
      opticsId: order.opticsId,
      orderId,
      channel: 'sms',
      status: 'mocked',
      message,
    });
    if (debitId) {
      await this.prisma.smsTransaction.update({
        where: { id: debitId },
        data: { notificationId: logged.id },
      });
    }
    await this.markNotified(orderId);
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
    channel: 'telegram' | 'sms';
    status: 'sent' | 'mocked' | 'failed';
    message: string;
    error?: string;
  }) {
    return this.prisma.notification.create({ data });
  }
}
