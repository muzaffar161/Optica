import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/auth-user';
import { opticsIdOf } from '../common/optics-scope';
import { Access } from '../common/decorators/access.decorator';

@Roles(Role.optics)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @Access('products', 'view')
  findAll(@CurrentUser() user: AuthUser) {
    return this.categories.findAll(opticsIdOf(user));
  }

  @Post()
  @Access('products', 'edit')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCategoryDto) {
    return this.categories.create(opticsIdOf(user), dto);
  }

  @Patch(':id')
  @Access('products', 'edit')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categories.update(opticsIdOf(user), id, dto);
  }

  @Delete(':id')
  @Access('products', 'all')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.categories.remove(opticsIdOf(user), id);
  }
}
