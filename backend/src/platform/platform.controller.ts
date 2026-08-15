import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PlatformService } from './platform.service';
import { CreateOpticsDto } from './dto/create-optics.dto';
import { UpdateOpticsDto } from './dto/update-optics.dto';
import { UpdateConfigDto } from './dto/update-config.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Roles } from '../common/decorators/roles.decorator';

@Roles(Role.platform)
@Controller('platform')
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  @Get('config')
  getConfig() {
    return this.platformService.getConfig();
  }

  @Patch('config')
  updateConfig(@Body() dto: UpdateConfigDto) {
    return this.platformService.updateConfig(dto.defaultTemplate, dto.defaultTemplateKey);
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
