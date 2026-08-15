import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CreateClientDto } from '../../clients/dto/create-client.dto';

export class OrderItemInputDto {
  @IsString()
  productId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(99)
  qty: number;
}

export class RxEyeDto {
  @IsOptional()
  @IsString()
  sph?: string;

  @IsOptional()
  @IsString()
  cyl?: string;

  @IsOptional()
  @IsString()
  ax?: string;
}

export class RxBlockDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => RxEyeDto)
  od?: RxEyeDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => RxEyeDto)
  os?: RxEyeDto;

  @IsOptional()
  @IsString()
  dpp?: string;
}

export class RxPayloadDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RxBlockDto)
  blocks: RxBlockDto[];

  @IsOptional()
  @IsString()
  lens?: string;

  @IsOptional()
  @IsString()
  frame?: string;
}

export class CreateOrderDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsIn(['catalog', 'rx'])
  kind?: 'catalog' | 'rx';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  amount?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => RxPayloadDto)
  rx?: RxPayloadDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  items?: OrderItemInputDto[];

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateClientDto)
  client?: CreateClientDto;
}
