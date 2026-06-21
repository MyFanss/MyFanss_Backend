import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { UsersService } from '../users/users.service';
import { STORAGE_ADAPTER, StorageAdapter } from './adapters/storage-adapter.interface';
import { NoOpVirusScanHook } from './hooks/virus-scan.hook';

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const ALLOWED_MIMES = new Set(Object.keys(MIME_TO_EXT));
const MAX_SIZE_BYTES = 2 * 1024 * 1024;

@Injectable()
export class AvatarUploadService {
  constructor(
    @Inject(STORAGE_ADAPTER) private readonly storage: StorageAdapter,
    private readonly usersService: UsersService,
    private readonly virusScan: NoOpVirusScanHook,
  ) {}

  async uploadAvatar(
    userId: number,
    file: Express.Multer.File,
  ): Promise<{ avatarUrl: string }> {
    if (!ALLOWED_MIMES.has(file.mimetype)) {
      throw new BadRequestException({
        message: 'File type not allowed. Accepted: jpeg, png, webp',
        code: 'INVALID_FILE_TYPE',
      });
    }

    if (file.size > MAX_SIZE_BYTES) {
      throw new BadRequestException({
        message: 'File too large. Maximum allowed size is 2 MB',
        code: 'FILE_TOO_LARGE',
      });
    }

    await this.virusScan.scan(file.buffer);

    const ext = MIME_TO_EXT[file.mimetype];
    const filename = `${randomUUID()}.${ext}`;

    const user = await this.usersService.findById(userId);
    if (user?.avatarUrl) {
      await this.storage.delete(user.avatarUrl);
    }

    const avatarUrl = await this.storage.save(file.buffer, filename);
    await this.usersService.updateProfile(userId, { avatarUrl });

    return { avatarUrl };
  }
}
