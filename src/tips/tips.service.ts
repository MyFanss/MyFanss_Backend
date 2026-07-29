import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { Tip } from './tip.entity';
import { User } from '../users/user.entity';
import { UserRole } from '../auth/enums/role.enum';
import { TipStatus } from './enums/tip-status.enum';
import { CreateTipIntentDto } from './dto/create-tip-intent.dto';
import { ConfirmTipDto } from './dto/confirm-tip.dto';
import { TipQueryDto } from './dto/tip-query.dto';
import { TipResponseDto } from './dto/tip-response.dto';
import { computeTipFee } from './tip-fee.util';
import { getTipsConfig, TipsConfig } from '../config/configuration';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/audit-action.enum';
import {
  PaginatedResponseDto,
  PaginationMetaDto,
} from '../users/dtos/paginated-response.dto';

const UNIQUE_VIOLATION = '23505';

@Injectable()
export class TipsService {
  private readonly tipsConfig: TipsConfig;

  constructor(
    @InjectRepository(Tip)
    private readonly tipRepository: Repository<Tip>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    configService: ConfigService,
    private readonly auditService: AuditService,
  ) {
    this.tipsConfig = getTipsConfig(configService);
  }

  /**
   * POST /tips/intents — creates a pending tip quote with server-computed fees.
   * Idempotent: replaying the same key (header or body) returns the original tip.
   */
  async createIntent(
    fanId: number,
    dto: CreateTipIntentDto,
    idempotencyKeyHeader?: string,
  ): Promise<TipResponseDto> {
    const tip = await this.createIntentEntity(fanId, dto, idempotencyKeyHeader);
    return this.toResponse(tip);
  }

  /**
   * POST /tips — shorthand that runs createIntent + confirm in one call,
   * reusing the exact same idempotency and fee logic as the two-step flow.
   */
  async createShorthand(
    fanId: number,
    dto: CreateTipIntentDto,
    idempotencyKeyHeader?: string,
  ): Promise<TipResponseDto> {
    const tip = await this.createIntentEntity(fanId, dto, idempotencyKeyHeader);

    if (tip.status !== TipStatus.PENDING) {
      // Idempotent replay of an already-finalized tip; nothing left to confirm.
      return this.toResponse(tip);
    }

    const confirmed = await this.confirmEntity(tip.id, fanId, {
      simulateFailure: dto.simulateFailure,
    });
    return this.toResponse(confirmed);
  }

  /**
   * POST /tips/intents/:id/confirm — completes the stub charge (or fails it).
   * Idempotent for a tip that is already completed.
   */
  async confirm(
    tipId: string,
    fanId: number,
    dto: ConfirmTipDto,
  ): Promise<TipResponseDto> {
    const tip = await this.confirmEntity(tipId, fanId, dto);
    return this.toResponse(tip);
  }

  /**
   * GET /tips/me — fan's own tip history.
   */
  async listFanHistory(
    fanId: number,
    query: TipQueryDto,
  ): Promise<PaginatedResponseDto<TipResponseDto>> {
    return this.listByOwner('fanId', fanId, query);
  }

  /**
   * GET /creators/me/tips — creator's own tip inbox.
   */
  async listCreatorInbox(
    creatorId: number,
    query: TipQueryDto,
  ): Promise<PaginatedResponseDto<TipResponseDto>> {
    return this.listByOwner('creatorId', creatorId, query);
  }

  private async createIntentEntity(
    fanId: number,
    dto: CreateTipIntentDto,
    idempotencyKeyHeader?: string,
  ): Promise<Tip> {
    const idempotencyKey =
      idempotencyKeyHeader ?? dto.idempotencyKey ?? randomUUID();

    const existing = await this.tipRepository.findOne({
      where: { idempotencyKey },
    });
    if (existing) {
      if (existing.fanId !== fanId) {
        throw new ConflictException('Idempotency key already used');
      }
      return existing;
    }

    if (dto.creatorId === fanId) {
      throw new BadRequestException('Cannot tip yourself');
    }

    const creator = await this.userRepository.findOne({
      where: { id: dto.creatorId },
    });
    if (!creator || (creator.role as UserRole) !== UserRole.CREATOR) {
      throw new NotFoundException('Creator not found');
    }

    const { minAmountCents, maxAmountCents, platformFeeBps } = this.tipsConfig;
    if (dto.amountCents < minAmountCents || dto.amountCents > maxAmountCents) {
      throw new BadRequestException(
        `amountCents must be between ${minAmountCents} and ${maxAmountCents}`,
      );
    }

    const { feeCents, creatorNetCents } = computeTipFee(
      dto.amountCents,
      platformFeeBps,
    );

    const tip = this.tipRepository.create({
      fanId,
      creatorId: dto.creatorId,
      amountCents: dto.amountCents,
      currency: (dto.currency ?? 'USD').toUpperCase(),
      message: dto.message ?? null,
      status: TipStatus.PENDING,
      idempotencyKey,
      feeCents,
      creatorNetCents,
    });

    let saved: Tip;
    try {
      saved = await this.tipRepository.save(tip);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const raceWinner = await this.tipRepository.findOne({
          where: { idempotencyKey },
        });
        if (raceWinner) return raceWinner;
      }
      throw error;
    }

    void this.auditService.log({
      actorId: fanId,
      action: AuditAction.TIP_INTENT_CREATED,
      targetType: 'Tip',
      targetId: null,
      metadata: {
        tipId: saved.id,
        creatorId: saved.creatorId,
        amountCents: saved.amountCents,
        feeCents: saved.feeCents,
      },
    });

    return saved;
  }

  private async confirmEntity(
    tipId: string,
    fanId: number,
    dto: ConfirmTipDto,
  ): Promise<Tip> {
    const tip = await this.tipRepository.findOne({ where: { id: tipId } });
    if (!tip || tip.fanId !== fanId) {
      throw new NotFoundException('Tip not found');
    }

    if (tip.status === TipStatus.COMPLETED) {
      return tip;
    }

    if (tip.status !== TipStatus.PENDING) {
      throw new ConflictException(`Tip is already ${tip.status}`);
    }

    tip.status = dto.simulateFailure ? TipStatus.FAILED : TipStatus.COMPLETED;
    tip.confirmedAt = new Date();
    const saved = await this.tipRepository.save(tip);

    void this.auditService.log({
      actorId: fanId,
      action:
        saved.status === TipStatus.COMPLETED
          ? AuditAction.TIP_CONFIRMED
          : AuditAction.TIP_FAILED,
      targetType: 'Tip',
      targetId: null,
      metadata: { tipId: saved.id, creatorId: saved.creatorId },
    });

    return saved;
  }

  private async listByOwner(
    ownerField: 'fanId' | 'creatorId',
    ownerId: number,
    query: TipQueryDto,
  ): Promise<PaginatedResponseDto<TipResponseDto>> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? query.limit : 20;

    const where: Record<string, unknown> = { [ownerField]: ownerId };
    if (query.status) {
      where.status = query.status;
    }

    const [rows, totalCount] = await this.tipRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: rows.map((row) => this.toResponse(row)),
      pagination: this.buildMeta(page, limit, totalCount),
    };
  }

  private buildMeta(
    page: number,
    limit: number,
    totalCount: number,
  ): PaginationMetaDto {
    return {
      hasMore: page * limit < totalCount,
      totalCount,
      limit,
    };
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      (error as unknown as { code?: string }).code === UNIQUE_VIOLATION
    );
  }

  private toResponse(tip: Tip): TipResponseDto {
    return {
      id: tip.id,
      fanId: tip.fanId,
      creatorId: tip.creatorId,
      amountCents: tip.amountCents,
      currency: tip.currency,
      message: tip.message,
      status: tip.status,
      feeCents: tip.feeCents,
      creatorNetCents: tip.creatorNetCents,
      createdAt: tip.createdAt,
      updatedAt: tip.updatedAt,
      confirmedAt: tip.confirmedAt,
    };
  }
}
