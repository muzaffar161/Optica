import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/auth-user';
import { opticsIdOf } from '../common/optics-scope';
import { Access } from '../common/decorators/access.decorator';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RateLimit } from '../common/rate-limit.decorator';

@Roles(Role.optics)
@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly events: EventEmitter2,
  ) {}

  @Get()
  @Access('settings', 'view')
  get(@CurrentUser() user: AuthUser) {
    return this.settingsService.get(opticsIdOf(user));
  }

  @Get('templates')
  @Access('settings', 'view')
  templates() {
    return this.settingsService.listTemplates();
  }

  @Patch()
  @Access('settings', 'edit')
  async update(@CurrentUser() user: AuthUser, @Body() dto: UpdateSettingsDto) {
    const row = await this.settingsService.update(opticsIdOf(user), dto);
    this.events.emit('audit.log', {
      organizationId: user.organizationId,
      opticsId: user.opticsId,
      userId: user.sub,
      username: user.username,
      action: 'settings.update',
      entity: 'settings',
      entityId: opticsIdOf(user),
      summary: 'Настройки салона',
    });
    if (
      dto.checkupRemindEnabled != null ||
      dto.checkupIntervalMonths != null ||
      dto.checkupNotifyDay != null
    ) {
      this.events.emit('checkup.reschedule');
    }
    return row;
  }

  @Post('checkup-remind')
  @Access('settings', 'edit')
  @RateLimit({ name: 'checkup', limit: 1, windowMs: 5 * 60_000, by: 'optics' })
  async remindNow(@CurrentUser() user: AuthUser) {
    const results = await this.events.emitAsync('checkup.remind', {
      opticsId: opticsIdOf(user),
      force: true,
    });
    return results[0] ?? { sent: 0, failed: 0, skipped: 0 };
  }
}
