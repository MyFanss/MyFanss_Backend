import { Injectable, BadRequestException } from '@nestjs/common';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../user.entity';
import { GetUsersQueryDto } from '../dtos/get-users-query.dto';
import * as crypto from 'crypto';

interface DecodedCursor {
  id: number;
  createdAt: string;
}

interface QueryResult {
  users: User[];
  totalCount: number;
  nextCursor?: string;
  hasMore: boolean;
}

@Injectable()
export class UsersQueryService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async getUsers(
    query: GetUsersQueryDto,
    orgFilter?: number[],
  ): Promise<QueryResult> {
    const {
      cursor,
      limit = 20,
      search,
      role,
      status,
      org_id,
      created_from,
      created_to,
      sort_by = 'created_at',
      sort_order = 'DESC',
      page,
      page_size,
    } = query;

    let qb = this.userRepository.createQueryBuilder('user');

    // Apply soft delete filter
    qb = qb.where('user.is_deleted = false');

    // Apply search if provided
    if (search) {
      qb = this.applySearchFilter(qb, search);
    }

    // Apply field filters
    if (role && role.length > 0) {
      qb = qb.andWhere('user.role IN (:...roles)', { roles: role });
    }

    if (status && status.length > 0) {
      qb = qb.andWhere('user.status IN (:...statuses)', { statuses: status });
    }

    // Apply organization filter (both from query param and permission-based)
    const orgIds = org_id ? [...org_id] : [];
    if (orgFilter) {
      orgIds.push(...orgFilter);
    }
    if (orgIds.length > 0) {
      qb = qb.andWhere('(user.org_id IN (:...orgIds) OR user.org_id IS NULL)', {
        orgIds,
      });
    }

    // Apply date range filters
    if (created_from) {
      qb = qb.andWhere('user.created_at >= :created_from', { created_from });
    }
    if (created_to) {
      qb = qb.andWhere('user.created_at <= :created_to', { created_to });
    }

    // Get total count before pagination
    const totalCount = await qb.getCount();

    // Apply sorting
    this.applySorting(qb, sort_by, sort_order);

    // Apply pagination
    if (page && page_size) {
      // Legacy offset-based pagination
      const offset = (page - 1) * page_size;
      qb = qb.skip(offset).take(page_size);
    } else if (cursor) {
      // Cursor-based pagination
      qb = this.applyCursorPagination(qb, cursor, limit, sort_by, sort_order);
    } else {
      // Default to cursor pagination without cursor (first page)
      qb = qb.take(limit + 1); // Fetch one extra to check if there are more
    }

    const users = await qb.getMany();

    // Determine if there are more results
    let hasMore = false;
    let nextCursor: string | undefined;

    if (!page && !page_size) {
      // For cursor pagination
      if (users.length > limit) {
        hasMore = true;
        users.pop(); // Remove the extra user
        const lastUser = users[users.length - 1];
        nextCursor = this.encodeCursor({
          id: lastUser.id,
          createdAt: lastUser.created_at.toISOString(),
        });
      }
    }

    return {
      users,
      totalCount,
      nextCursor,
      hasMore,
    };
  }

  private applySearchFilter(
    qb: SelectQueryBuilder<User>,
    search: string,
  ): SelectQueryBuilder<User> {
    const searchTerm = search.trim();
    if (!searchTerm) {
      return qb;
    }

    // Use PostgreSQL FTS if available, fall back to ILIKE
    return qb.andWhere(
      '(user.name ILIKE :search OR user.email ILIKE :search)',
      { search: `%${searchTerm}%` },
    );
  }

  private applySorting(
    qb: SelectQueryBuilder<User>,
    sortBy: string,
    sortOrder: 'ASC' | 'DESC',
  ): void {
    const orderDirection = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    switch (sortBy) {
      case 'name':
        qb.orderBy('user.name', orderDirection);
        break;
      case 'email':
        qb.orderBy('user.email', orderDirection);
        break;
      case 'created_at':
        qb.orderBy('user.created_at', orderDirection);
        break;
      case 'role':
        qb.orderBy('user.role', orderDirection);
        break;
      case 'status':
        qb.orderBy('user.status', orderDirection);
        break;
      default:
        qb.orderBy('user.created_at', 'DESC');
    }

    // Always add secondary sort by ID for stability
    qb.addOrderBy('user.id', 'DESC');
  }

  private applyCursorPagination(
    qb: SelectQueryBuilder<User>,
    cursor: string,
    limit: number,
    sortBy: string,
    sortOrder: 'ASC' | 'DESC',
  ): SelectQueryBuilder<User> {
    try {
      const decoded = this.decodeCursor(cursor);
      const orderDirection = sortOrder === 'ASC' ? '>' : '<';

      // Keyset pagination: compare by sort field and id
      if (sortBy === 'created_at') {
        qb = qb.andWhere(
          `(user.created_at ${orderDirection} :createdAt OR (user.created_at = :createdAt AND user.id ${orderDirection} :id))`,
          { createdAt: decoded.createdAt, id: decoded.id },
        );
      } else {
        // For other sort fields, use a simpler comparison
        qb = qb.andWhere('user.id > :cursorId', { cursorId: decoded.id });
      }
    } catch (error) {
      throw new BadRequestException('Invalid cursor provided');
    }

    return qb.take(limit);
  }

  encodeCursor(data: DecodedCursor): string {
    const json = JSON.stringify(data);
    return Buffer.from(json).toString('base64');
  }

  decodeCursor(cursor: string): DecodedCursor {
    try {
      const json = Buffer.from(cursor, 'base64').toString('utf8');
      return JSON.parse(json);
    } catch (error) {
      throw new BadRequestException('Invalid cursor format');
    }
  }

  validateQueryParams(query: GetUsersQueryDto): void {
    if (query.limit && (query.limit < 1 || query.limit > 100)) {
      throw new BadRequestException('Limit must be between 1 and 100');
    }

    if (query.created_from && query.created_to) {
      const from = new Date(query.created_from);
      const to = new Date(query.created_to);
      if (from > to) {
        throw new BadRequestException('created_from must be before created_to');
      }
    }

    const allowedRoles = ['admin', 'manager', 'user'];
    if (query.role) {
      const invalid = query.role.filter((r) => !allowedRoles.includes(r));
      if (invalid.length > 0) {
        throw new BadRequestException(`Invalid roles: ${invalid.join(', ')}`);
      }
    }

    const allowedStatuses = ['active', 'inactive', 'suspended'];
    if (query.status) {
      const invalid = query.status.filter((s) => !allowedStatuses.includes(s));
      if (invalid.length > 0) {
        throw new BadRequestException(
          `Invalid statuses: ${invalid.join(', ')}`,
        );
      }
    }
  }
}
