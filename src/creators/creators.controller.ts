import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreatorsService } from './creators.service';
import { OnboardCreatorDto } from './dtos/onboard-creator.dto';
import { UpdateCreatorDto } from './dtos/update-creator.dto';
import { CreatorResponseDto } from './dtos/creator-response.dto';
import { CreatorPrivateDto } from './dtos/creator-private.dto';

interface AuthenticatedRequest extends Request {
  user: {
    userId: number;
    email: string;
    username: string;
  };
}

@ApiTags('Creators')
@Controller('creators')
export class CreatorsController {
  constructor(private readonly creatorsService: CreatorsService) {}

  @Post('onboard')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Authenticated user onboards as a creator' })
  @ApiResponse({
    status: 201,
    description: 'Creator profile created; user role upgraded to creator',
    type: CreatorPrivateDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid handle format' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({
    status: 409,
    description: 'Handle already taken or user already onboarded',
  })
  async onboard(
    @Req() req: AuthenticatedRequest,
    @Body() dto: OnboardCreatorDto,
  ): Promise<CreatorPrivateDto> {
    return this.creatorsService.onboard(req.user.userId, dto);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Owner updates their own creator profile' })
  @ApiResponse({
    status: 200,
    description: 'Updated creator profile',
    type: CreatorPrivateDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Caller does not own the profile' })
  @ApiResponse({ status: 404, description: 'Caller has no creator profile' })
  async updateMe(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateCreatorDto,
  ): Promise<CreatorPrivateDto> {
    return this.creatorsService.updateOwnProfile(req.user.userId, dto);
  }

  @Get(':handle')
  @ApiOperation({ summary: 'Public creator profile by handle (no auth)' })
  @ApiParam({ name: 'handle', description: 'Public creator handle' })
  @ApiResponse({
    status: 200,
    description: 'Public creator profile',
    type: CreatorResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Creator not found' })
  async getByHandle(
    @Param('handle') handle: string,
  ): Promise<CreatorResponseDto> {
    return this.creatorsService.getByHandle(handle);
  }
}
