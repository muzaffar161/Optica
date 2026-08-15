import { Body, Controller, Get, NotFoundException, Param, Patch, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { NotificationsService } from './notifications.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/auth-user';
import { opticsIdOf } from '../common/optics-scope';
import { Access } from '../common/decorators/access.decorator';
import { UpdateNotificationDto } from './dto/update-notification.dto';

@Roles(Role.optics)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @Access('journal', 'view')
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('archive') archive?: string,
  ) {
    return this.notificationsService.findAll(
      opticsIdOf(user),
      page,
      pageSize,
      archive,
    );
  }

  @Patch(':id')
  @Access('journal', 'edit')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateNotificationDto,
  ) {
    const row = await this.notificationsService.setArchived(
      opticsIdOf(user),
      id,
      dto.archived,
    );
    if (!row) {
      throw new NotFoundException('Запись не найдена');
    }
    return row;
  }
}
