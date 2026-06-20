import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class TopReferrerDto {
  @ApiProperty({ description: 'Referral source label' })
  @Expose()
  referrer: string;

  @ApiProperty({ description: 'Number of subscribers from this referrer' })
  @Expose()
  count: number;
}
