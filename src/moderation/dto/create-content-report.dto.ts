import { IsEnum, IsInt, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ReportTargetType } from '../enums/report-target-type.enum';

export class CreateContentReportDto {
  @ApiProperty({
    enum: ReportTargetType,
    example: ReportTargetType.POST,
    description: 'Type of content being reported',
  })
  @IsEnum(ReportTargetType)
  targetType: ReportTargetType;

  @ApiProperty({
    example: 42,
    description: 'ID of the post or comment being reported',
  })
  @IsInt()
  targetId: number;

  @ApiProperty({
    example: 'This post contains harassment',
    description: 'Reason for the report',
    minLength: 3,
    maxLength: 500,
  })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}
