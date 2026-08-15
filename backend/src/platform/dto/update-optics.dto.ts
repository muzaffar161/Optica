import { IsBoolean, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class UpdateOpticsDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(1)
  template?: string;

  @IsOptional()
  @IsString()
  templateKey?: string;

  @IsOptional()
  @IsBoolean()
  resetTemplate?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  staffLimit?: number;

  @IsOptional()
  @IsBoolean()
  catalogOrders?: boolean;

  @IsOptional()
  @IsBoolean()
  rxOrders?: boolean;
}
