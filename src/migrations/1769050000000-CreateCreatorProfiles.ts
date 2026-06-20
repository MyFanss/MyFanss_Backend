import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateCreatorProfiles1769050000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'creator_profiles',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            isGenerated: true,
          },
          {
            name: 'userId',
            type: 'int',
          },
          {
            name: 'handle',
            type: 'varchar',
            length: '30',
          },
          {
            name: 'displayName',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'bio',
            type: 'varchar',
            length: '300',
            isNullable: true,
          },
          {
            name: 'bannerUrl',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'category',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'isOnboarded',
            type: 'boolean',
            default: false,
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
        ],
      }),
    );

    await queryRunner.createForeignKey(
      'creator_profiles',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // 1:1 with users — one creator profile per account.
    await queryRunner.createIndex(
      'creator_profiles',
      new TableIndex({
        name: 'UQ_CREATOR_PROFILES_USER',
        columnNames: ['userId'],
        isUnique: true,
      }),
    );

    // Unique public handle used in discovery flows.
    await queryRunner.createIndex(
      'creator_profiles',
      new TableIndex({
        name: 'UQ_CREATOR_PROFILES_HANDLE',
        columnNames: ['handle'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'creator_profiles',
      'UQ_CREATOR_PROFILES_HANDLE',
    );
    await queryRunner.dropIndex('creator_profiles', 'UQ_CREATOR_PROFILES_USER');
    await queryRunner.dropTable('creator_profiles');
  }
}
