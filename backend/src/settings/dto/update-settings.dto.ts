import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  address?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  landmark?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  hours?: string;

  @IsOptional()
  @IsString()
  theme?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  archiveAfterDays?: number;

  @IsOptional()
  @IsString()
  templateKey?: string;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsOptional()
  @IsIn(['ru', 'uz', 'both'])
  messageLang?: 'ru' | 'uz' | 'both';

  @IsOptional()
  @IsBoolean()
  checkupRemindEnabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  checkupIntervalMonths?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(28)
  checkupNotifyDay?: number;
}
