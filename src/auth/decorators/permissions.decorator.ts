import { SetMetadata } from '@nestjs/common';
import { Permission } from '../enums/role.enum';

export const PERMISSIONS_KEY = 'permissions';

export const Permissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
