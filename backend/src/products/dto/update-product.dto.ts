import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  removePhoto?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;
}
