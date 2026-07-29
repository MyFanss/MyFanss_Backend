import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateTips1790000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'tips',
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
            name: 'amountCents',
            type: 'int',
          },
          {
            name: 'currency',
            type: 'varchar',
            length: '3',
            default: "'USD'",
          },
          {
            name: 'message',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'completed', 'failed', 'cancelled'],
            default: "'pending'",
          },
          {
            name: 'idempotencyKey',
            type: 'varchar',
            isUnique: true,
          },
          {
            name: 'feeCents',
            type: 'int',
          },
          {
            name: 'creatorNetCents',
            type: 'int',
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'confirmedAt',
            type: 'timestamp',
            isNullable: true,
          },
        ],
      }),
    );

    await queryRunner.createForeignKey(
      'tips',
      new TableForeignKey({
        columnNames: ['fanId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'tips',
      new TableForeignKey({
        columnNames: ['creatorId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'tips',
      new TableIndex({
        name: 'IDX_TIPS_CREATOR_STATUS_CREATED_AT',
        columnNames: ['creatorId', 'status', 'createdAt'],
      }),
    );
    await queryRunner.createIndex(
      'tips',
      new TableIndex({
        name: 'IDX_TIPS_FAN_STATUS_CREATED_AT',
        columnNames: ['fanId', 'status', 'createdAt'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('tips', 'IDX_TIPS_FAN_STATUS_CREATED_AT');
    await queryRunner.dropIndex('tips', 'IDX_TIPS_CREATOR_STATUS_CREATED_AT');
    await queryRunner.dropTable('tips');
  }
}
