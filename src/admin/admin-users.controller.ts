import {
  Controller,
  Param,
  Patch,
  Body,
  UseGuards,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/role.enum';
import { UsersService } from '../users/users.service';
import { AssignRoleDto } from '../users/dtos/assign-role.dto';

@ApiTags('Admin - Users')
@ApiBearerAuth('JWT-auth')
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminUsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch(':id/role')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign a role to a user (admin only)' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiBody({ type: AssignRoleDto })
  @ApiResponse({ status: 200, description: 'Role assigned successfully' })
  @ApiResponse({
    status: 400,
    description: 'Invalid role or last admin protection',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  async assignRole(
    @Param('id') userId: number,
    @Body() assignRoleDto: AssignRoleDto,
    @Request() req: any,
  ): Promise<{ message: string }> {
    const existingUser = await this.usersService.getUserById(userId);

    if (existingUser.role === assignRoleDto.role) {
      return { message: 'User already has this role' };
    }

    const isLastAdmin =
      existingUser.role === UserRole.ADMIN &&
      assignRoleDto.role !== UserRole.ADMIN;

    if (isLastAdmin) {
      const adminCount = await this.usersService.countAdmins();

      if (adminCount <= 1) {
        throw new ForbiddenException({
          message: 'Cannot demote the last admin',
          code: 'LAST_ADMIN_PROTECTION',
        });
      }
    }

    const actorId = req.user?.userId;
    await this.usersService.updateUserRole(userId, assignRoleDto.role, actorId);

    return { message: 'Role assigned successfully' };
  }
}
