import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SEED_TEMPLATES, DEFAULT_SMS_RU, DEFAULT_SMS_UZ, WELCOME_TEMPLATE_ID, WELCOME_SMS_RU, WELCOME_SMS_UZ, smsOverflow } from '../common/template';
import { PlatformSmsService } from '../billing/platform-sms.service';

@Injectable()
export class MessageTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly platformSms: PlatformSmsService,
  ) {}

  async ensureSeed() {
    await this.ensureSeedCount();
    await this.ensureWelcome();
    const first = await this.prisma.messageTemplate.findFirst({
      where: { kind: 'salon' },
      orderBy: { createdAt: 'asc' },
    });
    if (!first) return first;
    await this.backfillSms();
    const keyToId: Record<string, string> = {
      compact: 'tpl_compact',
      card: 'tpl_card',
      cardPhone: 'tpl_cardPhone',
      sms: 'tpl_sms',
      formal: 'tpl_formal',
      platform: first.id,
      custom: first.id,
    };
    const dangling = await this.prisma.settings.findMany({
      where: { templateId: null },
      select: { opticsId: true, templateKey: true },
    });
    for (const row of dangling) {
      const id = keyToId[row.templateKey] || first.id;
      const exists = await this.prisma.messageTemplate.findUnique({
        where: { id },
        select: { id: true },
      });
      await this.prisma.settings.update({
        where: { opticsId: row.opticsId },
        data: { templateId: exists ? id : first.id },
      });
    }
    return first;
  }

  async list(includeWelcome = false) {
    await this.ensureSeed();
    return this.prisma.messageTemplate.findMany({
      where: includeWelcome ? undefined : { kind: 'salon' },
      orderBy: [{ kind: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async defaultRow() {
    await this.ensureSeed();
    return this.prisma.messageTemplate.findFirst({
      where: { kind: 'salon' },
      orderBy: { createdAt: 'asc' },
    });
  }

  async welcome() {
    await this.ensureSeed();
    return this.prisma.messageTemplate.findUnique({
      where: { id: WELCOME_TEMPLATE_ID },
    });
  }

  private async ensureSeedCount() {
    const count = await this.prisma.messageTemplate.count();
    if (count > 0) return;
    try {
      await this.prisma.messageTemplate.createMany({
        data: SEED_TEMPLATES.map((row) => ({
          id: row.id,
          name: row.name,
          hint: row.hint,
          bodyRu: row.bodyRu,
          bodyUz: row.bodyUz,
          smsRu: row.smsRu,
          smsUz: row.smsUz,
        })),
      });
    } catch (err) {
      if (
        !(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')
      ) {
        throw err;
      }
    }
  }

  private async ensureWelcome() {
    await this.prisma.messageTemplate.upsert({
      where: { id: WELCOME_TEMPLATE_ID },
      create: {
        id: WELCOME_TEMPLATE_ID,
        name: 'Приветствие продукта',
        hint: 'Один раз на номер, со счёта Optika. Салону не списывается.',
        kind: 'welcome',
        bodyRu: WELCOME_SMS_RU,
        bodyUz: WELCOME_SMS_UZ,
        smsRu: WELCOME_SMS_RU,
        smsUz: WELCOME_SMS_UZ,
      },
      update: {},
    });
    await this.prisma.messageTemplate.updateMany({
      where: {
        id: WELCOME_TEMPLATE_ID,
        smsRu: '{firstName}, подробнее о заказах в нашем Telegram: {link}',
      },
      data: {
        smsRu: WELCOME_SMS_RU,
        smsUz: WELCOME_SMS_UZ,
        bodyRu: WELCOME_SMS_RU,
        bodyUz: WELCOME_SMS_UZ,
      },
    });
  }

  private async backfillSms() {
    for (const seed of SEED_TEMPLATES) {
      await this.prisma.messageTemplate.updateMany({
        where: { id: seed.id, smsRu: '' },
        data: { smsRu: seed.smsRu, smsUz: seed.smsUz },
      });
    }
    const custom = await this.prisma.messageTemplate.findMany({
      where: {
        smsRu: '',
        kind: 'salon',
        id: { notIn: SEED_TEMPLATES.map((row) => row.id) },
      },
      select: { id: true },
    });
    if (!custom.length) return;
    await this.prisma.messageTemplate.updateMany({
      where: { id: { in: custom.map((row) => row.id) } },
      data: { smsRu: DEFAULT_SMS_RU, smsUz: DEFAULT_SMS_UZ },
    });
  }

  async create(dto: {
    name: string;
    hint?: string;
    bodyRu: string;
    bodyUz?: string;
    smsRu?: string;
    smsUz?: string;
  }) {
    const name = dto.name.trim();
    const bodyRu = dto.bodyRu.trim();
    if (name.length < 2) throw new BadRequestException('Назовите шаблон');
    if (!bodyRu) throw new BadRequestException('Напишите русский текст');
    await this.ensureSmsLimit(dto.smsRu || DEFAULT_SMS_RU, 'SMS на русском');
    await this.ensureSmsLimit(dto.smsUz || DEFAULT_SMS_UZ, 'SMS на узбекском');
    return this.prisma.messageTemplate.create({
      data: {
        name,
        hint: (dto.hint || '').trim(),
        kind: 'salon',
        bodyRu,
        bodyUz: (dto.bodyUz || '').trim(),
        smsRu: (dto.smsRu || DEFAULT_SMS_RU).trim(),
        smsUz: (dto.smsUz || DEFAULT_SMS_UZ).trim(),
      },
    });
  }

  async update(
    id: string,
    dto: { name?: string; hint?: string; bodyRu?: string; bodyUz?: string; smsRu?: string; smsUz?: string },
  ) {
    await this.get(id);
    if (dto.smsRu != null) await this.ensureSmsLimit(dto.smsRu, 'SMS на русском');
    if (dto.smsUz != null) await this.ensureSmsLimit(dto.smsUz, 'SMS на узбекском');
    return this.prisma.messageTemplate.update({
      where: { id },
      data: {
        ...(dto.name != null ? { name: dto.name.trim() } : {}),
        ...(dto.hint != null ? { hint: dto.hint.trim() } : {}),
        ...(dto.bodyRu != null ? { bodyRu: dto.bodyRu.trim() } : {}),
        ...(dto.bodyUz != null ? { bodyUz: dto.bodyUz.trim() } : {}),
        ...(dto.smsRu != null ? { smsRu: dto.smsRu.trim() } : {}),
        ...(dto.smsUz != null ? { smsUz: dto.smsUz.trim() } : {}),
      },
    });
  }

  async remove(id: string) {
    const row = await this.get(id);
    if (row.kind === 'welcome' || row.id === WELCOME_TEMPLATE_ID) {
      throw new BadRequestException('Приветствие продукта нельзя удалить');
    }
    const total = await this.prisma.messageTemplate.count();
    if (total <= 1) {
      throw new BadRequestException('Нельзя удалить последний шаблон');
    }
    const fallback = await this.prisma.messageTemplate.findFirst({
      where: { id: { not: id } },
      orderBy: { createdAt: 'asc' },
    });
    if (fallback) {
      await this.prisma.settings.updateMany({
        where: { templateId: id },
        data: {
          templateId: fallback.id,
          template: fallback.bodyRu,
          templateKey: fallback.id,
        },
      });
    }
    await this.prisma.messageTemplate.delete({ where: { id } });
    return { ok: true };
  }

  async get(id: string) {
    const row = await this.prisma.messageTemplate.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Шаблон не найден');
    return row;
  }

  private async ensureSmsLimit(template: string, label: string) {
    const limit = await this.platformSms.charLimit();
    const over = smsOverflow(template, limit);
    if (!over) return;
    throw new BadRequestException(
      `${label}: ${over.chars} символов, лимит ${over.limit}. Укоротите текст.`,
    );
  }
}
