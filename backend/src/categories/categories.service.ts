import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { foldText } from '../common/phone';
import { assertCatalogEnabled } from '../common/optics-features';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(opticsId: string) {
    await assertCatalogEnabled(this.prisma, opticsId);
    return this.prisma.category.findMany({
      where: { opticsId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    });
  }

  async findOne(opticsId: string, id: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, opticsId },
    });
    if (!category) {
      throw new NotFoundException('Категория не найдена');
    }
    return category;
  }

  async create(opticsId: string, dto: CreateCategoryDto) {
    await assertCatalogEnabled(this.prisma, opticsId);
    const name = dto.name.trim();
    return this.prisma.category.create({
      data: { opticsId, name, nameKey: foldText(name) },
    });
  }

  async update(opticsId: string, id: string, dto: UpdateCategoryDto) {
    await this.findOne(opticsId, id);
    const name = dto.name.trim();
    return this.prisma.category.update({
      where: { id },
      data: { name, nameKey: foldText(name) },
    });
  }

  async remove(opticsId: string, id: string) {
    await this.findOne(opticsId, id);
    await this.prisma.category.delete({ where: { id } });
    return { ok: true };
  }
}
