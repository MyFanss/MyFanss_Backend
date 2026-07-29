import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateBillingWebhooks1790100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'billing_webhook_events',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          { name: 'eventId', type: 'varchar' },
          { name: 'type', type: 'varchar' },
          { name: 'payload', type: 'jsonb' },
          { name: 'status', type: 'varchar', default: `'processing'` },
          { name: 'error', type: 'text', isNullable: true },
          { name: 'signaturePresent', type: 'boolean', default: false },
          { name: 'processingLatencyMs', type: 'int', isNullable: true },
          { name: 'deliveryAttempts', type: 'int', default: 0 },
          {
            name: 'receivedAt',
            type: 'timestamp',
            default: 'now()',
          },
          { name: 'processedAt', type: 'timestamp', isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'billing_webhook_events',
      new TableIndex({
        name: 'IDX_billing_webhook_events_eventId',
        columnNames: ['eventId'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'billing_webhook_events',
      new TableIndex({
        name: 'IDX_billing_webhook_events_status_receivedAt',
        columnNames: ['status', 'receivedAt'],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'billing_customer_maps',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          { name: 'externalCustomerId', type: 'varchar' },
          { name: 'externalSubscriptionId', type: 'varchar' },
          { name: 'fanId', type: 'int' },
          { name: 'creatorId', type: 'int' },
          { name: 'createdAt', type: 'timestamp', default: 'now()' },
          { name: 'updatedAt', type: 'timestamp', default: 'now()' },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'billing_customer_maps',
      new TableIndex({
        name: 'IDX_billing_customer_maps_externalSubscriptionId',
        columnNames: ['externalSubscriptionId'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'billing_customer_maps',
      new TableIndex({
        name: 'IDX_billing_customer_maps_externalCustomerId',
        columnNames: ['externalCustomerId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('billing_customer_maps', true);
    await queryRunner.dropTable('billing_webhook_events', true);
  }
}
