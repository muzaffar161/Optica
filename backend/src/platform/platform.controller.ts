import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PlatformService } from './platform.service';
import { CreateOpticsDto } from './dto/create-optics.dto';
import { UpdateOpticsDto } from './dto/update-optics.dto';
import { UpdateConfigDto } from './dto/update-config.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpsertMessageTemplateDto } from './dto/message-template.dto';
import { UpdateProductSmsDto } from './dto/product-sms.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { MessageTemplatesService } from '../settings/message-templates.service';
import { PlatformSmsService } from '../billing/platform-sms.service';
import { TelegramService } from '../telegram/telegram.service';

@Roles(Role.platform)
@Controller('platform')
export class PlatformController {
  constructor(
    private readonly platformService: PlatformService,
    private readonly messageTemplates: MessageTemplatesService,
    private readonly platformSms: PlatformSmsService,
    private readonly telegram: TelegramService,
  ) {}

  @Get('config')
  getConfig() {
    return this.platformService.getConfig();
  }

  @Patch('config')
  updateConfig(@Body() dto: UpdateConfigDto) {
    return this.platformService.updateConfig(dto.defaultTemplate, dto.defaultTemplateKey);
  }

  @Get('templates')
  listTemplates() {
    return this.messageTemplates.list(true);
  }

  @Post('templates')
  createTemplate(@Body() dto: UpsertMessageTemplateDto) {
    return this.messageTemplates.create(dto);
  }

  @Patch('templates/:id')
  updateTemplate(@Param('id') id: string, @Body() dto: UpsertMessageTemplateDto) {
    return this.messageTemplates.update(id, dto);
  }

  @Delete('templates/:id')
  removeTemplate(@Param('id') id: string) {
    return this.messageTemplates.remove(id);
  }

  @Get('product-sms')
  async productSms() {
    const row = await this.platformSms.snapshot();
    return {
      ...row,
      botLink: row.botLink || this.telegram.botLink(),
    };
  }

  @Patch('product-sms')
  async updateProductSms(@Body() dto: UpdateProductSmsDto) {
    if (dto.botLink != null) {
      await this.platformSms.setBotLink(dto.botLink);
    }
    if (dto.smsCharLimit != null) {
      await this.platformSms.setCharLimit(dto.smsCharLimit);
    }
    if (dto.amount) {
      await this.platformSms.adjust(dto.amount, dto.reason || 'Корректировка');
    }
    const row = await this.platformSms.snapshot();
    return {
      ...row,
      botLink: row.botLink || this.telegram.botLink(),
    };
  }

  @Get('stats')
  stats() {
    return this.platformService.stats();
  }

  @Get('optics')
  list() {
    return this.platformService.listOptics();
  }

  @Post('optics')
  create(@Body() dto: CreateOpticsDto) {
    return this.platformService.createOptics(dto);
  }

  @Get('optics/:id')
  getOne(@Param('id') id: string) {
    return this.platformService.getOptics(id);
  }

  @Patch('optics/:id')
  update(@Param('id') id: string, @Body() dto: UpdateOpticsDto) {
    return this.platformService.updateOptics(id, dto);
  }

  @Post('optics/:id/reset-password')
  resetPassword(@Param('id') id: string, @Body() dto: ResetPasswordDto) {
    return this.platformService.resetPassword(id, dto.password, dto.username);
  }
}
