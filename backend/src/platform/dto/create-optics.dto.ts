import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateOpticsDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @IsString()
  @MinLength(3)
  @MaxLength(40)
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message: 'Логин: только латиница, цифры, точка, _ и -',
  })
  username: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password: string;

  @IsOptional()
  @IsBoolean()
  catalogOrders?: boolean;

  @IsOptional()
  @IsBoolean()
  rxOrders?: boolean;

  @IsOptional()
  @IsString()
  planId?: string;
}
