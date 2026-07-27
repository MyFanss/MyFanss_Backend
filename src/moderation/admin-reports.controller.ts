import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../auth/enums/role.enum';
import { ModerationService } from './moderation.service';
import { QueryContentReportsDto } from './dto/query-content-reports.dto';
import { UpdateContentReportDto } from './dto/update-content-report.dto';
import { ContentReportResponseDto } from './dto/content-report-response.dto';
import {
  PaginatedResponseDto,
  PaginationMetaDto,
} from '../users/dtos/paginated-response.dto';

@ApiTags('Admin - Moderation')
@ApiBearerAuth('JWT-auth')
@Controller('admin/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminReportsController {
  constructor(private readonly moderationService: ModerationService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List content reports (admin only)' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, description: 'Paginated content reports' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
  async getReports(
    @Query() query: QueryContentReportsDto,
  ): Promise<PaginatedResponseDto<ContentReportResponseDto>> {
    const { data, total, page, limit } =
      await this.moderationService.findReports(query);

    const pagination: PaginationMetaDto = {
      hasMore: page * limit < total,
      totalCount: total,
      limit,
    };

    return { data, pagination };
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Resolve or dismiss a content report (admin only)' })
  @ApiParam({ name: 'id', description: 'Report ID' })
  @ApiResponse({ status: 200, description: 'Report updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
  @ApiResponse({ status: 404, description: 'Report not found' })
  async updateReport(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateContentReportDto,
    @CurrentUser('userId') adminId: number,
  ): Promise<ContentReportResponseDto> {
    return this.moderationService.resolveReport(id, adminId, dto);
  }
}
