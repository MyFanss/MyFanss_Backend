import { Test, TestingModule } from '@nestjs/testing';
import { AvatarUploadController } from './avatar-upload.controller';
import { AvatarUploadService } from './avatar-upload.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

const mockFile = (): Express.Multer.File =>
  ({
    fieldname: 'avatar',
    originalname: 'photo.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: 1024,
    buffer: Buffer.from('fake-image-data'),
  }) as Express.Multer.File;

describe('AvatarUploadController', () => {
  let controller: AvatarUploadController;
  let service: jest.Mocked<Pick<AvatarUploadService, 'uploadAvatar'>>;

  const AVATAR_URL = 'http://localhost:3000/uploads/avatars/uuid.jpg';

  beforeEach(async () => {
    service = {
      uploadAvatar: jest.fn().mockResolvedValue({ avatarUrl: AVATAR_URL }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AvatarUploadController],
      providers: [{ provide: AvatarUploadService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AvatarUploadController>(AvatarUploadController);
  });

  it('is defined', () => {
    expect(controller).toBeDefined();
  });

  it('delegates to AvatarUploadService with the authenticated userId', async () => {
    const currentUser = { userId: 42, email: 'test@example.com', role: 'fan' };
    await controller.uploadAvatar(currentUser, mockFile());
    expect(service.uploadAvatar).toHaveBeenCalledWith(42, expect.any(Object));
  });

  it('returns avatarUrl and success message', async () => {
    const currentUser = { userId: 1, email: 'test@example.com', role: 'fan' };
    const result = await controller.uploadAvatar(currentUser, mockFile());
    expect(result).toEqual({
      avatarUrl: AVATAR_URL,
      message: 'Avatar uploaded successfully',
    });
  });
});
