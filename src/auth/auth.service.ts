import { Injectable, UnauthorizedException, InternalServerErrorException, NotFoundException, BadRequestException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { SignupDto } from './dto/signup.dto';
import { TokenService, TokenPair } from './token.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UserRole } from './enums/role.enum';

export interface AuthResponse extends TokenPair {
  user: { id: number; name: string; email: string; role: UserRole };
  message?: string;
}

export interface AuthenticatedUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly tokenService: TokenService,
    @InjectRepository(PasswordResetToken)
    private readonly passwordResetTokenRepository: Repository<PasswordResetToken>,
  ) {}

  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(token, 10);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.passwordResetTokenRepository.save({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    // Log token in dev mode (stub email delivery)
    console.log(`Password reset token for ${email}: ${token}`);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    if (newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    const tokens = await this.passwordResetTokenRepository.find({
      where: { tokenHash: await bcrypt.hash(token, 10) },
    });

    if (!tokens || tokens.length === 0) {
      throw new NotFoundException('Invalid or expired reset token');
    }

    const validToken = tokens.find(
      t => t.expiresAt > new Date() && !t.usedAt,
    );

    if (!validToken) {
      throw new BadRequestException('Reset token expired or already used');
    }

    const user = await this.usersService.findById(validToken.userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.usersService.updatePassword(user.id, hashedPassword);

    await this.passwordResetTokenRepository.update(validToken.id, { usedAt: new Date() });

    await this.invalidateSessionsOnPasswordChange(user.id);
  }

  private async updatePassword(userId: number, hashedPassword: string): Promise<void> {
    await this.usersService.userRepository.update(userId, { password: hashedPassword });
  }

  async validateUser(
    email: string,
    pass: string,
  ): Promise<AuthenticatedUser | null> {
    const user = await this.usersService.findByEmail(email);
    if (user && (await bcrypt.compare(pass, user.password))) {
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: (user.role as UserRole) ?? UserRole.FAN,
      };
    }
    return null;
  }

  async signup(
    signupDto: SignupDto,
    opts: { deviceId?: string; userAgent?: string; ipAddress?: string } = {},
  ): Promise<AuthResponse> {
    const userResponse = await this.usersService.createUser(signupDto);
    const user = await this.usersService.findByEmail(signupDto.email);
    if (!user) throw new UnauthorizedException('User creation failed');

    const tokens = await this.tokenService.issueTokenPair(
      user.id,
      user.email,
      (user.role as UserRole) ?? UserRole.FAN,
      opts,
    );
    return {
      ...tokens,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: (user.role as UserRole) ?? UserRole.FAN,
      },
      message: userResponse.message,
    };
  }

  async login(
    user: AuthenticatedUser,
    opts: { deviceId?: string; userAgent?: string; ipAddress?: string } = {},
  ): Promise<AuthResponse> {
    const tokens = await this.tokenService.issueTokenPair(
      user.id,
      user.email,
      user.role,
      opts,
    );
    return {
      ...tokens,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  async refresh(
    rawRefreshToken: string,
    opts: { deviceId?: string; userAgent?: string; ipAddress?: string } = {},
  ): Promise<TokenPair> {
    return this.tokenService.rotateRefreshToken(rawRefreshToken, opts);
  }

  async logout(refreshToken: string): Promise<void> {
    const payload = this.tokenService.decodeRefreshToken(refreshToken);
    if (!payload) return;
    await this.tokenService.revokeToken(payload.tokenId);
  }

  async logoutAll(userId: number): Promise<void> {
    await this.tokenService.revokeAllUserTokens(userId);
  }

  async getSessions(userId: number): Promise<RefreshToken[]> {
    return this.tokenService.getActiveSessions(userId);
  }

  async deleteSession(sessionId: string, userId: number): Promise<boolean> {
    return this.tokenService.revokeSession(sessionId, userId);
 }

 async invalidateSessionsOnPasswordChange(userId: number): Promise<void> {
    await this.tokenService.revokeAllUserTokens(userId);
  }
}
