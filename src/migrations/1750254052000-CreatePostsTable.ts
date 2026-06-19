import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreatePostsTable1750254052000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'posts',
        columns: [
          {
            name: 'id',
            type: 'bigint',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'identity',
          },
          {
            name: 'creatorId',
            type: 'bigint',
            isNullable: false,
          },
          {
            name: 'title',
            type: 'varchar',
            length: '200',
            isNullable: false,
          },
          {
            name: 'body',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'mediaUrl',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'visibility',
            type: 'enum',
            enum: ['public', 'subscribers'],
            default: "'public'",
            isNullable: false,
          },
          {
            name: 'publishedAt',
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

    await queryRunner.createForeignKey(
      'posts',
      new TableForeignKey({
        columnNames: ['creatorId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'posts',
      new TableIndex({
        columnNames: ['creatorId', 'publishedAt'],
      }),
    );

    await queryRunner.createIndex(
      'posts',
      new TableIndex({
        columnNames: ['visibility', 'publishedAt'],
      }),
    );

    await queryRunner.createIndex(
      'posts',
      new TableIndex({
        columnNames: ['creatorId', 'visibility'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('posts');
    
    if (table) {
      const foreignKey = table.foreignKeys.find(
        (fk) => fk.columnNames.indexOf('creatorId') !== -1,
      );

      if (foreignKey) {
        await queryRunner.dropForeignKey('posts', foreignKey);
      }
    }

    await queryRunner.dropTable('posts');
  }
}
