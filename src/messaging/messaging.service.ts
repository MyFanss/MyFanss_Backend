import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Conversation } from './conversation.entity';
import { Message } from './message.entity';
import { User } from '../users/user.entity';
import { UserRole } from '../auth/enums/role.enum';
import { CreateConversationDto } from './dtos/create-conversation.dto';
import { SendMessageDto } from './dtos/send-message.dto';
import { MarkReadDto } from './dtos/mark-read.dto';
import { CursorPaginationDto } from './dtos/cursor-pagination.dto';
import { ConversationResponseDto } from './dtos/conversation-response.dto';
import { MessageResponseDto } from './dtos/message-response.dto';
import {
  PaginatedConversationsResponseDto,
  PaginatedMessagesResponseDto,
} from './dtos/paginated-response.dto';

const PG_UNIQUE_VIOLATION = '23505';

interface ConversationCursor {
  lastMessageAt: string;
  id: number;
}

@Injectable()
export class MessagingService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversationsRepo: Repository<Conversation>,
    @InjectRepository(Message)
    private readonly messagesRepo: Repository<Message>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  async getOrCreateConversation(
    fanId: number,
    dto: CreateConversationDto,
  ): Promise<{ conversation: ConversationResponseDto; created: boolean }> {
    const creatorId = dto.creatorId;
    if (creatorId === fanId) {
      throw new BadRequestException(
        'Cannot start a conversation with yourself',
      );
    }

    const fan = await this.usersRepo.findOne({ where: { id: fanId } });
    if (!fan || fan.is_deleted) {
      throw new ForbiddenException('Your account cannot start conversations');
    }

    const creator = await this.usersRepo.findOne({ where: { id: creatorId } });
    if (!creator || creator.is_deleted) {
      throw new NotFoundException('Creator not found');
    }
    if (creator.role !== UserRole.CREATOR) {
      throw new BadRequestException('Target user is not a creator');
    }

    const existing = await this.conversationsRepo.findOne({
      where: { fanId, creatorId },
    });
    if (existing) {
      return { conversation: this.toConversationDto(existing), created: false };
    }

    try {
      const now = new Date();
      const created = await this.conversationsRepo.save(
        this.conversationsRepo.create({
          fanId,
          creatorId,
          lastMessageAt: now,
          lastMessagePreview: null,
        }),
      );
      return { conversation: this.toConversationDto(created), created: true };
    } catch (err) {
      if (
        err instanceof QueryFailedError &&
        (err as unknown as { code?: string }).code === PG_UNIQUE_VIOLATION
      ) {
        const raceWinner = await this.conversationsRepo.findOne({
          where: { fanId, creatorId },
        });
        if (raceWinner) {
          return {
            conversation: this.toConversationDto(raceWinner),
            created: false,
          };
        }
      }
      throw err;
    }
  }

  async listInbox(
    userId: number,
    query: CursorPaginationDto,
  ): Promise<PaginatedConversationsResponseDto> {
    const limit = query.limit ?? 20;
    const qb = this.conversationsRepo
      .createQueryBuilder('c')
      .where('(c.fanId = :userId OR c.creatorId = :userId)', { userId });

    if (query.cursor) {
      const decoded = this.decodeConversationCursor(query.cursor);
      qb.andWhere(
        '(c.lastMessageAt < :lastMessageAt OR (c.lastMessageAt = :lastMessageAt AND c.id < :id))',
        { lastMessageAt: decoded.lastMessageAt, id: decoded.id },
      );
    }

    const rows = await qb
      .orderBy('c.lastMessageAt', 'DESC')
      .addOrderBy('c.id', 'DESC')
      .take(limit + 1)
      .getMany();

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];

    return {
      data: page.map((c) => this.toConversationDto(c)),
      nextCursor: hasMore
        ? this.encodeConversationCursor({
            lastMessageAt: last.lastMessageAt.toISOString(),
            id: last.id,
          })
        : null,
      hasMore,
    };
  }

  async listMessages(
    conversationId: number,
    requesterId: number,
    query: CursorPaginationDto,
  ): Promise<PaginatedMessagesResponseDto> {
    const conversation = await this.getParticipantConversation(
      conversationId,
      requesterId,
    );

    const limit = query.limit ?? 20;
    const qb = this.messagesRepo
      .createQueryBuilder('m')
      .where('m.conversationId = :conversationId', {
        conversationId: conversation.id,
      });

    if (query.cursor) {
      const cursorId = this.decodeMessageCursor(query.cursor);
      qb.andWhere('m.id > :cursorId', { cursorId });
    }

    const rows = await qb
      .orderBy('m.id', 'ASC')
      .take(limit + 1)
      .getMany();

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];

    return {
      data: page.map((m) => this.toMessageDto(m)),
      nextCursor: hasMore ? this.encodeMessageCursor(last.id) : null,
      hasMore,
    };
  }

  async sendMessage(
    conversationId: number,
    senderId: number,
    dto: SendMessageDto,
  ): Promise<MessageResponseDto> {
    const conversation = await this.getParticipantConversation(
      conversationId,
      senderId,
    );

    const sender = await this.usersRepo.findOne({ where: { id: senderId } });
    if (!sender || sender.is_deleted) {
      throw new ForbiddenException('Your account cannot send messages');
    }

    const body = dto.body.trim();
    if (body.length === 0) {
      throw new BadRequestException('Message body cannot be empty');
    }

    if (dto.clientId) {
      const existing = await this.messagesRepo.findOne({
        where: {
          conversationId: conversation.id,
          senderId,
          clientId: dto.clientId,
        },
      });
      if (existing) {
        return this.toMessageDto(existing);
      }
    }

    const recipientId =
      conversation.fanId === senderId
        ? conversation.creatorId
        : conversation.fanId;
    const recipient = await this.usersRepo.findOne({
      where: { id: recipientId },
    });
    if (!recipient || recipient.is_deleted) {
      throw new ForbiddenException(
        'Cannot message a user who is no longer available',
      );
    }

    let saved: Message;
    try {
      saved = await this.messagesRepo.save(
        this.messagesRepo.create({
          conversationId: conversation.id,
          senderId,
          body,
          clientId: dto.clientId ?? null,
        }),
      );
    } catch (err) {
      if (
        dto.clientId &&
        err instanceof QueryFailedError &&
        (err as unknown as { code?: string }).code === PG_UNIQUE_VIOLATION
      ) {
        const raceWinner = await this.messagesRepo.findOne({
          where: {
            conversationId: conversation.id,
            senderId,
            clientId: dto.clientId,
          },
        });
        if (raceWinner) {
          return this.toMessageDto(raceWinner);
        }
      }
      throw err;
    }

    conversation.lastMessageAt = saved.createdAt;
    conversation.lastMessagePreview = body.slice(0, 140);
    await this.conversationsRepo.save(conversation);

    return this.toMessageDto(saved);
  }

  async markRead(
    conversationId: number,
    requesterId: number,
    dto: MarkReadDto,
  ): Promise<{ updated: number }> {
    const conversation = await this.getParticipantConversation(
      conversationId,
      requesterId,
    );

    let upToCreatedAt: Date;
    if (dto.messageId !== undefined) {
      const marker = await this.messagesRepo.findOne({
        where: { id: dto.messageId, conversationId: conversation.id },
      });
      if (!marker) {
        throw new BadRequestException(
          'messageId does not belong to this conversation',
        );
      }
      upToCreatedAt = marker.createdAt;
    } else if (dto.readAt) {
      upToCreatedAt = new Date(dto.readAt);
    } else {
      upToCreatedAt = new Date();
    }

    const result = await this.messagesRepo
      .createQueryBuilder()
      .update(Message)
      .set({ readAt: new Date() })
      .where('conversationId = :conversationId', {
        conversationId: conversation.id,
      })
      .andWhere('senderId != :requesterId', { requesterId })
      .andWhere('readAt IS NULL')
      .andWhere('createdAt <= :upToCreatedAt', { upToCreatedAt })
      .execute();

    return { updated: result.affected ?? 0 };
  }

  private async getParticipantConversation(
    conversationId: number,
    userId: number,
  ): Promise<Conversation> {
    const conversation = await this.conversationsRepo.findOne({
      where: { id: conversationId },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    if (conversation.fanId !== userId && conversation.creatorId !== userId) {
      throw new ForbiddenException(
        'You are not a participant in this conversation',
      );
    }
    return conversation;
  }

  private toConversationDto(c: Conversation): ConversationResponseDto {
    return {
      id: c.id,
      fanId: c.fanId,
      creatorId: c.creatorId,
      lastMessageAt: c.lastMessageAt,
      lastMessagePreview: c.lastMessagePreview,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
  }

  private toMessageDto(m: Message): MessageResponseDto {
    return {
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      body: m.body,
      clientId: m.clientId,
      createdAt: m.createdAt,
      readAt: m.readAt,
    };
  }

  private encodeConversationCursor(data: ConversationCursor): string {
    return Buffer.from(JSON.stringify(data)).toString('base64');
  }

  private decodeConversationCursor(cursor: string): ConversationCursor {
    try {
      return JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
    } catch {
      throw new BadRequestException('Invalid cursor');
    }
  }

  private encodeMessageCursor(id: number): string {
    return Buffer.from(JSON.stringify({ id })).toString('base64');
  }

  private decodeMessageCursor(cursor: string): number {
    try {
      const decoded = JSON.parse(
        Buffer.from(cursor, 'base64').toString('utf8'),
      );
      if (typeof decoded.id !== 'number') throw new Error('invalid');
      return decoded.id;
    } catch {
      throw new BadRequestException('Invalid cursor');
    }
  }
}
