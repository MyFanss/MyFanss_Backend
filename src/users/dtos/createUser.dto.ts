import { Expose } from 'class-transformer';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'Jane Doe', description: 'Full name of the user' })
  @Expose()
  @IsString()
  name!: string;

  @ApiProperty({
    example: 'jane@example.com',
    description: 'Unique email address',
  })
  @Expose()
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'StrongPass1!',
    description: 'Password (minimum 8 characters)',
  })
  @Expose()
  @IsString()
  @MinLength(8)
  password!: string;

  constructor(name: string, email: string, password: string) {
    this.name = name;
    this.email = email;
    this.password = password;
  }
}
