import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/auth-user';
import { opticsIdOf } from '../common/optics-scope';
import { Access } from '../common/decorators/access.decorator';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Roles(Role.optics)
@Controller('clients')
export class ClientsController {
  constructor(
    private readonly clientsService: ClientsService,
    private readonly events: EventEmitter2,
  ) {}

  @Get()
  @Access('clients', 'view')
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('archive') archive?: string,
  ) {
    return this.clientsService.findAll(opticsIdOf(user), q, page, pageSize, archive);
  }

  @Get(':id')
  @Access('clients', 'view')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.clientsService.findOne(opticsIdOf(user), id);
  }

  @Post()
  @Access('clients', 'edit')
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateClientDto) {
    const row = await this.clientsService.create(opticsIdOf(user), dto);
    this.events.emit('audit.log', {
      organizationId: user.organizationId,
      opticsId: user.opticsId,
      userId: user.sub,
      username: user.username,
      action: 'client.create',
      entity: 'client',
      entityId: row.id,
      summary: row.fullName,
    });
    return row;
  }

  @Patch(':id')
  @Access('clients', 'edit')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
  ) {
    const row = await this.clientsService.update(opticsIdOf(user), id, dto);
    this.events.emit('audit.log', {
      organizationId: user.organizationId,
      opticsId: user.opticsId,
      userId: user.sub,
      username: user.username,
      action: 'client.update',
      entity: 'client',
      entityId: row.id,
      summary: row.fullName,
    });
    return row;
  }

  @Delete(':id')
  @Access('clients', 'all')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const result = await this.clientsService.remove(opticsIdOf(user), id);
    this.events.emit('audit.log', {
      organizationId: user.organizationId,
      opticsId: user.opticsId,
      userId: user.sub,
      username: user.username,
      action: 'client.delete',
      entity: 'client',
      entityId: id,
      summary: 'Удаление клиента',
    });
    return result;
  }
}
