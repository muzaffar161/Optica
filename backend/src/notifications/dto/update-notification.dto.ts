import { IsBoolean } from 'class-validator';

export class UpdateNotificationDto {
  @IsBoolean()
  archived: boolean;
}
