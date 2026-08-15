import { IsString, MinLength } from 'class-validator';

export class CreateClientDto {
  @IsString()
  @MinLength(2)
  fullName: string;

  @IsString()
  @MinLength(9)
  phone: string;
}
