import { Test, TestingModule } from '@nestjs/testing';
import {
  NotificationsController,
  AuthenticatedRequest,
} from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationPreferencesDto } from './dtos/notification-preferences.dto';

describe('NotificationsController', () => {
  let controller: NotificationsController;

  const mockService = {
    getPreferences: jest.fn(),
    updatePreferences: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        {
          provide: NotificationsService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const mockRequest = {
    user: {
      userId: 1,
      email: 'test@example.com',
      username: 'test',
    },
  } as unknown as AuthenticatedRequest;

  describe('getPreferences', () => {
    it('should call service.getPreferences with userId', async () => {
      const mockResult: NotificationPreferencesDto = {
        newSubscriber: true,
        postFromSubscribedCreator: true,
        securityAlerts: true,
        marketing: false,
      };
      mockService.getPreferences.mockResolvedValue(mockResult);

      const result = await controller.getPreferences(mockRequest);

      expect(mockService.getPreferences).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockResult);
    });
  });

  describe('updatePreferences', () => {
    it('should call service.updatePreferences with userId and dto', async () => {
      const dto = { marketing: true };
      const mockResult: NotificationPreferencesDto = {
        newSubscriber: true,
        postFromSubscribedCreator: true,
        securityAlerts: true,
        marketing: true,
      };
      mockService.updatePreferences.mockResolvedValue(mockResult);

      const result = await controller.updatePreferences(mockRequest, dto);

      expect(mockService.updatePreferences).toHaveBeenCalledWith(1, dto);
      expect(result).toEqual(mockResult);
    });
  });
});
