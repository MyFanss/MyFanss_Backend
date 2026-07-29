import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ModerationService } from './moderation.service';
import { CreateContentReportDto } from './dto/create-content-report.dto';
import { ContentReportResponseDto } from './dto/content-report-response.dto';

@ApiTags('Moderation')
@Controller('reports')
export class ReportsController {
  constructor(private readonly moderationService: ModerationService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Report a post or comment for moderation review' })
  @ApiResponse({ status: 201, description: 'Report created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Reported target not found' })
  @ApiResponse({
    status: 409,
    description: 'An open report already exists for this target',
  })
  async createReport(
    @Body() dto: CreateContentReportDto,
    @CurrentUser('userId') reporterId: number,
  ): Promise<ContentReportResponseDto> {
    return this.moderationService.createReport(reporterId, dto);
  }
}
