import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import { NotificationPreferencesDto } from './dtos/notification-preferences.dto';
import { UpdateNotificationPreferencesDto } from './dtos/update-notification-preferences.dto';

export interface AuthenticatedRequest extends Request {
  user: {
    userId: number;
    email: string;
    username: string;
  };
}

@ApiTags('Notifications')
@ApiBearerAuth('JWT-auth')
@Controller('users/me/notification-preferences')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user notification preferences' })
  @ApiResponse({
    status: 200,
    description: 'Notification preferences retrieved successfully',
    type: NotificationPreferencesDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getPreferences(
    @Req() req: AuthenticatedRequest,
  ): Promise<NotificationPreferencesDto> {
    return this.notificationsService.getPreferences(req.user.userId);
  }

  @Patch()
  @ApiOperation({
    summary: 'Partially update current user notification preferences',
  })
  @ApiBody({ type: UpdateNotificationPreferencesDto })
  @ApiResponse({
    status: 200,
    description: 'Notification preferences updated successfully',
    type: NotificationPreferencesDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid preference keys' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updatePreferences(
    @Req() req: AuthenticatedRequest,
    @Body() updateDto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferencesDto> {
    return this.notificationsService.updatePreferences(
      req.user.userId,
      updateDto,
    );
  }
}
