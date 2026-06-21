import {
  Controller,
  FileTypeValidator,
  MaxFileSizeValidator,
  ParseFilePipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AvatarUploadService } from './avatar-upload.service';
import { AvatarUploadResponseDto } from './dto/avatar-upload-response.dto';

@ApiTags('Uploads')
@ApiBearerAuth('JWT-auth')
@Controller('users/me')
export class AvatarUploadController {
  constructor(private readonly avatarUploadService: AvatarUploadService) {}

  @Post('avatar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('avatar', { storage: memoryStorage() }))
  @ApiOperation({
    summary: 'Upload or replace your avatar image (JWT required)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['avatar'],
      properties: {
        avatar: {
          type: 'string',
          format: 'binary',
          description: 'Image file — JPEG, PNG, or WebP; max 2 MB',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Avatar uploaded and profile updated',
    type: AvatarUploadResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file type or file exceeds 2 MB size limit',
  })
  @ApiUnauthorizedResponse({ description: 'JWT token missing or invalid' })
  async uploadAvatar(
    @CurrentUser() currentUser: { userId: number },
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 2 * 1024 * 1024 }),
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|webp)$/ }),
        ],
        errorHttpStatusCode: 400,
      }),
    )
    file: Express.Multer.File,
  ): Promise<AvatarUploadResponseDto> {
    const { avatarUrl } = await this.avatarUploadService.uploadAvatar(
      currentUser.userId,
      file,
    );
    return { avatarUrl, message: 'Avatar uploaded successfully' };
  }
}
