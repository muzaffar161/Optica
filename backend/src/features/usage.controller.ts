import { Body, Controller, Get, Header, Post, Query, Res } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/auth-user';
import { RateLimit } from '../common/rate-limit.decorator';
import { UsageService } from './usage.service';
import { IngestUsageDto } from './usage.dto';

@Controller()
export class UsageController {
  constructor(private readonly usage: UsageService) {}

  @Post('usage')
  @RateLimit({ name: 'usage', limit: 40, windowMs: 60_000, by: 'user' })
  ingest(@CurrentUser() user: AuthUser, @Body() dto: IngestUsageDto) {
    return this.usage.write(user, dto.events);
  }

  @Get('platform/usage')
  @Roles(Role.platform)
  snapshot(@Query('from') from?: string, @Query('to') to?: string) {
    return this.usage.snapshot(from, to);
  }

  @Get('platform/usage.csv')
  @Roles(Role.platform)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportCsv(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @Res() res: Response,
  ) {
    const csv = await this.usage.csv(from, to);
    res.setHeader('Content-Disposition', 'attachment; filename="optika-usage.csv"');
    res.send(csv);
  }
}
