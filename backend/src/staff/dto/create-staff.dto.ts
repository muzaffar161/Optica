import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AccessLevel } from '@prisma/client';

export class CreateStaffDto {
  @IsString()
  @MinLength(3)
  @MaxLength(40)
  username: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password: string;

  @IsOptional()
  @IsString()
  opticsId?: string;

  @IsEnum(AccessLevel)
  permOrders: AccessLevel;

  @IsEnum(AccessLevel)
  permProducts: AccessLevel;

  @IsEnum(AccessLevel)
  permClients: AccessLevel;

  @IsEnum(AccessLevel)
  permJournal: AccessLevel;

  @IsEnum(AccessLevel)
  permSettings: AccessLevel;
}
