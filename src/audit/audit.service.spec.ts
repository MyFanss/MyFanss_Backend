import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from './audit.service';
import { AuditLog } from './audit.entity';
import { AuditAction } from './audit-action.enum';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { AppLogger } from '../logger/app-logger.service';

describe('AuditService', () => {
  let service: AuditService;
  let repository: Repository<AuditLog>;

  const mockRepository = {
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: mockRepository,
        },
        {
          provide: AppLogger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    repository = module.get<Repository<AuditLog>>(getRepositoryToken(AuditLog));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('log', () => {
    it('should persist a row with correct fields', async () => {
      const dto: CreateAuditLogDto = {
        actorId: 1,
        action: AuditAction.USER_ROLE_CHANGED,
        targetType: 'User',
        targetId: 42,
        metadata: { before: 'user', after: 'admin' },
      };

      await service.log(dto);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 1,
          action: 'USER_ROLE_CHANGED',
          targetType: 'User',
          targetId: 42,
          metadata: { before: 'user', after: 'admin' },
        }),
      );
    });

    it('should redact sensitive fields from metadata before saving', async () => {
      const dto: CreateAuditLogDto = {
        actorId: 1,
        action: AuditAction.USER_LOGIN_FAILED,
        targetType: 'User',
        metadata: {
          password: 'super-secret',
          email: 'test@example.com',
          someToken: 'abc123',
          safeField: 'keep-me',
        },
      };

      await service.log(dto);

      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: {
            password: '[REDACTED]',
            email: 'test@example.com',
            someToken: '[REDACTED]',
            safeField: 'keep-me',
          },
        }),
      );
    });

    it('should not throw when save fails, but log the error', async () => {
      const dbError = new Error('connection lost');
      (repository.save as jest.Mock).mockRejectedValueOnce(dbError);

      const dto: CreateAuditLogDto = {
        actorId: 1,
        action: AuditAction.USER_DELETED,
        targetType: 'User',
        targetId: 10,
      };

      await expect(service.log(dto)).resolves.toBeUndefined();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to persist audit log'),
        expect.any(String),
        'AuditService',
      );
    });
  });

  describe('findLogs', () => {
    it('should apply filters and paginate results', async () => {
      const mockQb = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest
          .fn()
          .mockResolvedValue([
            [{ id: 1, action: 'USER_DELETED', createdAt: new Date() }],
            1,
          ]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQb);

      const result = await service.findLogs({
        action: 'USER_DELETED',
        actorId: 1,
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        page: 1,
        limit: 20,
      });

      expect(mockQb.andWhere).toHaveBeenCalledTimes(4);
      expect(mockQb.orderBy).toHaveBeenCalledWith('audit.createdAt', 'DESC');
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });
});
