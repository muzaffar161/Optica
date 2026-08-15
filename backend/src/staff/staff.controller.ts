import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { StaffService } from './staff.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { CreateBranchDto, UpdateBranchDto } from './dto/branch.dto';
import { ResetStaffPasswordDto } from './dto/reset-staff-password.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/auth-user';

@Roles(Role.optics)
@Controller('staff')
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    this.ensureOwner(user);
    return this.staff.list(user);
  }

  @Post('branches')
  createBranch(@CurrentUser() user: AuthUser, @Body() dto: CreateBranchDto) {
    this.ensureOwner(user);
    return this.staff.createBranch(user, dto);
  }

  @Patch('branches/:id')
  updateBranch(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateBranchDto,
  ) {
    this.ensureOwner(user);
    return this.staff.updateBranch(user, id, dto);
  }

  @Delete('branches/:id')
  removeBranch(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    this.ensureOwner(user);
    return this.staff.removeBranch(user, id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateStaffDto) {
    this.ensureOwner(user);
    return this.staff.create(user, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateStaffDto,
  ) {
    this.ensureOwner(user);
    return this.staff.update(user, id, dto);
  }

  @Post(':id/reset-password')
  resetPassword(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ResetStaffPasswordDto,
  ) {
    this.ensureOwner(user);
    return this.staff.resetPassword(user, id, dto.password);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    this.ensureOwner(user);
    return this.staff.remove(user, id);
  }

  private ensureOwner(user: AuthUser) {
    if (!user.isOwner && !user.orgOwner) {
      throw new ForbiddenException('Только владелец управляет филиалами и сотрудниками');
    }
  }
}
