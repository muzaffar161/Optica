import { IsBoolean, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class CreateOpticsDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @MinLength(3)
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message: 'Логин: только латиница, цифры, точка, _ и -',
  })
  username: string;

  @IsString()
  @MinLength(6)
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
