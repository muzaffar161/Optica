import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateBranchDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsBoolean()
  catalogOrders?: boolean;

  @IsOptional()
  @IsBoolean()
  rxOrders?: boolean;
}

export class UpdateBranchDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsBoolean()
  catalogOrders?: boolean;

  @IsOptional()
  @IsBoolean()
  rxOrders?: boolean;
}
