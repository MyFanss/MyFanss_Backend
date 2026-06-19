import { applyDecorators, UseGuards, SetMetadata } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';

export const ROLES_KEY = 'roles';
export const MIN_ROLE_KEY = 'minRole';

export function Auth(...roles: string[]) {
  return applyDecorators(
    SetMetadata(ROLES_KEY, roles),
    UseGuards(JwtAuthGuard, RolesGuard),
  );
}

export function Authenticated() {
  return applyDecorators(
    SetMetadata(ROLES_KEY, []),
    UseGuards(JwtAuthGuard, RolesGuard),
  );
}

export function MinRole(role: string, policies?: string[]) {
  return applyDecorators(
    SetMetadata(MIN_ROLE_KEY, { role, policies: policies ?? [] }),
    UseGuards(JwtAuthGuard, RolesGuard),
  );
}
