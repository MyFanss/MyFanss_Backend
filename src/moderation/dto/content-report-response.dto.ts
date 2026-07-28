import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportTargetType } from '../enums/report-target-type.enum';
import { ReportStatus } from '../enums/report-status.enum';

export class ContentReportResponseDto {
  @ApiProperty({ example: 1, description: 'Unique report ID' })
  id: number;

  @ApiProperty({
    example: 7,
    description: 'ID of the user who filed the report',
  })
  reporterId: number;

  @ApiProperty({ enum: ReportTargetType, example: ReportTargetType.POST })
  targetType: ReportTargetType;

  @ApiProperty({
    example: 42,
    description: 'ID of the reported post or comment',
  })
  targetId: number;

  @ApiProperty({ example: 'This post contains harassment' })
  reason: string;

  @ApiProperty({ enum: ReportStatus, example: ReportStatus.OPEN })
  status: ReportStatus;

  @ApiPropertyOptional({
    example: 3,
    description: 'ID of the admin who resolved/dismissed this report',
    nullable: true,
  })
  resolvedBy: number | null;

  @ApiPropertyOptional({
    example: '2024-06-15T12:05:00.000Z',
    description: 'When the report was resolved/dismissed',
    nullable: true,
  })
  resolvedAt: Date | null;

  @ApiProperty({
    example: '2024-06-15T11:50:00.000Z',
    description: 'Creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2024-06-15T12:05:00.000Z',
    description: 'Last update timestamp',
  })
  updatedAt: Date;
}
