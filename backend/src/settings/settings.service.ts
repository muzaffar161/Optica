import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import {
  DEFAULT_TEMPLATE,
  findTemplatePreset,
  MESSAGE_TEMPLATES,
} from '../common/template';
import { clampArchiveDays } from '../common/archive';
import { THEME_KEYS } from '../common/themes';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async defaultTemplate() {
    const config = await this.prisma.platformConfig.upsert({
      where: { id: 'default' },
      create: { id: 'default', defaultTemplate: DEFAULT_TEMPLATE },
      update: {},
    });
    return {
      template: config.defaultTemplate,
      templateKey: config.defaultTemplateKey,
    };
  }

  async get(opticsId: string) {
    const existing = await this.prisma.settings.findUnique({
      where: { opticsId },
    });
    if (existing) {
      return existing;
    }
    const optics = await this.prisma.optics.findUnique({
      where: { id: opticsId },
    });
    const defaults = await this.defaultTemplate();
    return this.prisma.settings.create({
      data: {
        opticsId,
        opticsName: optics?.name || 'Оптика',
        address: 'укажите адрес в настройках',
        landmark: 'укажите ориентир в настройках',
        template: defaults.template,
        templateKey: defaults.templateKey,
      },
    });
  }

  async update(opticsId: string, dto: UpdateSettingsDto) {
    await this.get(opticsId);
    const data: Record<string, string | number | boolean> = {};
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
    if (dto.templateKey) {
      if (dto.templateKey === 'platform') {
        const defaults = await this.defaultTemplate();
        data.template = defaults.template;
        data.templateKey = defaults.templateKey;
        data.templateCustom = false;
      } else {
        const preset = findTemplatePreset(dto.templateKey);
        if (!preset) {
          throw new BadRequestException('Неизвестный шаблон');
        }
        data.template = preset.body;
        data.templateKey = preset.key;
        data.templateCustom = true;
      }
    }
    if (typeof dto.checkupRemindEnabled === 'boolean') {
      data.checkupRemindEnabled = dto.checkupRemindEnabled;
    }
    if (typeof dto.checkupIntervalMonths === 'number') {
      data.checkupIntervalMonths = dto.checkupIntervalMonths;
    }
    if (typeof dto.checkupNotifyDay === 'number') {
      data.checkupNotifyDay = dto.checkupNotifyDay;
    }
    return this.prisma.settings.update({
      where: { opticsId },
      data,
    });
  }

  templates() {
    return MESSAGE_TEMPLATES;
  }
}
