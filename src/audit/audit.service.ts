import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit.entity';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';
import { AppLogger } from '../logger/app-logger.service';

const SENSITIVE_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /authorization/i,
  /refreshToken/i,
  /accessToken/i,
  /api[_-]?key/i,
];

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly logger: AppLogger,
  ) {}

  async log(entry: CreateAuditLogDto): Promise<void> {
    try {
      const safeMetadata = this.redactSensitive(entry.metadata ?? null);
      await this.auditLogRepository.save({
        actorId: entry.actorId ?? null,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId ?? null,
        metadata: safeMetadata,
        ipAddress: entry.ipAddress ?? null,
      });
    } catch (error) {
      this.logger.error(
        `Failed to persist audit log: ${(error as Error).message}`,
        (error as Error).stack,
        'AuditService',
      );
    }
  }

  async findLogs(
    query: QueryAuditLogsDto,
  ): Promise<{ data: AuditLog[]; total: number; page: number; limit: number }> {
    const qb = this.auditLogRepository.createQueryBuilder('audit');

    if (query.action) {
      qb.andWhere('audit.action = :action', { action: query.action });
    }

    if (query.actorId) {
      qb.andWhere('audit.actorId = :actorId', { actorId: query.actorId });
    }

    if (query.startDate) {
      qb.andWhere('audit.createdAt >= :startDate', {
        startDate: query.startDate,
      });
    }

    if (query.endDate) {
      qb.andWhere('audit.createdAt <= :endDate', {
        endDate: query.endDate,
      });
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    qb.orderBy('audit.createdAt', 'DESC').skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return { data, total, page, limit };
  }

  private redactSensitive(
    metadata: Record<string, unknown> | null,
  ): Record<string, unknown> | null {
    if (!metadata) return null;
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (SENSITIVE_PATTERNS.some((pattern) => pattern.test(key))) {
        cleaned[key] = '[REDACTED]';
      } else {
        cleaned[key] = value;
      }
    }
    return cleaned;
  }
}
