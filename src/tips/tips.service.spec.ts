import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { TipsService } from './tips.service';
import { Tip } from './tip.entity';
import { User } from '../users/user.entity';
import { TipStatus } from './enums/tip-status.enum';
import { UserRole } from '../auth/enums/role.enum';
import { AuditService } from '../audit/audit.service';

const mockConfig = () => ({
  get: jest.fn(() => undefined), // forces defaults: 500 bps, 100-100000 cents
});

const mockAuditService = () => ({
  log: jest.fn(),
});

describe('TipsService', () => {
  let service: TipsService;
  let tipRepo: jest.Mocked<Repository<Tip>>;
  let userRepo: jest.Mocked<Repository<User>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TipsService,
        {
          provide: getRepositoryToken(Tip),
          useValue: {
            findOne: jest.fn(),
            findAndCount: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: { findOne: jest.fn() },
        },
        { provide: ConfigService, useFactory: mockConfig },
        { provide: AuditService, useFactory: mockAuditService },
      ],
    }).compile();

    service = module.get(TipsService);
    tipRepo = module.get(getRepositoryToken(Tip));
    userRepo = module.get(getRepositoryToken(User));
  });

  const creator = { id: 2, role: UserRole.CREATOR } as User;

  describe('createIntent', () => {
    it('rejects tipping yourself', async () => {
      tipRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createIntent(1, { creatorId: 1, amountCents: 500 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFound when the target does not exist', async () => {
      tipRepo.findOne.mockResolvedValue(null);
      userRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createIntent(1, { creatorId: 99, amountCents: 500 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFound when the target is not a creator', async () => {
      tipRepo.findOne.mockResolvedValue(null);
      userRepo.findOne.mockResolvedValue({ id: 2, role: UserRole.FAN } as User);

      await expect(
        service.createIntent(1, { creatorId: 2, amountCents: 500 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects amounts below the minimum', async () => {
      tipRepo.findOne.mockResolvedValue(null);
      userRepo.findOne.mockResolvedValue(creator);

      await expect(
        service.createIntent(1, { creatorId: 2, amountCents: 1 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects amounts above the maximum', async () => {
      tipRepo.findOne.mockResolvedValue(null);
      userRepo.findOne.mockResolvedValue(creator);

      await expect(
        service.createIntent(1, { creatorId: 2, amountCents: 10_000_000 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates a pending tip with server-computed fees', async () => {
      tipRepo.findOne.mockResolvedValue(null);
      userRepo.findOne.mockResolvedValue(creator);
      tipRepo.create.mockImplementation((v) => v as Tip);
      tipRepo.save.mockImplementation(
        async (t) =>
          ({
            ...t,
            id: 'tip-1',
            createdAt: new Date(),
            updatedAt: new Date(),
            confirmedAt: null,
          }) as Tip,
      );

      const result = await service.createIntent(1, {
        creatorId: 2,
        amountCents: 1000,
      });

      expect(result).toMatchObject({
        status: TipStatus.PENDING,
        feeCents: 50,
        creatorNetCents: 950,
      });
    });

    it('replays the same idempotency key back to the original tip', async () => {
      const existing = {
        id: 'tip-1',
        fanId: 1,
        creatorId: 2,
        status: TipStatus.COMPLETED,
        idempotencyKey: 'key-1',
      } as Tip;
      tipRepo.findOne.mockResolvedValue(existing);

      const result = await service.createIntent(
        1,
        { creatorId: 2, amountCents: 1000 },
        'key-1',
      );

      expect(result.id).toBe('tip-1');
      expect(userRepo.findOne).not.toHaveBeenCalled();
      expect(tipRepo.create).not.toHaveBeenCalled();
    });

    it('rejects an idempotency key already used by a different fan', async () => {
      const existing = {
        id: 'tip-1',
        fanId: 99,
        creatorId: 2,
        status: TipStatus.COMPLETED,
        idempotencyKey: 'key-1',
      } as Tip;
      tipRepo.findOne.mockResolvedValue(existing);

      await expect(
        service.createIntent(1, { creatorId: 2, amountCents: 1000 }, 'key-1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('confirm', () => {
    it('completes a pending tip', async () => {
      const pending = {
        id: 'tip-1',
        fanId: 1,
        creatorId: 2,
        status: TipStatus.PENDING,
      } as Tip;
      tipRepo.findOne.mockResolvedValue(pending);
      tipRepo.save.mockImplementation(async (t) => t as Tip);

      const result = await service.confirm('tip-1', 1, {});

      expect(result.status).toBe(TipStatus.COMPLETED);
      expect(result.confirmedAt).toBeInstanceOf(Date);
    });

    it('is idempotent for an already-completed tip (no duplicate save)', async () => {
      const completed = {
        id: 'tip-1',
        fanId: 1,
        creatorId: 2,
        status: TipStatus.COMPLETED,
        confirmedAt: new Date('2020-01-01'),
      } as Tip;
      tipRepo.findOne.mockResolvedValue(completed);

      const result = await service.confirm('tip-1', 1, {});

      expect(result.status).toBe(TipStatus.COMPLETED);
      expect(tipRepo.save).not.toHaveBeenCalled();
    });

    it('throws Conflict when confirming an already-failed tip', async () => {
      const failed = {
        id: 'tip-1',
        fanId: 1,
        creatorId: 2,
        status: TipStatus.FAILED,
      } as Tip;
      tipRepo.findOne.mockResolvedValue(failed);

      await expect(service.confirm('tip-1', 1, {})).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('throws NotFound when the tip does not belong to the caller', async () => {
      const pending = {
        id: 'tip-1',
        fanId: 1,
        creatorId: 2,
        status: TipStatus.PENDING,
      } as Tip;
      tipRepo.findOne.mockResolvedValue(pending);

      await expect(service.confirm('tip-1', 999, {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws NotFound when the tip does not exist', async () => {
      tipRepo.findOne.mockResolvedValue(null);

      await expect(service.confirm('missing', 1, {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('resolves as failed when simulateFailure is set', async () => {
      const pending = {
        id: 'tip-1',
        fanId: 1,
        creatorId: 2,
        status: TipStatus.PENDING,
      } as Tip;
      tipRepo.findOne.mockResolvedValue(pending);
      tipRepo.save.mockImplementation(async (t) => t as Tip);

      const result = await service.confirm('tip-1', 1, {
        simulateFailure: true,
      });

      expect(result.status).toBe(TipStatus.FAILED);
    });
  });

  describe('listFanHistory / listCreatorInbox', () => {
    it('scopes the fan history query to the caller', async () => {
      tipRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.listFanHistory(1, { page: 1, limit: 20 });

      expect(tipRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { fanId: 1 } }),
      );
    });

    it('scopes the creator inbox query to the caller', async () => {
      tipRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.listCreatorInbox(2, { page: 1, limit: 20 });

      expect(tipRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ where: { creatorId: 2 } }),
      );
    });
  });
});
