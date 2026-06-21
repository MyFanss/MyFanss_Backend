import { ApiProperty } from '@nestjs/swagger';

export class AvatarUploadResponseDto {
  @ApiProperty({ example: 'http://localhost:3000/uploads/avatars/uuid.jpg' })
  avatarUrl: string;

  @ApiProperty({ example: 'Avatar uploaded successfully' })
  message: string;
}
