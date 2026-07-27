import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateContentReports1785000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'content_reports',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            generationStrategy: 'identity',
            isGenerated: true,
          },
          {
            name: 'reporterId',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'targetType',
            type: 'enum',
            enum: ['post', 'comment'],
            isNullable: false,
          },
          {
            name: 'targetId',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'reason',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['open', 'resolved', 'dismissed'],
            default: "'open'",
            isNullable: false,
          },
          {
            name: 'resolvedBy',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'resolvedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'content_reports',
      new TableIndex({
        name: 'IDX_CONTENT_REPORTS_STATUS_CREATED_AT',
        columnNames: ['status', 'createdAt'],
      }),
    );

    await queryRunner.createIndex(
      'content_reports',
      new TableIndex({
        name: 'IDX_CONTENT_REPORTS_REPORTER_TARGET',
        columnNames: ['reporterId', 'targetType', 'targetId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'content_reports',
      'IDX_CONTENT_REPORTS_REPORTER_TARGET',
    );
    await queryRunner.dropIndex(
      'content_reports',
      'IDX_CONTENT_REPORTS_STATUS_CREATED_AT',
    );
    await queryRunner.dropTable('content_reports');
  }
}
