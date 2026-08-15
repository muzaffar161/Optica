import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { foldText } from '../common/phone';
import { pageParams } from '../common/pagination';
import { searchTokens } from '../common/search';
import { deleteUpload, saveProductPhoto, type UploadedImage } from '../uploads/upload';
import { assertCatalogEnabled } from '../common/optics-features';

function productSearch(q?: string): Prisma.ProductWhereInput | undefined {
  const tokens = searchTokens(q);
  if (!tokens?.text.length) {
    return undefined;
  }
  const and: Prisma.ProductWhereInput[] = tokens.text.map((token) => ({
    nameKey: { contains: token },
  }));
  return and.length === 1 ? and[0] : { AND: and };
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    opticsId: string,
    q?: string,
    page?: string,
    pageSize?: string,
    categoryId?: string,
  ) {
    await assertCatalogEnabled(this.prisma, opticsId);
    const where: Prisma.ProductWhereInput = {
      opticsId,
      ...productSearch(q),
    };
    if (categoryId === 'none') {
      where.categoryId = null;
    } else if (categoryId) {
      where.categoryId = categoryId;
    }
    const { page: p, take, skip } = pageParams(page, pageSize, 100);
    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take,
        include: { category: true },
      }),
      this.prisma.product.count({ where }),
    ]);
    return { items, total, page: p, pageSize: take };
  }

  async findOne(opticsId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, opticsId },
    });
    if (!product) {
      throw new NotFoundException('Товар не найден');
    }
    return product;
  }

  async create(
    opticsId: string,
    dto: CreateProductDto,
    file?: UploadedImage,
  ) {
    await assertCatalogEnabled(this.prisma, opticsId);
    const name = dto.name.trim();
    const photoPath = file ? saveProductPhoto(opticsId, file) : null;
    const categoryId = await this.resolveCategory(opticsId, dto.categoryId);
    return this.prisma.product.create({
      data: {
        opticsId,
        name,
        nameKey: foldText(name),
        photoPath,
        categoryId,
      },
      include: { category: true },
    });
  }

  async update(
    opticsId: string,
    id: string,
    dto: UpdateProductDto,
    file?: UploadedImage,
  ) {
    const product = await this.findOne(opticsId, id);
    const name = dto.name?.trim();
    const removePhoto =
      dto.removePhoto === '1' || dto.removePhoto === 'true';
    let photoPath = product.photoPath;

    if (file) {
      deleteUpload(product.photoPath);
      photoPath = saveProductPhoto(opticsId, file);
    } else if (removePhoto) {
      deleteUpload(product.photoPath);
      photoPath = null;
    }

    const categoryId =
      dto.categoryId === undefined
        ? undefined
        : await this.resolveCategory(opticsId, dto.categoryId);

    return this.prisma.product.update({
      where: { id },
      data: {
        ...(name
          ? { name, nameKey: foldText(name) }
          : {}),
        photoPath,
        ...(categoryId !== undefined ? { categoryId } : {}),
      },
      include: { category: true },
    });
  }

  private async resolveCategory(opticsId: string, categoryId?: string) {
    const id = categoryId?.trim();
    if (!id || id === 'none') {
      return null;
    }
    const category = await this.prisma.category.findFirst({
      where: { id, opticsId },
    });
    if (!category) {
      throw new NotFoundException('Категория не найдена');
    }
    return category.id;
  }

  async remove(opticsId: string, id: string) {
    const product = await this.findOne(opticsId, id);
    deleteUpload(product.photoPath);
    await this.prisma.product.delete({ where: { id } });
    return { ok: true };
  }
}
