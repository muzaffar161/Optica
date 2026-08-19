import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateClientDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  fullName: string;

  @IsString()
  @MinLength(9)
  @MaxLength(20)
  phone: string;
}
