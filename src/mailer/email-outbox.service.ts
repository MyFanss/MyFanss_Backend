import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { EmailOutbox, EmailOutboxRecord } from './email-outbox.port';

@Injectable()
export class InMemoryEmailOutbox implements EmailOutbox {
  private readonly rows: EmailOutboxRecord[] = [];

  async record(
    entry: Omit<EmailOutboxRecord, 'id' | 'createdAt'>,
  ): Promise<EmailOutboxRecord> {
    const row: EmailOutboxRecord = {
      id: randomUUID(),
      createdAt: new Date(),
      ...entry,
    };
    this.rows.push(row);
    return Promise.resolve(row);
  }

  getAll(): EmailOutboxRecord[] {
    return [...this.rows];
  }
}
