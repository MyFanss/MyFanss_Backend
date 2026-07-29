import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableIndex,
} from 'typeorm';

export class AddDeletedAtToPosts1785100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'posts',
      new TableColumn({
        name: 'deletedAt',
        type: 'timestamp',
        isNullable: true,
      }),
    );

    // Supports the creator-post-visibility list query: filter by creatorId +
    // deletedAt IS NULL, sort by publishedAt DESC.
    await queryRunner.createIndex(
      'posts',
      new TableIndex({
        name: 'IDX_posts_creatorId_deletedAt_publishedAt',
        columnNames: ['creatorId', 'deletedAt', 'publishedAt'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'posts',
      'IDX_posts_creatorId_deletedAt_publishedAt',
    );
    await queryRunner.dropColumn('posts', 'deletedAt');
  }
}
