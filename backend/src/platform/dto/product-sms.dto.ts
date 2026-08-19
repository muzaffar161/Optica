import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateProductSmsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  botLink?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(40)
  @Max(280)
  smsCharLimit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  amount?: number;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  reason?: string;
}
