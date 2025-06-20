import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateUserDto } from './dtos/createUser.dto';
import { UserResponseDto } from './dtos/userResponse.dto';
import { plainToInstance } from 'class-transformer';
import { UpdateUserDto } from './dtos/updateUser.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async createUser(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    console.log('createUserDto', createUserDto);
    let searchUser: User | null = await this.getUserByEmail(
      createUserDto.email,
    );

    if (searchUser) {
      throw new ConflictException('user already exists with this email');
    }

    // Hash the password before saving
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(
      createUserDto.password,
      saltRounds,
    );

    let user: User = plainToInstance(User, {
      ...createUserDto,
      password: hashedPassword,
    });
    let savedUser: User = await this.userRepository.save(user);

    return plainToInstance(
      UserResponseDto,
      { message: 'user created successfully...', ...savedUser },
      {
        excludeExtraneousValues: true,
      },
    );
  }

  private getUserByEmail(email: string) {
    return this.userRepository.findOneBy({ email });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOneBy({ email });
  }

  private findById(id: number) {
    return this.userRepository.findOneBy({ id });
  }

  async getUserById(id: number): Promise<UserResponseDto> {
    let user: User | null = await this.findById(id);
    if (!user) {
      throw new NotFoundException('user not found');
    }
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  async getAllUsers(): Promise<UserResponseDto[]> {
    let users: User[] = await this.userRepository.find();
    return users.map((user) =>
      plainToInstance(UserResponseDto, user, {
        excludeExtraneousValues: true,
      }),
    );
  }

  async deleteUser(id: number): Promise<string> {
    let user: User | null = await this.findById(id);
    if (!user) {
      throw new NotFoundException('user not found');
    }

    await this.userRepository.delete(id);

    return 'user deleted successfully...';
  }

  async updateUser(
    id: number,
    updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    let user: User | null = await this.findById(id);
    if (!user) {
      throw new NotFoundException('user not found');
    }

    Object.assign(user, updateUserDto);
    let savedUser: User = await this.userRepository.save(user);

    return plainToInstance(
      UserResponseDto,
      { message: 'user updated successfully', ...savedUser },
      {
        excludeExtraneousValues: true,
      },
    );
  }
}
