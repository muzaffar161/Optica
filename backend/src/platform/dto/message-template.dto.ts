import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpsertMessageTemplateDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  hint?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  bodyRu: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bodyUz?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  smsRu?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  smsUz?: string;
}
