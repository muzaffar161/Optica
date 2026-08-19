import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message: 'Логин: только латиница, цифры, точка, _ и -',
  })
  username?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password: string;
}
