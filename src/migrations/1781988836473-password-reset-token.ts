import { MigrationInterface, QueryRunner } from "typeorm";

export class PasswordResetToken1781988836473 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            'password_reset_tokens',
            table => {
                table.column('id', { type: 'uuid', default: "gen_random_uuid()", primary: true });
                table.column('user_id', { type: 'integer' });
                table.column('token_hash', { type: 'varchar(255)', unique: true });
                table.column('expires_at', { type: 'timestamp' });
                table.column('used_at', { type: 'timestamp', isNullable: true });
                table.column('created_at', { type: 'timestamp', default: "now()" });
                table.foreignKey('user_id', ['users', 'id'], { onDelete: 'CASCADE' });
                table.index(['user_id', 'used_at'], 'idx_password_reset_tokens_user_used');
                table.index(['token_hash'], 'idx_password_reset_tokens_token_hash');
                table.index(['expires_at'], 'idx_password_reset_tokens_expires_at');
            },
            true
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('password_reset_tokens', true);
    }

}
