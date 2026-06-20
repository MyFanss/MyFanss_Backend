import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateSubscriptions1769040000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'subscriptions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            isGenerated: true,
          },
          {
            name: 'fanId',
            type: 'int',
          },
          {
            name: 'creatorId',
            type: 'int',
          },
          {
            name: 'status',
            type: 'varchar',
            default: "'active'",
          },
          {
            name: 'subscribedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'cancelledAt',
            type: 'timestamp',
            isNullable: true,
          },
        ],
      }),
    );

    await queryRunner.createForeignKey(
      'subscriptions',
      new TableForeignKey({
        columnNames: ['fanId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'subscriptions',
      new TableForeignKey({
        columnNames: ['creatorId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // One row per fan+creator pair (re-subscribe reactivates the same row).
    await queryRunner.createIndex(
      'subscriptions',
      new TableIndex({
        name: 'UQ_SUBSCRIPTIONS_FAN_CREATOR',
        columnNames: ['fanId', 'creatorId'],
        isUnique: true,
      }),
    );
    await queryRunner.createIndex(
      'subscriptions',
      new TableIndex({
        name: 'IDX_SUBSCRIPTIONS_CREATOR_STATUS',
        columnNames: ['creatorId', 'status'],
      }),
    );
    await queryRunner.createIndex(
      'subscriptions',
      new TableIndex({
        name: 'IDX_SUBSCRIPTIONS_FAN_STATUS',
        columnNames: ['fanId', 'status'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'subscriptions',
      'IDX_SUBSCRIPTIONS_FAN_STATUS',
    );
    await queryRunner.dropIndex(
      'subscriptions',
      'IDX_SUBSCRIPTIONS_CREATOR_STATUS',
    );
    await queryRunner.dropIndex(
      'subscriptions',
      'UQ_SUBSCRIPTIONS_FAN_CREATOR',
    );
    await queryRunner.dropTable('subscriptions');
  }
}
