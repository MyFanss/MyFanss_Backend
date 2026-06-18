import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddUserProfileFields1750254051000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'displayName',
        type: 'varchar',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'bio',
        type: 'varchar',
        length: '300',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'avatarUrl',
        type: 'varchar',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'avatarUrl');
    await queryRunner.dropColumn('users', 'bio');
    await queryRunner.dropColumn('users', 'displayName');
  }
}
