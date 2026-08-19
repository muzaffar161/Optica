import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
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
  @MaxLength(16)
  sph?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  cyl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  ax?: string;
}

export class RxBlockDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
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
  @MaxLength(8)
  dpp?: string;
}

export class RxPayloadDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RxBlockDto)
  blocks: RxBlockDto[];

  @IsOptional()
  @IsString()
  @MaxLength(80)
  lens?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  frame?: string;
}

export class CreateOrderDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsIn(['catalog', 'rx'])
  kind?: 'catalog' | 'rx';

  @Type(() => Number)
  @IsInt({ message: 'Укажите сумму заказа' })
  @Min(1, { message: 'Укажите сумму заказа' })
  amount: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  paidAmount?: number;

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
