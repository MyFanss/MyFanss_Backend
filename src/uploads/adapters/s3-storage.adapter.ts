import { Injectable } from '@nestjs/common';
import { StorageAdapter } from './storage-adapter.interface';

// Stub — wire up an S3 SDK (e.g. @aws-sdk/client-s3) and set
// AWS_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
// then set STORAGE_DRIVER=s3 in your environment.
@Injectable()
export class S3StorageAdapter implements StorageAdapter {
  async save(_buffer: Buffer, _filename: string): Promise<string> {
    throw new Error('S3StorageAdapter is not yet implemented');
  }

  async delete(_url: string): Promise<void> {
    throw new Error('S3StorageAdapter is not yet implemented');
  }
}
