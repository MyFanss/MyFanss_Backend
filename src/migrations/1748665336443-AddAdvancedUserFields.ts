import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableIndex,
} from 'typeorm';

export class AddAdvancedUserFields1748665336443 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new columns to users table
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'role',
        type: 'varchar',
        default: "'user'",
        isNullable: false,
      }),
    );

    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'status',
        type: 'varchar',
        default: "'active'",
        isNullable: false,
      }),
    );

    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'org_id',
        type: 'int',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'created_at',
        type: 'timestamp',
        default: 'CURRENT_TIMESTAMP',
        isNullable: false,
      }),
    );

    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'updated_at',
        type: 'timestamp',
        default: 'CURRENT_TIMESTAMP',
        onUpdate: 'CURRENT_TIMESTAMP',
        isNullable: false,
      }),
    );

    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'is_deleted',
        type: 'boolean',
        default: false,
        isNullable: false,
      }),
    );

    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'search_text',
        type: 'tsvector',
        isNullable: true,
      }),
    );

    // Create indexes for performance
    await queryRunner.createIndex(
      'users',
      new TableIndex({
        name: 'IDX_USERS_ROLE',
        columnNames: ['role'],
      }),
    );

    await queryRunner.createIndex(
      'users',
      new TableIndex({
        name: 'IDX_USERS_STATUS',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'users',
      new TableIndex({
        name: 'IDX_USERS_ORG_ID',
        columnNames: ['org_id'],
      }),
    );

    await queryRunner.createIndex(
      'users',
      new TableIndex({
        name: 'IDX_USERS_CREATED_AT',
        columnNames: ['created_at'],
      }),
    );

    await queryRunner.createIndex(
      'users',
      new TableIndex({
        name: 'IDX_USERS_IS_DELETED',
        columnNames: ['is_deleted'],
      }),
    );

    // Composite indexes for common queries
    await queryRunner.createIndex(
      'users',
      new TableIndex({
        name: 'IDX_USERS_STATUS_CREATED_AT_ID',
        columnNames: ['status', 'created_at', 'id'],
      }),
    );

    await queryRunner.createIndex(
      'users',
      new TableIndex({
        name: 'IDX_USERS_ORG_ID_CREATED_AT_ID',
        columnNames: ['org_id', 'created_at', 'id'],
      }),
    );

    await queryRunner.createIndex(
      'users',
      new TableIndex({
        name: 'IDX_USERS_ROLE_STATUS_CREATED_AT_ID',
        columnNames: ['role', 'status', 'created_at', 'id'],
      }),
    );

    // GIN index for full-text search (PostgreSQL only)
    try {
      await queryRunner.query(
        'CREATE INDEX IDX_USERS_SEARCH_TEXT ON users USING GIN (search_text)',
      );
    } catch (e) {
      // Silently fail if not PostgreSQL or if already exists
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.dropIndex('users', 'IDX_USERS_SEARCH_TEXT');
    await queryRunner.dropIndex('users', 'IDX_USERS_ROLE_STATUS_CREATED_AT_ID');
    await queryRunner.dropIndex('users', 'IDX_USERS_ORG_ID_CREATED_AT_ID');
    await queryRunner.dropIndex('users', 'IDX_USERS_STATUS_CREATED_AT_ID');
    await queryRunner.dropIndex('users', 'IDX_USERS_IS_DELETED');
    await queryRunner.dropIndex('users', 'IDX_USERS_CREATED_AT');
    await queryRunner.dropIndex('users', 'IDX_USERS_ORG_ID');
    await queryRunner.dropIndex('users', 'IDX_USERS_STATUS');
    await queryRunner.dropIndex('users', 'IDX_USERS_ROLE');

    // Drop columns
    await queryRunner.dropColumn('users', 'search_text');
    await queryRunner.dropColumn('users', 'is_deleted');
    await queryRunner.dropColumn('users', 'updated_at');
    await queryRunner.dropColumn('users', 'created_at');
    await queryRunner.dropColumn('users', 'org_id');
    await queryRunner.dropColumn('users', 'status');
    await queryRunner.dropColumn('users', 'role');
  }
}
