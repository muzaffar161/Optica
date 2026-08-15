import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Header,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/auth-user';
import { opticsIdOf, organizationIdOf } from '../common/optics-scope';
import { ReportsService } from './reports.service';
import { AuditService } from './audit.service';
import { ExportService } from './export.service';
import { ApiKeyService } from './api-key.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IsOptional, IsString, MinLength } from 'class-validator';

class CreateApiKeyDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;
}

@Roles(Role.optics)
@Controller()
export class FeaturesController {
  constructor(
    private readonly reports: ReportsService,
    private readonly audit: AuditService,
    private readonly exporter: ExportService,
    private readonly keys: ApiKeyService,
    private readonly events: EventEmitter2,
  ) {}

  @Get('reports')
  reportsGet(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('opticsId') opticsId?: string,
  ) {
    this.ensureOwner(user);
    return this.reports.get(
      organizationIdOf(user),
      opticsIdOf(user),
      user.orgOwner,
      from,
      to,
      opticsId,
    );
  }

  @Get('audit')
  auditList(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('opticsId') opticsId?: string,
  ) {
    this.ensureOwner(user);
    return this.audit.list(
      organizationIdOf(user),
      user.opticsId,
      user.orgOwner,
      page,
      pageSize,
      opticsId,
    );
  }

  @Get('export/orders')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportOrders(@CurrentUser() user: AuthUser, @Res() res: Response) {
    this.ensureOwner(user);
    const csv = await this.exporter.ordersCsv(organizationIdOf(user), opticsIdOf(user));
    this.events.emit('audit.log', {
      organizationId: user.organizationId,
      opticsId: user.opticsId,
      userId: user.sub,
      username: user.username,
      action: 'export.orders',
      entity: 'order',
      summary: 'Экспорт заказов',
    });
    res.setHeader('Content-Disposition', 'attachment; filename="orders.csv"');
    res.send(csv);
  }

  @Get('export/clients')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportClients(@CurrentUser() user: AuthUser, @Res() res: Response) {
    this.ensureOwner(user);
    const csv = await this.exporter.clientsCsv(organizationIdOf(user), opticsIdOf(user));
    this.events.emit('audit.log', {
      organizationId: user.organizationId,
      opticsId: user.opticsId,
      userId: user.sub,
      username: user.username,
      action: 'export.clients',
      entity: 'client',
      summary: 'Экспорт клиентов',
    });
    res.setHeader('Content-Disposition', 'attachment; filename="clients.csv"');
    res.send(csv);
  }

  @Get('integrations/keys')
  listKeys(@CurrentUser() user: AuthUser) {
    this.ensureOrgOwner(user);
    return this.keys.list(organizationIdOf(user));
  }

  @Post('integrations/keys')
  createKey(@CurrentUser() user: AuthUser, @Body() dto: CreateApiKeyDto) {
    this.ensureOrgOwner(user);
    return this.keys.create(organizationIdOf(user), dto.name || 'Ключ API');
  }

  @Delete('integrations/keys/:id')
  revokeKey(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    this.ensureOrgOwner(user);
    return this.keys.revoke(organizationIdOf(user), id);
  }

  private ensureOwner(user: AuthUser) {
    if (!user.isOwner && !user.orgOwner) {
      throw new ForbiddenException('Только владелец видит этот раздел');
    }
  }

  private ensureOrgOwner(user: AuthUser) {
    if (!user.orgOwner) {
      throw new ForbiddenException('Только владелец сети управляет API');
    }
  }
}
