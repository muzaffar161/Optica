import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/auth-user';
import { opticsIdOf } from '../common/optics-scope';
import { Access } from '../common/decorators/access.decorator';
import { IMAGE_UPLOAD, type UploadedImage } from '../uploads/upload';
import { RateLimit } from '../common/rate-limit.decorator';

const photoUpload = FileInterceptor('photo', IMAGE_UPLOAD);

@Roles(Role.optics)
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @Access('products', 'view')
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.products.findAll(
      opticsIdOf(user),
      q,
      page,
      pageSize,
      categoryId,
    );
  }

  @Post()
  @Access('products', 'edit')
  @RateLimit({ name: 'upload', limit: 20, windowMs: 10 * 60_000, by: 'user' })
  @UseInterceptors(photoUpload)
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateProductDto,
    @UploadedFile() file?: UploadedImage,
  ) {
    return this.products.create(opticsIdOf(user), dto, file);
  }

  @Patch(':id')
  @Access('products', 'edit')
  @RateLimit({ name: 'upload', limit: 20, windowMs: 10 * 60_000, by: 'user' })
  @UseInterceptors(photoUpload)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @UploadedFile() file?: UploadedImage,
  ) {
    return this.products.update(opticsIdOf(user), id, dto, file);
  }

  @Delete(':id')
  @Access('products', 'all')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.products.remove(opticsIdOf(user), id);
  }
}
