import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateConfigDto {
  @IsString()
  @MinLength(1)
  defaultTemplate: string;

  @IsOptional()
  @IsString()
  defaultTemplateKey?: string;
}
