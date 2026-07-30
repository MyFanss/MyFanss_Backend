import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateWebhookEvents1790200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'webhook_events',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          { name: 'eventType', type: 'varchar' },
          { name: 'payload', type: 'jsonb' },
          { name: 'status', type: 'varchar', default: `'pending'` },
          { name: 'attempts', type: 'int', default: 0 },
          { name: 'nextAttemptAt', type: 'timestamp', default: 'now()' },
          { name: 'lastError', type: 'text', isNullable: true },
          { name: 'createdAt', type: 'timestamp', default: 'now()' },
          { name: 'deliveredAt', type: 'timestamp', isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'webhook_events',
      new TableIndex({
        name: 'IDX_webhook_events_status_nextAttemptAt',
        columnNames: ['status', 'nextAttemptAt'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('webhook_events', true);
  }
}
