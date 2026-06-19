import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { GetUsersQueryDto } from './dtos/get-users-query.dto';
import { PaginatedResponseDto } from './dtos/paginated-response.dto';
import { UserResponseDto } from './dtos/userResponse.dto';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            getAllUsers: jest.fn(),
            getUserById: jest.fn(),
            createUser: jest.fn(),
            updateUser: jest.fn(),
            updateProfile: jest.fn(),
            deleteUser: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getAllUsers', () => {
    it('should return paginated users', async () => {
      const query: GetUsersQueryDto = {
        limit: 20,
        sort_by: 'created_at',
        sort_order: 'DESC',
      };

      const mockResponse: PaginatedResponseDto<UserResponseDto> = {
        data: [
          {
            id: 1,
            name: 'John Doe',
            email: 'john@example.com',
            role: 'admin',
            status: 'active',
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        pagination: {
          hasMore: false,
          totalCount: 1,
          limit: 20,
          cursor: undefined,
        },
      };

      (service.getAllUsers as jest.Mock).mockResolvedValue(mockResponse);

      const currentUser = {
        userId: 1,
        email: 'admin@example.com',
        role: 'admin',
      };
      const result = await controller.getAllUsers(query, currentUser);

      expect(result).toEqual(mockResponse);
      expect(service.getAllUsers).toHaveBeenCalledWith(query, currentUser);
    });

    it('should handle search parameter', async () => {
      const query: GetUsersQueryDto = {
        search: 'john',
        limit: 20,
        sort_by: 'created_at',
        sort_order: 'DESC',
      };

      const mockResponse: PaginatedResponseDto<UserResponseDto> = {
        data: [],
        pagination: {
          hasMore: false,
          totalCount: 0,
          limit: 20,
          cursor: undefined,
        },
      };

      (service.getAllUsers as jest.Mock).mockResolvedValue(mockResponse);

      const currentUser = {
        userId: 1,
        email: 'admin@example.com',
        role: 'admin',
      };
      await controller.getAllUsers(query, currentUser);

      expect(service.getAllUsers).toHaveBeenCalledWith(query, currentUser);
    });

    it('should handle filtering by role and status', async () => {
      const query: GetUsersQueryDto = {
        role: ['admin', 'manager'],
        status: ['active'],
        limit: 20,
        sort_by: 'created_at',
        sort_order: 'DESC',
      };

      const mockResponse: PaginatedResponseDto<UserResponseDto> = {
        data: [],
        pagination: {
          hasMore: false,
          totalCount: 0,
          limit: 20,
          cursor: undefined,
        },
      };

      (service.getAllUsers as jest.Mock).mockResolvedValue(mockResponse);

      const currentUser = {
        userId: 1,
        email: 'admin@example.com',
        role: 'admin',
      };
      await controller.getAllUsers(query, currentUser);

      expect(service.getAllUsers).toHaveBeenCalledWith(query, currentUser);
    });

    it('should handle cursor-based pagination', async () => {
      const query: GetUsersQueryDto = {
        cursor: 'eyJpZCI6MSwgImNyZWF0ZWRBdCI6IjIwMjQtMDEtMDEifQ==',
        limit: 20,
        sort_by: 'created_at',
        sort_order: 'DESC',
      };

      const mockResponse: PaginatedResponseDto<UserResponseDto> = {
        data: [],
        pagination: {
          hasMore: false,
          totalCount: 100,
          limit: 20,
          cursor: 'next-cursor',
        },
      };

      (service.getAllUsers as jest.Mock).mockResolvedValue(mockResponse);

      const currentUser = {
        userId: 1,
        email: 'admin@example.com',
        role: 'admin',
      };
      await controller.getAllUsers(query, currentUser);

      expect(service.getAllUsers).toHaveBeenCalledWith(query, currentUser);
    });
  });

  describe('getUser', () => {
    it('should return a single user', async () => {
      const mockUser: UserResponseDto = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        role: 'admin',
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      };

      (service.getUserById as jest.Mock).mockResolvedValue(mockUser);

      const result = await controller.getUser(1);

      expect(result).toEqual(mockUser);
      expect(service.getUserById).toHaveBeenCalledWith(1);
    });
  });

  describe('createUser', () => {
    it('should create a new user', async () => {
      const createDto = {
        name: 'Jane Doe',
        email: 'jane@example.com',
        password: 'password123',
      };

      const mockCreatedUser: UserResponseDto = {
        id: 2,
        name: 'Jane Doe',
        email: 'jane@example.com',
        role: 'user',
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
        message: 'user created successfully...',
      };

      (service.createUser as jest.Mock).mockResolvedValue(mockCreatedUser);

      const result = await controller.createUser(createDto);

      expect(result).toEqual(mockCreatedUser);
      expect(service.createUser).toHaveBeenCalledWith(createDto);
    });
  });

  describe('updateUser', () => {
    it('should update a user', async () => {
      const updateDto = {
        name: 'John Updated',
        email: 'john.updated@example.com',
        password: 'newpassword',
      };

      const mockUpdatedUser: UserResponseDto = {
        id: 1,
        name: 'John Updated',
        email: 'john.updated@example.com',
        role: 'admin',
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
        message: 'user updated successfully',
      };

      (service.updateUser as jest.Mock).mockResolvedValue(mockUpdatedUser);

      const adminUser = {
        userId: 1,
        email: 'admin@example.com',
        role: 'admin',
      };
      const result = await controller.updateUser(1, updateDto, adminUser);

      expect(result).toEqual(mockUpdatedUser);
      expect(service.updateUser).toHaveBeenCalledWith(1, updateDto);
    });
  });

  describe('deleteUser', () => {
    it('should delete a user', async () => {
      const message = 'user deleted successfully...';

      (service.deleteUser as jest.Mock).mockResolvedValue(message);

      const result = await controller.deleteUser(1);

      expect(result).toBe(message);
      expect(service.deleteUser).toHaveBeenCalledWith(1);
    });
  });

  describe('updateProfile', () => {
    it('should update profile fields', async () => {
      const profileDto = {
        displayName: 'Jane',
        bio: 'My bio',
        avatarUrl: 'https://example.com/avatar.png',
      };

      const mockUpdated: UserResponseDto = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        role: 'user',
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
        displayName: 'Jane',
        bio: 'My bio',
        avatarUrl: 'https://example.com/avatar.png',
      };

      (service.updateProfile as jest.Mock).mockResolvedValue(mockUpdated);

      const adminUser = {
        userId: 1,
        email: 'admin@example.com',
        role: 'admin',
      };
      const result = await controller.updateProfile(1, profileDto, adminUser);

      expect(result).toEqual(mockUpdated);
      expect(service.updateProfile).toHaveBeenCalledWith(1, profileDto);
    });
  });
});
