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
import { OrderStatus, Role } from '@prisma/client';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/auth-user';
import { opticsIdOf } from '../common/optics-scope';
import { Access } from '../common/decorators/access.decorator';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Roles(Role.optics)
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly events: EventEmitter2,
  ) {}

  @Get()
  @Access('orders', 'view')
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: OrderStatus,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('archive') archive?: string,
  ) {
    return this.ordersService.findAll(
      opticsIdOf(user),
      status,
      q,
      page,
      pageSize,
      archive,
    );
  }

  @Get('rx-suggestions')
  @Access('orders', 'view')
  rxSuggestions(@CurrentUser() user: AuthUser) {
    return this.ordersService.rxSuggestions(opticsIdOf(user));
  }

  @Post()
  @Access('orders', 'edit')
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto) {
    const row = await this.ordersService.create(opticsIdOf(user), dto);
    this.events.emit('audit.log', {
      organizationId: user.organizationId,
      opticsId: user.opticsId,
      userId: user.sub,
      username: user.username,
      action: 'order.create',
      entity: 'order',
      entityId: row.id,
      summary: row.title,
    });
    return row;
  }

  @Post(':id/notify')
  @Access('orders', 'edit')
  notify(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ordersService.notifyReady(opticsIdOf(user), id);
  }

  @Post(':id/resend')
  @Access('orders', 'edit')
  resend(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ordersService.resend(opticsIdOf(user), id);
  }

  @Get(':id')
  @Access('orders', 'view')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ordersService.findOne(opticsIdOf(user), id);
  }

  @Patch(':id')
  @Access('orders', 'edit')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateOrderDto,
  ) {
    const row = await this.ordersService.update(opticsIdOf(user), id, dto);
    this.events.emit('audit.log', {
      organizationId: user.organizationId,
      opticsId: user.opticsId,
      userId: user.sub,
      username: user.username,
      action: dto.status ? 'order.status' : 'order.update',
      entity: 'order',
      entityId: row.id,
      summary: dto.status ? `${row.title} → ${dto.status}` : row.title,
    });
    return row;
  }

  @Delete(':id')
  @Access('orders', 'all')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const result = await this.ordersService.remove(opticsIdOf(user), id);
    this.events.emit('audit.log', {
      organizationId: user.organizationId,
      opticsId: user.opticsId,
      userId: user.sub,
      username: user.username,
      action: 'order.delete',
      entity: 'order',
      entityId: id,
      summary: 'Удаление заказа',
    });
    return result;
  }
}
