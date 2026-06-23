import { MigrationInterface, QueryRunner } from 'typeorm';

export class BackfillRolesToEnum1770000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "users"
      SET role = CASE
        WHEN role = 'user'   OR role IS NULL OR role = '' THEN 'fan'
        WHEN role = 'manager' THEN 'creator'
        WHEN role = 'admin'  THEN 'admin'
        ELSE 'fan'
      END
      WHERE role NOT IN ('fan', 'creator', 'admin');
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      ALTER COLUMN role SET DEFAULT 'fan';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ALTER COLUMN role DROP DEFAULT;
    `);
  }
}
