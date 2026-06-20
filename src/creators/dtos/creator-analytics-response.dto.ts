import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { TopReferrerDto } from './top-referrer.dto';

export class CreatorAnalyticsResponseDto {
  @ApiProperty({ example: 120 })
  @Expose()
  subscriberCount: number;

  @ApiProperty({ example: 15 })
  @Expose()
  newSubscribers: number;

  @ApiProperty({ example: 3 })
  @Expose()
  churnedSubscribers: number;

  @ApiProperty({ example: 30 })
  @Expose()
  periodDays: number;

  @ApiProperty({ type: [TopReferrerDto], example: [] })
  @Expose()
  @Type(() => TopReferrerDto)
  topReferrers: TopReferrerDto[];
}
