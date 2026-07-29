import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TipsService } from './tips.service';
import { TipQueryDto } from './dto/tip-query.dto';
import { TipResponseDto } from './dto/tip-response.dto';
import { PaginatedResponseDto } from '../users/dtos/paginated-response.dto';

interface AuthenticatedRequest extends Request {
  user: {
    userId: number;
    email: string;
    username: string;
  };
}

@ApiTags('Tips')
@ApiBearerAuth('JWT-auth')
@Controller('creators/me/tips')
@UseGuards(JwtAuthGuard)
export class CreatorTipsController {
  constructor(private readonly tipsService: TipsService) {}

  @Get()
  @ApiOperation({ summary: "Creator's own tip inbox" })
  @ApiResponse({
    status: 200,
    description: 'Paginated tip inbox',
    type: PaginatedResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async listMyInbox(
    @Req() req: AuthenticatedRequest,
    @Query() query: TipQueryDto,
  ): Promise<PaginatedResponseDto<TipResponseDto>> {
    return this.tipsService.listCreatorInbox(req.user.userId, query);
  }
}
