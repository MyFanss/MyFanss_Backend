import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSubscriptionDto {
  @ApiProperty({
    description: 'ID of the creator the fan wants to subscribe to',
    example: 42,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  creatorId: number;
}
