export class CreateAuditLogDto {
  actorId: number | null;
  action: string;
  targetType: string;
  targetId?: number | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
}
