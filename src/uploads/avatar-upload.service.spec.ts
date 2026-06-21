import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AvatarUploadService } from './avatar-upload.service';
import {
  STORAGE_ADAPTER,
  StorageAdapter,
} from './adapters/storage-adapter.interface';
import { NoOpVirusScanHook } from './hooks/virus-scan.hook';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';

const makeFile = (
  overrides: Partial<Express.Multer.File> = {},
): Express.Multer.File =>
  ({
    fieldname: 'avatar',
    originalname: 'photo.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: 1024,
    buffer: Buffer.from('fake-image-data'),
    stream: null as never,
    destination: '',
    filename: '',
    path: '',
    ...overrides,
  }) as Express.Multer.File;

const mockUser = (avatarUrl: string | null = null): Partial<User> => ({
  id: 1,
  name: 'Test User',
  email: 'test@example.com',
  avatarUrl,
});

describe('AvatarUploadService', () => {
  let service: AvatarUploadService;
  let storage: jest.Mocked<StorageAdapter>;
  let usersService: { findById: jest.Mock; updateProfile: jest.Mock };
  let virusScan: jest.Mocked<NoOpVirusScanHook>;

  const AVATAR_URL = 'http://localhost:3000/uploads/avatars/new-uuid.jpg';

  beforeEach(async () => {
    storage = {
      save: jest.fn().mockResolvedValue(AVATAR_URL),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    usersService = {
      findById: jest.fn().mockResolvedValue(mockUser()),
      updateProfile: jest.fn().mockResolvedValue(undefined),
    };

    virusScan = {
      scan: jest.fn().mockResolvedValue(undefined),
    } as jest.Mocked<NoOpVirusScanHook>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AvatarUploadService,
        { provide: STORAGE_ADAPTER, useValue: storage },
        { provide: UsersService, useValue: usersService },
        { provide: NoOpVirusScanHook, useValue: virusScan },
      ],
    }).compile();

    service = module.get<AvatarUploadService>(AvatarUploadService);
  });

  describe('uploadAvatar — validation', () => {
    it('rejects unsupported MIME types with code INVALID_FILE_TYPE', async () => {
      const file = makeFile({ mimetype: 'image/gif' });
      await expect(service.uploadAvatar(1, file)).rejects.toMatchObject({
        message: expect.stringContaining('File type not allowed'),
        response: expect.objectContaining({ code: 'INVALID_FILE_TYPE' }),
      });
    });

    it('rejects files exceeding 2 MB with code FILE_TOO_LARGE', async () => {
      const file = makeFile({ size: 3 * 1024 * 1024 });
      await expect(service.uploadAvatar(1, file)).rejects.toMatchObject({
        message: expect.stringContaining('File too large'),
        response: expect.objectContaining({ code: 'FILE_TOO_LARGE' }),
      });
    });

    it('throws BadRequestException for invalid types', async () => {
      await expect(
        service.uploadAvatar(1, makeFile({ mimetype: 'application/pdf' })),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('uploadAvatar — happy path', () => {
    it('returns the public avatarUrl on success', async () => {
      const result = await service.uploadAvatar(1, makeFile());
      expect(result).toEqual({ avatarUrl: AVATAR_URL });
    });

    it('does NOT delete old avatar when user has none', async () => {
      usersService.findById.mockResolvedValue(mockUser(null) as User);
      await service.uploadAvatar(1, makeFile());
      expect(storage.delete).not.toHaveBeenCalled();
    });

    it('deletes old avatar file before saving the new one', async () => {
      const OLD_URL = 'http://localhost:3000/uploads/avatars/old.jpg';
      usersService.findById.mockResolvedValue(mockUser(OLD_URL) as User);

      await service.uploadAvatar(1, makeFile());

      expect(storage.delete).toHaveBeenCalledWith(OLD_URL);
      const deleteOrder = storage.delete.mock.invocationCallOrder[0];
      const saveOrder = storage.save.mock.invocationCallOrder[0];
      expect(deleteOrder).toBeLessThan(saveOrder);
    });

    it('stores the file with a randomized UUID filename, not the original name', async () => {
      await service.uploadAvatar(1, makeFile({ originalname: 'photo.jpg' }));

      const [, savedFilename] = storage.save.mock.calls[0];
      expect(savedFilename).not.toContain('photo');
      expect(savedFilename).toMatch(/^[0-9a-f-]{36}\.(jpg|png|webp)$/);
    });

    it('calls the virus scan hook before saving', async () => {
      await service.uploadAvatar(1, makeFile());

      const virusScanOrder = virusScan.scan.mock.invocationCallOrder[0];
      const saveOrder = storage.save.mock.invocationCallOrder[0];
      expect(virusScanOrder).toBeLessThan(saveOrder);
    });

    it('persists the new avatarUrl on the user profile', async () => {
      await service.uploadAvatar(1, makeFile());
      expect(usersService.updateProfile).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ avatarUrl: AVATAR_URL }),
      );
    });

    it('accepts PNG files and uses the .png extension', async () => {
      storage.save.mockResolvedValue(
        'http://localhost:3000/uploads/avatars/uuid.png',
      );
      await service.uploadAvatar(1, makeFile({ mimetype: 'image/png' }));

      const [, filename] = storage.save.mock.calls[0];
      expect(filename).toMatch(/\.png$/);
    });

    it('accepts WebP files and uses the .webp extension', async () => {
      await service.uploadAvatar(1, makeFile({ mimetype: 'image/webp' }));
      const [, filename] = storage.save.mock.calls[0];
      expect(filename).toMatch(/\.webp$/);
    });
  });
});
