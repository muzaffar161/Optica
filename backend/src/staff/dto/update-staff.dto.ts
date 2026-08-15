import { IsBoolean, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { AccessLevel } from '@prisma/client';

export class UpdateStaffDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  username?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsString()
  opticsId?: string;

  @IsOptional()
  @IsEnum(AccessLevel)
  permOrders?: AccessLevel;

  @IsOptional()
  @IsEnum(AccessLevel)
  permProducts?: AccessLevel;

  @IsOptional()
  @IsEnum(AccessLevel)
  permClients?: AccessLevel;

  @IsOptional()
  @IsEnum(AccessLevel)
  permJournal?: AccessLevel;

  @IsOptional()
  @IsEnum(AccessLevel)
  permSettings?: AccessLevel;
}
