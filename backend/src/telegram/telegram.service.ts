import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, GrammyError, Keyboard, type Context } from 'grammy';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { normalizePhone } from '../common/phone';
import { formatRxBody, formatRxTitle, parseRxJson } from '../common/rx';
import {
  findTemplatePreset,
  firstNameOf,
  moneyVars,
  publicPlace,
  renderTemplate,
  withPaymentPlaceholders,
} from '../common/template';

export type TelegramSendResult = {
  ok: boolean;
  blocked?: boolean;
  error?: string;
};

const BTN_STATUS = 'Статус';
const BTN_MESSAGES = 'Сообщения';
const BTN_SMS = 'СМС';
const BTN_INBOX = 'Входящие';

const STATUS_GREET: Record<string, string> = {
  new: '{firstName}, заказ принят.',
  in_progress: '{firstName}, заказ в работе.',
  ready: '{firstName}, ваш заказ готов!',
  picked_up: '{firstName}, заказ выдан.',
  cancelled: '{firstName}, заказ отменён.',
};

const LIVE_CARD = `{firstName}, заказ принят.

Рецепт:
{rx}
Линза: {lens}
Оправа: {frame}
Итог: {total}
Оплачено: {paid}
К оплате: {amount}

Когда заказ будет готов — напишем сюда.`;

const RATE_MS = 4000;
const WARN_MS = 8000;

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private bot?: Bot;
  private username = '';
  private readonly lastHit = new Map<string, number>();
  private readonly lastWarn = new Map<string, number>();

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async onModuleInit() {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN')?.trim();
    if (!token) {
      this.logger.warn(
        'TELEGRAM_BOT_TOKEN не задан — бот не запущен, уведомления уйдут в SMS',
      );
      return;
    }

    this.bot = new Bot(token);
    this.setupHandlers();
    void this.bot.start({
      onStart: (info) => {
        this.username = info.username || '';
        this.logger.log(`Telegram-бот @${info.username} запущен`);
      },
    });
  }

  async onModuleDestroy() {
    if (this.bot) {
      await this.bot.stop();
    }
  }

  botLink() {
    if (this.username) return `https://t.me/${this.username}`;
    return '';
  }

  async sendMessage(chatId: string, text: string): Promise<TelegramSendResult> {
    if (!this.bot) {
      return {
        ok: false,
        blocked: false,
        error: 'Бот не запущен (нет TELEGRAM_BOT_TOKEN)',
      };
    }
    try {
      await this.bot.api.sendMessage(chatId, text);
      return { ok: true };
    } catch (error) {
      if (error instanceof GrammyError) {
        const blocked =
          error.error_code === 403 ||
          /blocked by the user/i.test(error.description);
        return { ok: false, blocked, error: error.description };
      }
      return { ok: false, blocked: false, error: String(error) };
    }
  }

  private phoneKeyboard() {
    return new Keyboard()
      .requestContact('Отправить номер телефона')
      .resized()
      .oneTime();
  }

  private menuKeyboard() {
    return new Keyboard()
      .text(BTN_STATUS)
      .text(BTN_MESSAGES)
      .resized()
      .persistent();
  }

  private setupHandlers() {
    const bot = this.bot;
    if (!bot) return;

    bot.command('start', async (ctx) => {
      if (await this.tooFast(ctx)) return;
      const clients = await this.clientsByChat(ctx);
      if (clients.length > 0) {
        await ctx.reply(
          `Здравствуйте, ${clients[0].fullName}! «Статус» — текущий заказ, «Сообщения» — то, что присылал салон.`,
          { reply_markup: this.menuKeyboard() },
        );
        return;
      }
      await ctx.reply(
        'Здравствуйте! Чтобы получать уведомления и смотреть заказ, поделитесь номером телефона — тем же, который оставили в оптике.',
        { reply_markup: this.phoneKeyboard() },
      );
    });

    bot.on('message:contact', async (ctx) => {
      const contact = ctx.message.contact;
      if (!ctx.from || contact.user_id !== ctx.from.id) {
        await ctx.reply('Пожалуйста, отправьте свой собственный номер телефона.');
        return;
      }

      const phone = normalizePhone(contact.phone_number);
      const chatId = String(ctx.chat.id);
      const clients = await this.prisma.client.findMany({ where: { phone } });

      if (clients.length === 0) {
        await ctx.reply(
          `Номер ${phone} не найден в базе оптики. Оставьте этот номер в салоне при заказе — после этого напишите /start ещё раз.`,
          { reply_markup: this.phoneKeyboard() },
        );
        return;
      }

      await this.prisma.client.updateMany({
        where: { phone },
        data: { telegramChatId: chatId },
      });

      await ctx.reply(
        `Спасибо, ${clients[0].fullName}! Вы подписаны. «Статус» — текущий заказ, «Сообщения» — то, что присылал салон.`,
        { reply_markup: this.menuKeyboard() },
      );
    });

    bot.hears(BTN_STATUS, async (ctx) => {
      if (await this.tooFast(ctx)) return;
      const clients = await this.requireClients(ctx);
      if (!clients) return;
      const orders = await this.prisma.order.findMany({
        where: {
          clientId: { in: clients.map((c) => c.id) },
          archived: false,
          status: { in: ['new', 'in_progress', 'ready'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { client: { select: { fullName: true } } },
      });
      if (orders.length === 0) {
        await ctx.reply(
          'Сейчас нет заказов в работе. Когда заберёте — статус пропадёт. Новый заказ снова появится здесь.',
          { reply_markup: this.menuKeyboard() },
        );
        return;
      }
      if (orders.length > 1) {
        await ctx.reply(`Сейчас заказов: ${orders.length}. Каждый — отдельным сообщением.`, {
          reply_markup: this.menuKeyboard(),
        });
      }
      for (const [index, order] of orders.entries()) {
        const body = await this.orderCard(order);
        const head =
          orders.length > 1 ? `Заказ ${index + 1} из ${orders.length}\n\n` : '';
        await ctx.reply(head + body, { reply_markup: this.menuKeyboard() });
      }
    });

    bot.hears([BTN_MESSAGES, BTN_INBOX, BTN_SMS], async (ctx) => {
      if (await this.tooFast(ctx)) return;
      const clients = await this.requireClients(ctx);
      if (!clients) return;
      const rows = await this.inboxFor(clients.map((c) => c.id));
      if (rows.length === 0) {
        await ctx.reply('Сообщений от салона пока не было.', {
          reply_markup: this.menuKeyboard(),
        });
        return;
      }
      for (const row of rows) {
        await ctx.reply(this.formatInbox(row), {
          reply_markup: this.menuKeyboard(),
        });
      }
    });

    bot.on('message:text', async (ctx) => {
      const text = ctx.message.text?.trim() ?? '';
      if (!text || text.startsWith('/')) return;
      if ([BTN_STATUS, BTN_MESSAGES, BTN_SMS, BTN_INBOX].includes(text)) return;
      if (await this.tooFast(ctx)) return;
      await ctx.reply(
        'Нажмите «Статус» — там текущий заказ. «Сообщения» — то, что присылал салон.',
        { reply_markup: this.menuKeyboard() },
      );
    });

    bot.catch((err) => {
      this.logger.error(`Ошибка бота: ${err.message}`, err.stack);
    });
  }

  private async tooFast(ctx: Context) {
    const id = ctx.chat ? String(ctx.chat.id) : '';
    if (!id) return false;
    const now = Date.now();
    const last = this.lastHit.get(id) ?? 0;
    if (now - last < RATE_MS) {
      const warned = this.lastWarn.get(id) ?? 0;
      if (now - warned > WARN_MS) {
        this.lastWarn.set(id, now);
        await ctx.reply('Подождите пару секунд.', {
          reply_markup: this.menuKeyboard(),
        });
      }
      return true;
    }
    this.lastHit.set(id, now);
    if (this.lastHit.size > 2000) {
      this.lastHit.clear();
      this.lastWarn.clear();
      this.lastHit.set(id, now);
    }
    return false;
  }

  private async clientsByChat(ctx: Context) {
    const chatId = ctx.chat ? String(ctx.chat.id) : '';
    if (!chatId) return [];
    return this.prisma.client.findMany({
      where: { telegramChatId: chatId },
      select: { id: true, fullName: true },
    });
  }

  private async requireClients(ctx: Context) {
    const clients = await this.clientsByChat(ctx);
    if (clients.length > 0) return clients;
    await ctx.reply(
      'Сначала поделитесь номером телефона — тем же, что оставили в оптике.',
      { reply_markup: this.phoneKeyboard() },
    );
    return null;
  }

  private async orderCard(order: {
    opticsId: string;
    title: string;
    amount: number | null;
    paidAmount?: number | null;
    rxJson: string | null;
    status: string;
    client: { fullName: string };
  }) {
    const settings = await this.settings.get(order.opticsId);
    const rx = parseRxJson(order.rxJson);
    const rxText = rx ? formatRxBody(rx) : '';
    const ready = order.status === 'ready';
    const card = ready ? (findTemplatePreset('card')?.body ?? '') : LIVE_CARD;
    const greet = STATUS_GREET[order.status] || STATUS_GREET.ready;
    const template = withPaymentPlaceholders(
      card.replace('{firstName}, ваш заказ готов!', greet).replace(
        '{firstName}, заказ принят.',
        greet,
      ),
      order.paidAmount,
    );
    const pay = moneyVars(order.amount, order.paidAmount);
    return renderTemplate(template, {
      fullName: order.client.fullName,
      firstName: firstNameOf(order.client.fullName),
      orderTitle: rx ? formatRxTitle(rx, order.amount) || order.title : order.title,
      rx: rxText,
      lens: rx?.lens?.trim() ?? '',
      frame: rx?.frame?.trim() ?? '',
      ...pay,
      address: publicPlace(settings.address),
      opticsName: settings.opticsName,
      landmark: publicPlace(settings.landmark),
      hours: settings.hours || '',
      phone: settings.phone || '',
    });
  }

  private async inboxFor(clientIds: string[], channel?: 'sms' | 'telegram') {
    const rows = await this.prisma.notification.findMany({
      where: {
        order: { clientId: { in: clientIds } },
        status: { in: ['sent', 'mocked'] },
        ...(channel ? { channel } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const seen = new Set<string>();
    const unique: typeof rows = [];
    for (const row of rows) {
      const key = `${row.orderId}:${row.message.trim()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(row);
      if (unique.length >= 5) break;
    }
    return unique;
  }

  private formatInbox(row: {
    channel: string;
    message: string;
    createdAt: Date;
  }) {
    const text = row.message.trim() || '—';
    return `${fmt(row.createdAt)}\n\n${text}`;
  }
}

function fmt(value: Date) {
  return value.toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

