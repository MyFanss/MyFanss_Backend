import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { StorageAdapter } from './storage-adapter.interface';

@Injectable()
export class LocalStorageAdapter implements StorageAdapter {
  private readonly uploadDir: string;
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.uploadDir = path.join(
      config.get<string>('UPLOAD_DIR', './uploads'),
      'avatars',
    );
    this.baseUrl = config.get<string>(
      'PUBLIC_BASE_URL',
      'http://localhost:3000',
    );
  }

  async save(buffer: Buffer, filename: string): Promise<string> {
    await fs.mkdir(this.uploadDir, { recursive: true });
    await fs.writeFile(path.join(this.uploadDir, filename), buffer);
    return `${this.baseUrl}/uploads/avatars/${filename}`;
  }

  async delete(url: string): Promise<void> {
    try {
      const filename = path.basename(url);
      await fs.unlink(path.join(this.uploadDir, filename));
    } catch {
      // Ignore — file may already be gone
    }
  }
}
