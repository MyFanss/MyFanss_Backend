import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AddPostSoftDelete1790000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'posts',
      new TableColumn({
        name: 'deletedAt',
        type: 'timestamp',
        isNullable: true,
        default: null,
      }),
    );

    await queryRunner.addColumn(
      'posts',
      new TableColumn({
        name: 'deletedById',
        type: 'int',
        isNullable: true,
        default: null,
      }),
    );

    // Backfill: pre-existing rows are undeleted.
    await queryRunner.query(
      `UPDATE "posts" SET "deletedAt" = NULL WHERE "deletedAt" IS NULL`,
    );

    await queryRunner.createForeignKey(
      'posts',
      new TableForeignKey({
        columnNames: ['deletedById'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
    );

    // Replace the original active-post indexes with partial indexes that
    // exclude soft-deleted rows, since every public/owner read path now
    // filters on deletedAt IS NULL.
    const table = await queryRunner.getTable('posts');
    if (table) {
      const creatorPublishedIndex = table.indices.find(
        (index) =>
          index.columnNames.length === 2 &&
          index.columnNames.includes('creatorId') &&
          index.columnNames.includes('publishedAt'),
      );
      if (creatorPublishedIndex) {
        await queryRunner.dropIndex('posts', creatorPublishedIndex);
      }

      const visibilityPublishedIndex = table.indices.find(
        (index) =>
          index.columnNames.length === 2 &&
          index.columnNames.includes('visibility') &&
          index.columnNames.includes('publishedAt'),
      );
      if (visibilityPublishedIndex) {
        await queryRunner.dropIndex('posts', visibilityPublishedIndex);
      }
    }

    await queryRunner.createIndex(
      'posts',
      new TableIndex({
        name: 'IDX_posts_creator_published_active',
        columnNames: ['creatorId', 'publishedAt'],
        where: '"deletedAt" IS NULL',
      }),
    );

    await queryRunner.createIndex(
      'posts',
      new TableIndex({
        name: 'IDX_posts_visibility_published_active',
        columnNames: ['visibility', 'publishedAt'],
        where: '"deletedAt" IS NULL',
      }),
    );

    await queryRunner.createIndex(
      'posts',
      new TableIndex({
        name: 'IDX_posts_creator_deletedAt',
        columnNames: ['creatorId', 'deletedAt'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('posts', 'IDX_posts_creator_deletedAt');
    await queryRunner.dropIndex(
      'posts',
      'IDX_posts_visibility_published_active',
    );
    await queryRunner.dropIndex('posts', 'IDX_posts_creator_published_active');

    await queryRunner.createIndex(
      'posts',
      new TableIndex({
        columnNames: ['visibility', 'publishedAt'],
      }),
    );
    await queryRunner.createIndex(
      'posts',
      new TableIndex({
        columnNames: ['creatorId', 'publishedAt'],
      }),
    );

    const table = await queryRunner.getTable('posts');
    if (table) {
      const foreignKey = table.foreignKeys.find(
        (fk) => fk.columnNames.indexOf('deletedById') !== -1,
      );
      if (foreignKey) {
        await queryRunner.dropForeignKey('posts', foreignKey);
      }
    }

    await queryRunner.dropColumn('posts', 'deletedById');
    await queryRunner.dropColumn('posts', 'deletedAt');
  }
}
