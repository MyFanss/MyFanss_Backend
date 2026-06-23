import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AvatarUploadController } from './avatar-upload.controller';
import { AvatarUploadService } from './avatar-upload.service';
import { LocalStorageAdapter } from './adapters/local-storage.adapter';
import { S3StorageAdapter } from './adapters/s3-storage.adapter';
import { NoOpVirusScanHook } from './hooks/virus-scan.hook';
import { STORAGE_ADAPTER } from './adapters/storage-adapter.interface';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [ConfigModule, UsersModule],
  controllers: [AvatarUploadController],
  providers: [
    AvatarUploadService,
    NoOpVirusScanHook,
    LocalStorageAdapter,
    S3StorageAdapter,
    {
      provide: STORAGE_ADAPTER,
      useFactory: (
        config: ConfigService,
        local: LocalStorageAdapter,
        s3: S3StorageAdapter,
      ) =>
        config.get<string>('STORAGE_DRIVER', 'local') === 's3' ? s3 : local,
      inject: [ConfigService, LocalStorageAdapter, S3StorageAdapter],
    },
  ],
})
export class UploadsModule {}
