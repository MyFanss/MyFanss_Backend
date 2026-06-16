import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SearchService } from './search.service';
import { User } from '../user.entity';

describe('SearchService', () => {
  let service: SearchService;
  let mockRepository: jest.Mocked<Repository<User>>;

  beforeEach(async () => {
    mockRepository = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('buildSearchText', () => {
    it('should build search text from user name and email', async () => {
      const user: User = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        password: 'hashed',
        role: 'user',
        status: 'active',
        org_id: null,
        created_at: new Date(),
        updated_at: new Date(),
        is_deleted: false,
        search_text: '',
      };

      const result = await service.buildSearchText(user);
      expect(result).toBe('john doe john@example.com');
    });
  });

  describe('tokenizeSearchTerm', () => {
    it('should tokenize search term correctly', () => {
      const result = service.tokenizeSearchTerm('john doe');
      expect(result).toEqual(['john', 'doe']);
    });

    it('should handle multiple spaces', () => {
      const result = service.tokenizeSearchTerm('john    doe');
      expect(result).toEqual(['john', 'doe']);
    });

    it('should return empty array for empty term', () => {
      const result = service.tokenizeSearchTerm('');
      expect(result).toEqual([]);
    });
  });
});
