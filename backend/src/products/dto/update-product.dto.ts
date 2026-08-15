import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  removePhoto?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;
}
