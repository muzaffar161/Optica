import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { firstNameOf, langsOf, polishMessage, prepareSms } from '../common/template';
import { PlatformSmsService } from '../billing/platform-sms.service';
import { SubscriptionService } from '../billing/subscription.service';

const FIRE_HOUR = 9;
const MAX_TIMEOUT_MS = 24 * 24 * 60 * 60 * 1000;
const RETRY_AFTER_FAIL_MS = 12 * 60 * 60 * 1000;
const MONTHS_RU = [
  'январь',
  'февраль',
  'март',
  'апрель',
  'май',
  'июнь',
  'июль',
  'август',
  'сентябрь',
  'октябрь',
  'ноябрь',
  'декабрь',
];

export type CheckupRemindResult = {
  sent: number;
  failed: number;
  skipped: number;
  cohort: string;
};

function yearMonth(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function lastDayOfMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function fireAt(year: number, month: number, notifyDay: number) {
  const day = Math.min(Math.max(notifyDay, 1), lastDayOfMonth(year, month));
  return new Date(year, month, day, FIRE_HOUR, 0, 0, 0);
}

function cohortLabel(start: Date) {
  return `${MONTHS_RU[start.getMonth()]} ${start.getFullYear()}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fmtWhen(d: Date) {
  return d.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

@Injectable()
export class CheckupReminderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CheckupReminderService.name);
  private timer?: ReturnType<typeof setTimeout>;
  private ticking = false;
  private readonly lastAttempt = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly platformSms: PlatformSmsService,
    private readonly subscriptions: SubscriptionService,
  ) {}

  onModuleInit() {
    void this.arm();
  }

  onModuleDestroy() {
    if (this.timer) clearTimeout(this.timer);
  }

  @OnEvent('checkup.remind')
  runNow(payload: { opticsId: string; force?: boolean }) {
    return this.runSalon(payload.opticsId, { force: payload.force !== false });
  }

  @OnEvent('checkup.reschedule')
  onSettingsChanged() {
    void this.arm();
  }

  private async arm() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    if (this.ticking) return;

    const now = new Date();
    const ym = yearMonth(now);
    const salons = await this.prisma.settings.findMany({
      where: { checkupRemindEnabled: true },
      select: {
        opticsId: true,
        checkupNotifyDay: true,
        lastCheckupRunOn: true,
      },
    });

    const due: string[] = [];
    let soonest: Date | null = null;

    for (const salon of salons) {
      if (!salon.lastCheckupRunOn) {
        await this.prisma.settings.update({
          where: { opticsId: salon.opticsId },
          data: { lastCheckupRunOn: ym },
        });
        soonest = minDate(
          soonest,
          fireAt(now.getFullYear(), now.getMonth() + 1, salon.checkupNotifyDay),
        );
        continue;
      }

      const thisFire = fireAt(now.getFullYear(), now.getMonth(), salon.checkupNotifyDay);
      const overdue = salon.lastCheckupRunOn !== ym && now >= thisFire;
      if (overdue) {
        const attempted = this.lastAttempt.get(salon.opticsId) ?? 0;
        if (Date.now() - attempted < RETRY_AFTER_FAIL_MS) {
          soonest = minDate(soonest, new Date(attempted + RETRY_AFTER_FAIL_MS));
          continue;
        }
        due.push(salon.opticsId);
        continue;
      }

      const wake =
        now < thisFire
          ? thisFire
          : fireAt(now.getFullYear(), now.getMonth() + 1, salon.checkupNotifyDay);
      soonest = minDate(soonest, wake);
    }

    if (due.length > 0) {
      void this.fireDue(due);
      return;
    }

    if (!soonest) {
      this.logger.log('Напоминания об осмотре выключены — таймер не ставим');
      return;
    }

    const delay = Math.max(soonest.getTime() - Date.now(), 0);
    const wait = Math.min(delay, MAX_TIMEOUT_MS);
    this.logger.log(`Напоминания об осмотре спят до ${fmtWhen(new Date(Date.now() + wait))}`);
    this.timer = setTimeout(() => void this.arm(), wait);
  }

  private async fireDue(opticsIds: string[]) {
    if (this.ticking) return;
    this.ticking = true;
    try {
      for (const opticsId of opticsIds) {
        this.lastAttempt.set(opticsId, Date.now());
        await this.runSalon(opticsId, { force: false });
      }
    } catch (err) {
      this.logger.error(
        `Напоминания об осмотре: ${err instanceof Error ? err.message : err}`,
      );
    } finally {
      this.ticking = false;
      await this.arm();
    }
  }

  private async runSalon(
    opticsId: string,
    opts: { force: boolean },
  ): Promise<CheckupRemindResult> {
    const settings = await this.prisma.settings.findUnique({
      where: { opticsId },
      include: { optics: { select: { organizationId: true } } },
    });
    if (!settings || (!settings.checkupRemindEnabled && !opts.force)) {
      return { sent: 0, failed: 0, skipped: 0, cohort: '' };
    }
    const orgId = settings.optics?.organizationId;
    if (orgId) {
      const plan = await this.subscriptions.getCurrentPlan(orgId);
      if (!plan) {
        return { sent: 0, failed: 0, skipped: 0, cohort: '' };
      }
    }

    const now = new Date();
    const months = Math.min(Math.max(settings.checkupIntervalMonths || 6, 1), 24);
    const thisMonth = monthStart(now);
    const cohortStart = addMonths(thisMonth, -months);
    const cohortEnd = addMonths(cohortStart, 1);
    const ym = yearMonth(now);
    const result: CheckupRemindResult = {
      sent: 0,
      failed: 0,
      skipped: 0,
      cohort: cohortLabel(cohortStart),
    };

    const clients = await this.prisma.client.findMany({
      where: {
        opticsId,
        archived: false,
        lastVisitAt: { gte: cohortStart, lt: cohortEnd },
      },
      select: {
        id: true,
        fullName: true,
        phone: true,
        telegramChatId: true,
        lastCheckupRemindedAt: true,
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true },
        },
      },
    });

    const ru = polishMessage(
      `{firstName}, прошло ${months} мес. с последнего визита в ${settings.opticsName}. Не забудьте проверить зрение.\n📍 ${settings.opticsName}, ${settings.address}\n🕘 ${settings.hours || ''}`,
    );
    const uz = polishMessage(
      `{firstName}, ${settings.opticsName} ga oxirgi tashrifingizdan ${months} oy o'tdi. Ko'rishni tekshirishni unutmang.\n📍 ${settings.opticsName}, ${settings.address}\n🕘 ${settings.hours || ''}`,
    );
    const ruSms = polishMessage(
      `{firstName}, прошло ${months} мес. Проверьте зрение. ${settings.opticsName}`,
    );
    const uzSms = polishMessage(
      `{firstName}, ${months} oy o'tdi. Korishni tekshiring. ${settings.opticsName}`,
    );
    const prefs = await this.platformSms.prefs();

    for (const client of clients) {
      if (
        client.lastCheckupRemindedAt &&
        client.lastCheckupRemindedAt >= thisMonth
      ) {
        result.skipped += 1;
        continue;
      }
      const orderId = client.orders[0]?.id;
      if (!orderId) {
        result.skipped += 1;
        continue;
      }
      const name = firstNameOf(client.fullName);
      const messages = langsOf(settings.messageLang).map((lang) =>
        (lang === 'uz' ? uz : ru).replace('{firstName}', name),
      );
      const smsMessages = langsOf(settings.messageLang).map((lang) =>
        prepareSms((lang === 'uz' ? uzSms : ruSms).replace('{firstName}', name), prefs.smsCharLimit, {
          toLatin: prefs.smsToLatin,
          lang,
        }),
      );
      const delivery = await this.notifications.deliver({
        opticsId,
        organizationId: settings.optics.organizationId,
        client,
        orderId,
        messages,
        smsMessages,
        kind: 'checkup',
        smsDescription:
          messages.length > 1
            ? `Напоминание об осмотре: ${client.fullName} (2)`
            : `Напоминание об осмотре: ${client.fullName}`,
      });
      if (delivery.ok) {
        await this.prisma.client.update({
          where: { id: client.id },
          data: { lastCheckupRemindedAt: now },
        });
        result.sent += 1;
      } else if (delivery.smsSkipped) {
        result.skipped += 1;
      } else {
        result.failed += 1;
      }
      await sleep(40);
    }

    if (result.failed === 0) {
      await this.prisma.settings.update({
        where: { opticsId },
        data: { lastCheckupRunOn: ym },
      });
    }

    if (result.sent || result.failed) {
      this.logger.log(
        `Осмотр ${opticsId}: когорта ${result.cohort}, отправлено ${result.sent}, ошибок ${result.failed}`,
      );
    }
    return result;
  }
}

function minDate(a: Date | null, b: Date) {
  if (!a || b < a) return b;
  return a;
}
