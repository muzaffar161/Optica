import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateClientDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MinLength(9)
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}
