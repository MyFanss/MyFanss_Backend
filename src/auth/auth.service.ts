import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { ConfigService } from '@nestjs/config';
import { SignupDto } from './dto/signup.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (user && (await bcrypt.compare(pass, user.password))) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async signup(signupDto: SignupDto) {
    const userResponse = await this.usersService.createUser(signupDto);
    // Get the actual user to create JWT payload
    const user = await this.usersService.findByEmail(signupDto.email);

    if (!user) {
      throw new UnauthorizedException('User creation failed');
    }

    const payload = { username: signupDto.email, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload),
      expires_in: this.configService.get<string>('JWT_EXPIRES_IN'),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      message: userResponse.message,
    };
  }

  async login(user: any) {
    const payload = { username: user.email, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload),
      expires_in: this.configService.get<string>('JWT_EXPIRES_IN'),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    };
  }
}
