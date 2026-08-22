import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import {
  DEFAULT_TEMPLATE,
  SEED_TEMPLATES,
} from '../common/template';
import { MessageTemplatesService } from './message-templates.service';
import { PlatformSmsService } from '../billing/platform-sms.service';
import { clampArchiveDays } from '../common/archive';
import { THEME_KEYS } from '../common/themes';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: MessageTemplatesService,
    private readonly platformSms: PlatformSmsService,
  ) {}

  async defaultTemplate() {
    const row = await this.catalog.defaultRow();
    return {
      template: row?.bodyRu || DEFAULT_TEMPLATE,
      templateKey: row?.id || 'tpl_compact',
      templateId: row?.id || null,
    };
  }

  async get(opticsId: string) {
    await this.catalog.ensureSeed();
    const existing = await this.prisma.settings.findUnique({
      where: { opticsId },
    });
    const prefs = await this.platformSms.prefs();
    if (existing) {
      return { ...existing, ...prefs };
    }
    const optics = await this.prisma.optics.findUnique({
      where: { id: opticsId },
    });
    const defaults = await this.defaultTemplate();
    const created = await this.prisma.settings.create({
      data: {
        opticsId,
        opticsName: optics?.name || 'Оптика',
        address: 'укажите адрес в настройках',
        landmark: 'укажите ориентир в настройках',
        template: defaults.template,
        templateKey: defaults.templateKey,
        templateId: defaults.templateId,
        messageLang: 'ru',
      },
    });
    return { ...created, ...prefs };
  }

  async update(opticsId: string, dto: UpdateSettingsDto) {
    await this.get(opticsId);
    const data: Prisma.SettingsUncheckedUpdateInput = {};
    if (dto.address) data.address = dto.address.trim();
    if (dto.landmark) data.landmark = dto.landmark.trim();
    if (dto.phone != null) data.phone = dto.phone.trim();
    if (dto.hours != null) data.hours = dto.hours.trim();
    if (dto.theme) {
      if (!THEME_KEYS.includes(dto.theme)) {
        throw new BadRequestException('Неизвестная тема');
      }
      data.theme = dto.theme;
    }
    if (typeof dto.archiveAfterDays === 'number') {
      data.archiveAfterDays = clampArchiveDays(dto.archiveAfterDays);
    }
    if (dto.templateId) {
      const preset = await this.prisma.messageTemplate.findUnique({
        where: { id: dto.templateId },
      });
      if (!preset) throw new BadRequestException('Неизвестный шаблон');
      data.templateId = preset.id;
      data.template = preset.bodyRu;
      data.templateKey = preset.id;
      data.templateCustom = true;
    } else if (dto.templateKey) {
      if (dto.templateKey === 'platform') {
        const defaults = await this.defaultTemplate();
        data.template = defaults.template;
        data.templateKey = defaults.templateKey;
        data.templateId = defaults.templateId;
        data.templateCustom = false;
      } else {
        const fromSeed = SEED_TEMPLATES.find((row) => row.id === dto.templateKey || row.id === `tpl_${dto.templateKey}`);
        const preset = await this.prisma.messageTemplate.findUnique({
          where: { id: dto.templateKey },
        });
        const row = preset || (fromSeed
          ? await this.prisma.messageTemplate.findUnique({ where: { id: fromSeed.id } })
          : null);
        if (!row) throw new BadRequestException('Неизвестный шаблон');
        data.template = row.bodyRu;
        data.templateKey = row.id;
        data.templateId = row.id;
        data.templateCustom = true;
      }
    }
    if (dto.messageLang) data.messageLang = dto.messageLang;
    if (typeof dto.checkupRemindEnabled === 'boolean') {
      data.checkupRemindEnabled = dto.checkupRemindEnabled;
    }
    if (typeof dto.checkupIntervalMonths === 'number') {
      data.checkupIntervalMonths = dto.checkupIntervalMonths;
    }
    if (typeof dto.checkupNotifyDay === 'number') {
      data.checkupNotifyDay = dto.checkupNotifyDay;
    }
    const row = await this.prisma.settings.update({
      where: { opticsId },
      data,
    });
    return { ...row, ...(await this.platformSms.prefs()) };
  }

  listTemplates() {
    return this.catalog.list();
  }
}
