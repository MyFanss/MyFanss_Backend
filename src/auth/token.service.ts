import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { RefreshToken } from './entities/refresh-token.entity';
import { AppLogger } from '../logger/app-logger.service';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
  tokenType: string;
}

export interface RefreshPayload {
  sub: number;
  email: string;
  jti: string;
  type: 'refresh';
  familyId: string;
  tokenId: string;
}

export interface AccessPayload {
  sub: number;
  email: string;
  jti: string;
  type: 'access';
}

type DeviceInfo = {
  deviceId?: string;
  userAgent?: string;
  ipAddress?: string;
};

@Injectable()
export class TokenService {
  private readonly ACCESS_EXPIRES_SECONDS = 15 * 60; // 15 min
  private readonly REFRESH_EXPIRES_SECONDS = 7 * 24 * 60 * 60; // 7 days

  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly logger: AppLogger,
  ) {}

  async issueTokenPair(
    userId: number,
    email: string,
    opts: DeviceInfo & { familyId?: string } = {},
  ): Promise<TokenPair> {
    const tokenPair = await this.createTokenPair(userId, email, opts);
    return this.toPublicTokenPair(tokenPair);
  }

  private async createTokenPair(
    userId: number,
    email: string,
    opts: DeviceInfo & { familyId?: string } = {},
  ): Promise<TokenPair & { tokenId: string }> {
    const jti = randomUUID();
    const familyId = opts.familyId ?? randomUUID();
    const tokenId = randomUUID();

    const accessPayload = {
      sub: userId,
      email,
      jti: randomUUID(),
      type: 'access' as const,
    };
    const refreshPayload: Omit<RefreshPayload, 'iat' | 'exp'> = {
      sub: userId,
      email,
      jti,
      type: 'refresh' as const,
      familyId,
      tokenId,
    };

    const accessSecret = this.getAccessSecret();
    const refreshSecret = this.getRefreshSecret();

    const accessToken = this.jwtService.sign(accessPayload, {
      secret: accessSecret,
      expiresIn: this.ACCESS_EXPIRES_SECONDS,
    });

    const rawRefreshToken = this.jwtService.sign(refreshPayload, {
      secret: refreshSecret,
      expiresIn: this.REFRESH_EXPIRES_SECONDS,
    });

    const tokenHash = await bcrypt.hash(rawRefreshToken, 10);
    const expiresAt = new Date(
      Date.now() + this.REFRESH_EXPIRES_SECONDS * 1000,
    );

    await this.refreshTokenRepo.save({
      id: tokenId,
      userId,
      tokenHash,
      familyId,
      jti,
      deviceId: opts.deviceId ?? null,
      userAgent: opts.userAgent ?? null,
      ipAddress: opts.ipAddress ?? null,
      isRevoked: false,
      replacedByTokenId: null,
      expiresAt,
    });

    this.logger.log(
      `Issued token pair for userId=${userId} jti=${jti}`,
      TokenService.name,
    );

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: this.ACCESS_EXPIRES_SECONDS,
      refreshExpiresIn: this.REFRESH_EXPIRES_SECONDS,
      tokenType: 'Bearer',
      tokenId,
    };
  }

  async rotateRefreshToken(
    rawRefreshToken: string,
    opts: DeviceInfo = {},
  ): Promise<TokenPair> {
    const refreshSecret = this.getRefreshSecret();

    let payload: RefreshPayload;
    try {
      payload = this.jwtService.verify<RefreshPayload>(rawRefreshToken, {
        secret: refreshSecret,
      });
    } catch (error) {
      if ((error as Error).name === 'TokenExpiredError') {
        throw new UnauthorizedException({
          message: 'Refresh token expired',
          code: 'REFRESH_TOKEN_EXPIRED',
        });
      }
      throw new UnauthorizedException({
        message: 'Invalid or expired refresh token',
        code: 'REFRESH_TOKEN_INVALID',
      });
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException({
        message: 'Invalid token type',
        code: 'REFRESH_TOKEN_INVALID',
      });
    }

    const stored = await this.refreshTokenRepo.findOne({
      where: { id: payload.tokenId },
    });

    if (
      !stored ||
      stored.userId !== payload.sub ||
      stored.jti !== payload.jti ||
      stored.familyId !== payload.familyId
    ) {
      throw new UnauthorizedException({
        message: 'Refresh token not found',
        code: 'REFRESH_TOKEN_INVALID',
      });
    }

    // Reuse detection: token already revoked → revoke entire family
    if (stored.isRevoked) {
      this.logger.warn(
        `Refresh token reuse detected for familyId=${payload.familyId} userId=${payload.sub}`,
        TokenService.name,
      );
      await this.revokeFamilyTokens(payload.familyId);
      throw new UnauthorizedException({
        message: 'Refresh token reuse detected',
        code: 'REFRESH_TOKEN_REUSE_DETECTED',
      });
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      await this.revokeToken(stored.id);
      throw new UnauthorizedException({
        message: 'Refresh token expired',
        code: 'REFRESH_TOKEN_EXPIRED',
      });
    }

    const valid = await bcrypt.compare(rawRefreshToken, stored.tokenHash);
    if (!valid) {
      throw new UnauthorizedException({
        message: 'Invalid refresh token',
        code: 'REFRESH_TOKEN_INVALID',
      });
    }

    const newPair = await this.createTokenPair(payload.sub, payload.email, {
      familyId: payload.familyId,
      deviceId: opts.deviceId ?? stored.deviceId ?? undefined,
      userAgent: opts.userAgent ?? stored.userAgent ?? undefined,
      ipAddress: opts.ipAddress ?? stored.ipAddress ?? undefined,
    });

    await this.refreshTokenRepo.update(stored.id, {
      isRevoked: true,
      replacedByTokenId: newPair.tokenId,
    });

    return this.toPublicTokenPair(newPair);
  }

  async revokeToken(tokenId: string): Promise<void> {
    await this.refreshTokenRepo.update(tokenId, { isRevoked: true });
  }

  async revokeAllUserTokens(userId: number): Promise<void> {
    await this.refreshTokenRepo.update(
      { userId, isRevoked: false },
      { isRevoked: true },
    );
  }

  private async revokeFamilyTokens(familyId: string): Promise<void> {
    await this.refreshTokenRepo.update(
      { familyId, isRevoked: false },
      { isRevoked: true },
    );
  }

  verifyAccessToken(token: string): AccessPayload {
    const secret = this.getAccessSecret();
    return this.jwtService.verify<AccessPayload>(token, { secret });
  }

  decodeRefreshToken(raw: string): RefreshPayload | null {
    try {
      const refreshSecret = this.getRefreshSecret();
      return this.jwtService.verify<RefreshPayload>(raw, {
        secret: refreshSecret,
      });
    } catch {
      return null;
    }
  }

  async getActiveSessions(userId: number): Promise<RefreshToken[]> {
    return this.refreshTokenRepo.find({
      where: { userId, isRevoked: false, expiresAt: MoreThan(new Date()) },
      order: { createdAt: 'DESC' },
    });
  }

  async revokeSession(sessionId: string, userId: number): Promise<boolean> {
    const session = await this.refreshTokenRepo.findOne({
      where: { id: sessionId, userId },
    });
    if (!session) return false;
    await this.refreshTokenRepo.update(sessionId, { isRevoked: true });
    return true;
  }

  private getAccessSecret(): string {
    return (
      this.configService.get<string>('JWT_ACCESS_SECRET') ??
      this.configService.get<string>('JWT_SECRET') ??
      'fallback-access-secret'
    );
  }

  private getRefreshSecret(): string {
    return (
      this.configService.get<string>('JWT_REFRESH_SECRET') ??
      'fallback-refresh-secret'
    );
  }

  private toPublicTokenPair(
    tokenPair: TokenPair & { tokenId: string },
  ): TokenPair {
    return {
      accessToken: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
      expiresIn: tokenPair.expiresIn,
      refreshExpiresIn: tokenPair.refreshExpiresIn,
      tokenType: tokenPair.tokenType,
    };
  }
}
