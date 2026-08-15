import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, GrammyError, Keyboard } from 'grammy';
import { PrismaService } from '../prisma/prisma.service';
import { normalizePhone } from '../common/phone';

export type TelegramSendResult = {
  ok: boolean;
  blocked?: boolean;
  error?: string;
};

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private bot?: Bot;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
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
        this.logger.log(`Telegram-бот @${info.username} запущен`);
      },
    });
  }

  async onModuleDestroy() {
    if (this.bot) {
      await this.bot.stop();
    }
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

  private setupHandlers() {
    const bot = this.bot;
    if (!bot) {
      return;
    }

    bot.command('start', async (ctx) => {
      const keyboard = new Keyboard()
        .requestContact('Отправить номер телефона')
        .resized()
        .oneTime();
      await ctx.reply(
        'Здравствуйте! Чтобы получать уведомления о готовности заказа, поделитесь номером телефона — тем же, который оставили в оптике.',
        { reply_markup: keyboard },
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
          `Номер ${phone} не найден в базе оптики. Оставьте этот номер в салоне при заказе — после этого уведомления придут в Telegram.`,
        );
        return;
      }

      await this.prisma.client.updateMany({
        where: { phone },
        data: { telegramChatId: chatId },
      });

      const name = clients[0].fullName;
      await ctx.reply(
        `Спасибо, ${name}! Вы подписаны на уведомления о заказах.`,
      );
    });

    bot.catch((err) => {
      this.logger.error(`Ошибка бота: ${err.message}`, err.stack);
    });
  }
}
