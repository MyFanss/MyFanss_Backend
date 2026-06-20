import { IsEnum, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../auth/enums/role.enum';

export class AssignRoleDto {
  @ApiProperty({
    enum: UserRole,
    description: 'Role to assign',
    example: UserRole.CREATOR,
  })
  @IsNotEmpty()
  @IsEnum(UserRole, {
    message: 'role must be one of: fan, creator, admin',
  })
  role: UserRole;
}
