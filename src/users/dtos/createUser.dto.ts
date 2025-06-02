import { Expose } from 'class-transformer';

export class CreateUserDto {
  @Expose()
  name!: string;
  @Expose()
  email!: string;
  @Expose()
  password!: string;

  constructor(name: string, email: string, password: string) {
    this.name = name;
    this.email = email;
    this.password = password;
  }
}
