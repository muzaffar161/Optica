import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Transform, Type } from 'class-transformer';

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
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    return value === true || value === 'true';
  })
  @IsBoolean()
  smsToLatin?: boolean;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    return value === true || value === 'true';
  })
  @IsBoolean()
  smsViaDevice?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  subscriptionWarnDays?: number;

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
