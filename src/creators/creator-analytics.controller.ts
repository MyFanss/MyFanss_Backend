import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreatorAnalyticsService } from './creator-analytics.service';
import { CreatorAnalyticsQueryDto } from './dtos/creator-analytics-query.dto';
import { CreatorAnalyticsResponseDto } from './dtos/creator-analytics-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreatorRoleGuard } from './creator-role.guard';

interface CreatorRequest {
  user: { id: number; email: string; role: string; orgId?: number };
}

@ApiTags('Creators')
@Controller('creators/me')
@UseGuards(JwtAuthGuard, CreatorRoleGuard)
@ApiBearerAuth('JWT-auth')
export class CreatorAnalyticsController {
  constructor(private readonly analyticsService: CreatorAnalyticsService) {}

  @Get('analytics')
  @ApiOperation({ summary: 'Get creator analytics snapshot' })
  @ApiQuery({
    name: 'days',
    required: false,
    description: 'Number of days for the analytics window (1-365)',
    type: Number,
    example: 30,
  })
  @ApiResponse({
    status: 200,
    description: 'Creator analytics snapshot',
    type: CreatorAnalyticsResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - creator role required' })
  async getAnalytics(
    @Req() req: CreatorRequest,
    @Query() query: CreatorAnalyticsQueryDto,
  ): Promise<{ data: CreatorAnalyticsResponseDto }> {
    const analytics = await this.analyticsService.getCreatorAnalytics(
      req.user.id,
      query.days,
    );

    return { data: analytics };
  }
}
