import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TipStatus } from '../enums/tip-status.enum';

export class TipResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() fanId: number;
  @ApiProperty() creatorId: number;
  @ApiProperty() amountCents: number;
  @ApiProperty() currency: string;
  @ApiPropertyOptional({ nullable: true }) message: string | null;
  @ApiProperty({ enum: TipStatus }) status: TipStatus;
  @ApiProperty() feeCents: number;
  @ApiProperty() creatorNetCents: number;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
  @ApiPropertyOptional({ nullable: true }) confirmedAt: Date | null;
}
