import { ApiProperty } from '@nestjs/swagger';

export class SessionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  deviceId: string | null;

  @ApiProperty()
  userAgent: string | null;

  @ApiProperty()
  ipAddress: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  expiresAt: Date;
}
