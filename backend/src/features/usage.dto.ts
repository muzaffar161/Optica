import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { USAGE_NAMES } from './usage.service';

export class UsageEventDto {
  @IsString()
  @IsIn([...USAGE_NAMES])
  name: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(86_400_000)
  ms?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  path?: string;

  @IsOptional()
  @IsObject()
  meta?: Record<string, string | number | boolean>;
}

export class IngestUsageDto {
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => UsageEventDto)
  events: UsageEventDto[];
}
