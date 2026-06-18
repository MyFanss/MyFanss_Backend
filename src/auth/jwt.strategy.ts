import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

interface JwtAccessPayload {
  sub: number;
  email: string;
  type?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_ACCESS_SECRET') ??
        configService.get<string>('JWT_SECRET') ??
        'fallback-access-secret',
    });
  }

  async validate(payload: JwtAccessPayload) {
    if (payload.type !== 'access') {
      throw new UnauthorizedException({
        message: 'Refresh tokens cannot be used as access tokens',
        code: 'ACCESS_TOKEN_INVALID',
      });
    }
    return {
      userId: payload.sub,
      email: payload.email,
      username: payload.email,
    };
  }
}
