import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ReportStatus } from '../enums/report-status.enum';

export class UpdateContentReportDto {
  @ApiProperty({
    enum: [ReportStatus.RESOLVED, ReportStatus.DISMISSED],
    example: ReportStatus.RESOLVED,
    description: 'New status for the report — resolve or dismiss',
  })
  @IsIn([ReportStatus.RESOLVED, ReportStatus.DISMISSED])
  status: ReportStatus.RESOLVED | ReportStatus.DISMISSED;
}
