import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { ApiKeyGuard } from './api-key.guard';
import { ApiKeyService } from './api-key.service';

@Public()
@UseGuards(ApiKeyGuard)
@Controller('v1')
export class ExternalApiController {
  constructor(private readonly keys: ApiKeyService) {}

  @Get('orders')
  orders(@Req() req: { apiOrganizationId: string }) {
    return this.keys.publicOrders(req.apiOrganizationId);
  }

  @Get('clients')
  clients(@Req() req: { apiOrganizationId: string }) {
    return this.keys.publicClients(req.apiOrganizationId);
  }

  @Get('salons')
  salons(@Req() req: { apiOrganizationId: string }) {
    return this.keys.publicSalons(req.apiOrganizationId);
  }
}
