import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableForeignKey,
} from 'typeorm';

export class CreateNotificationPreferences1769050000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'notification_preferences',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'identity',
          },
          {
            name: 'userId',
            type: 'int',
            isUnique: true,
          },
          {
            name: 'newSubscriber',
            type: 'boolean',
            default: true,
          },
          {
            name: 'postFromSubscribedCreator',
            type: 'boolean',
            default: true,
          },
          {
            name: 'securityAlerts',
            type: 'boolean',
            default: true,
          },
          {
            name: 'marketing',
            type: 'boolean',
            default: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'notification_preferences',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'notification_preferences',
      new TableIndex({
        name: 'IDX_NOTIFICATION_PREF_USER_ID',
        columnNames: ['userId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('notification_preferences');
    if (table) {
      const foreignKey = table.foreignKeys.find(
        (fk) => fk.columnNames.indexOf('userId') !== -1,
      );
      if (foreignKey) {
        await queryRunner.dropForeignKey(
          'notification_preferences',
          foreignKey,
        );
      }

      const index = table.indices.find(
        (idx) => idx.name === 'IDX_NOTIFICATION_PREF_USER_ID',
      );
      if (index) {
        await queryRunner.dropIndex('notification_preferences', index);
      }

      await queryRunner.dropTable('notification_preferences');
    }
  }
}
