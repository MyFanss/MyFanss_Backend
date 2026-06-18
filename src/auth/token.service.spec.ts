import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { TokenService } from './token.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { AppLogger } from '../logger/app-logger.service';
import * as bcrypt from 'bcrypt';

const mockRepo = () => ({
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  update: jest.fn(),
});

const mockJwtService = () => ({
  sign: jest.fn(),
  verify: jest.fn(),
});

const mockConfig = () => ({
  get: jest.fn((key: string) => {
    const map: Record<string, string> = {
      JWT_ACCESS_SECRET: 'access-secret',
      JWT_REFRESH_SECRET: 'refresh-secret',
    };
    return map[key];
  }),
});

const mockLogger = () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('TokenService', () => {
  let service: TokenService;
  let repo: ReturnType<typeof mockRepo>;
  let jwtService: ReturnType<typeof mockJwtService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: getRepositoryToken(RefreshToken), useFactory: mockRepo },
        { provide: JwtService, useFactory: mockJwtService },
        { provide: ConfigService, useFactory: mockConfig },
        { provide: AppLogger, useFactory: mockLogger },
      ],
    }).compile();

    service = module.get(TokenService);
    repo = module.get(getRepositoryToken(RefreshToken));
    jwtService = module.get(JwtService);
  });

  describe('issueTokenPair', () => {
    it('returns a token pair with correct shape', async () => {
      jwtService.sign.mockReturnValue('signed-token');
      repo.save.mockResolvedValue({});

      const result = await service.issueTokenPair(1, 'test@test.com');

      expect(result.accessToken).toBe('signed-token');
      expect(result.refreshToken).toBe('signed-token');
      expect(result.tokenType).toBe('Bearer');
      expect(result.expiresIn).toBe(900);
      expect(result.refreshExpiresIn).toBe(604800);
    });

    it('stores a hashed refresh token — never plaintext', async () => {
      jwtService.sign.mockReturnValue('raw-refresh');
      repo.save.mockResolvedValue({});

      await service.issueTokenPair(1, 'test@test.com');

      const savedArg = repo.save.mock.calls[0][0];
      expect(savedArg.tokenHash).toBeDefined();
      expect(savedArg.tokenHash).not.toBe('raw-refresh');
      const matches = await bcrypt.compare('raw-refresh', savedArg.tokenHash);
      expect(matches).toBe(true);
    });

    it('accepts deviceId, userAgent, ipAddress', async () => {
      jwtService.sign.mockReturnValue('t');
      repo.save.mockResolvedValue({});

      await service.issueTokenPair(1, 'a@b.com', {
        deviceId: 'dev-1',
        userAgent: 'Mozilla',
        ipAddress: '1.2.3.4',
      });

      const saved = repo.save.mock.calls[0][0];
      expect(saved.deviceId).toBe('dev-1');
      expect(saved.userAgent).toBe('Mozilla');
      expect(saved.ipAddress).toBe('1.2.3.4');
    });
  });

  describe('rotateRefreshToken', () => {
    it('throws REFRESH_TOKEN_INVALID for bad jwt', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('invalid');
      });

      await expect(service.rotateRefreshToken('bad')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws REFRESH_TOKEN_EXPIRED for expired jwt', async () => {
      jwtService.verify.mockImplementation(() => {
        const error = new Error('expired');
        error.name = 'TokenExpiredError';
        throw error;
      });

      await expect(service.rotateRefreshToken('expired')).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'REFRESH_TOKEN_EXPIRED' }),
      });
    });

    it('throws REFRESH_TOKEN_INVALID for wrong token type', async () => {
      jwtService.verify.mockReturnValue({
        sub: 1,
        email: 'a@b.com',
        jti: 'jti',
        type: 'access',
        familyId: 'fam',
        tokenId: 'tid',
      });

      await expect(service.rotateRefreshToken('tok')).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'REFRESH_TOKEN_INVALID' }),
      });
    });

    it('throws REFRESH_TOKEN_INVALID when stored record not found', async () => {
      jwtService.verify.mockReturnValue({
        sub: 1,
        email: 'a@b.com',
        jti: 'jti',
        type: 'refresh',
        familyId: 'fam',
        tokenId: 'tid',
      });
      repo.findOne.mockResolvedValue(null);

      await expect(service.rotateRefreshToken('tok')).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'REFRESH_TOKEN_INVALID' }),
      });
    });

    it('throws REFRESH_TOKEN_REUSE_DETECTED and revokes family when token is already revoked', async () => {
      jwtService.verify.mockReturnValue({
        sub: 1,
        email: 'a@b.com',
        jti: 'jti',
        type: 'refresh',
        familyId: 'fam-1',
        tokenId: 'tid-1',
      });
      repo.findOne.mockResolvedValue({
        id: 'tid-1',
        userId: 1,
        jti: 'jti',
        familyId: 'fam-1',
        isRevoked: true,
      });
      repo.update.mockResolvedValue({});

      await expect(service.rotateRefreshToken('tok')).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'REFRESH_TOKEN_REUSE_DETECTED',
        }),
      });

      expect(repo.update).toHaveBeenCalledWith(
        { familyId: 'fam-1', isRevoked: false },
        { isRevoked: true },
      );
    });

    it('throws REFRESH_TOKEN_EXPIRED for expired stored token rows', async () => {
      jwtService.verify.mockReturnValue({
        sub: 1,
        email: 'a@b.com',
        jti: 'jti',
        type: 'refresh',
        familyId: 'fam-1',
        tokenId: 'tid-1',
      });
      repo.findOne.mockResolvedValue({
        id: 'tid-1',
        userId: 1,
        jti: 'jti',
        familyId: 'fam-1',
        isRevoked: false,
        expiresAt: new Date(Date.now() - 1000),
      });
      repo.update.mockResolvedValue({});

      await expect(service.rotateRefreshToken('tok')).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'REFRESH_TOKEN_EXPIRED' }),
      });
      expect(repo.update).toHaveBeenCalledWith('tid-1', { isRevoked: true });
    });
  });

  describe('revokeAllUserTokens', () => {
    it('revokes all active tokens for a user', async () => {
      repo.update.mockResolvedValue({});
      await service.revokeAllUserTokens(42);
      expect(repo.update).toHaveBeenCalledWith(
        { userId: 42, isRevoked: false },
        { isRevoked: true },
      );
    });
  });

  describe('getActiveSessions', () => {
    it('returns non-revoked sessions for user', async () => {
      const sessions = [{ id: 's1' }, { id: 's2' }];
      repo.find.mockResolvedValue(sessions);
      const result = await service.getActiveSessions(1);
      expect(result).toEqual(sessions);
      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 1, isRevoked: false } }),
      );
    });
  });

  describe('revokeSession', () => {
    it('returns false when session not found', async () => {
      repo.findOne.mockResolvedValue(null);
      const result = await service.revokeSession('sid', 1);
      expect(result).toBe(false);
    });

    it('returns true and revokes when session belongs to user', async () => {
      repo.findOne.mockResolvedValue({ id: 'sid', userId: 1 });
      repo.update.mockResolvedValue({});
      const result = await service.revokeSession('sid', 1);
      expect(result).toBe(true);
      expect(repo.update).toHaveBeenCalledWith('sid', { isRevoked: true });
    });
  });
});
