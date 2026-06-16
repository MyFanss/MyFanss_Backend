import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersQueryService } from './users-query.service';
import { User } from '../user.entity';
import { BadRequestException } from '@nestjs/common';

describe('UsersQueryService', () => {
  let service: UsersQueryService;
  let mockRepository: jest.Mocked<Repository<User>>;

  beforeEach(async () => {
    mockRepository = {
      createQueryBuilder: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersQueryService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<UsersQueryService>(UsersQueryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('encodeCursor and decodeCursor', () => {
    it('should encode and decode cursor correctly', () => {
      const data = { id: 123, createdAt: '2024-01-01T00:00:00Z' };
      const encoded = service.encodeCursor(data);
      const decoded = service.decodeCursor(encoded);

      expect(decoded).toEqual(data);
    });

    it('should throw error for invalid cursor', () => {
      expect(() => {
        service.decodeCursor('invalid-base64-');
      }).toThrow(BadRequestException);
    });
  });

  describe('validateQueryParams', () => {
    it('should throw error for invalid limit', () => {
      expect(() => {
        service.validateQueryParams({ limit: 101 } as any);
      }).toThrow(BadRequestException);
    });

    it('should throw error for invalid roles', () => {
      expect(() => {
        service.validateQueryParams({ role: ['invalid_role'] } as any);
      }).toThrow(BadRequestException);
    });

    it('should throw error for invalid statuses', () => {
      expect(() => {
        service.validateQueryParams({ status: ['invalid_status'] } as any);
      }).toThrow(BadRequestException);
    });

    it('should throw error if created_from is after created_to', () => {
      expect(() => {
        service.validateQueryParams({
          created_from: '2024-12-31',
          created_to: '2024-01-01',
        } as any);
      }).toThrow(BadRequestException);
    });

    it('should pass validation for valid params', () => {
      expect(() => {
        service.validateQueryParams({
          limit: 50,
          role: ['admin'],
          status: ['active'],
        } as any);
      }).not.toThrow();
    });
  });
});
