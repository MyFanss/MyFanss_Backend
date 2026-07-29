import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateMessagingTables1785200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'conversations',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'identity',
          },
          { name: 'fanId', type: 'int', isNullable: false },
          { name: 'creatorId', type: 'int', isNullable: false },
          { name: 'lastMessageAt', type: 'timestamp', isNullable: false },
          {
            name: 'lastMessagePreview',
            type: 'varchar',
            length: '160',
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

    await queryRunner.createTable(
      new Table({
        name: 'messages',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'identity',
          },
          { name: 'conversationId', type: 'int', isNullable: false },
          { name: 'senderId', type: 'int', isNullable: false },
          { name: 'body', type: 'text', isNullable: false },
          {
            name: 'clientId',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          { name: 'readAt', type: 'timestamp', isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'conversations',
      new TableForeignKey({
        columnNames: ['fanId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'conversations',
      new TableForeignKey({
        columnNames: ['creatorId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'messages',
      new TableForeignKey({
        columnNames: ['conversationId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'conversations',
        onDelete: 'CASCADE',
      }),
    );
    await queryRunner.createForeignKey(
      'messages',
      new TableForeignKey({
        columnNames: ['senderId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_CONVERSATION_FAN_CREATOR" ON "conversations" ("fanId", "creatorId")`,
    );
    await queryRunner.createIndex(
      'conversations',
      new TableIndex({
        name: 'IDX_CONVERSATIONS_FAN_LAST_MESSAGE',
        columnNames: ['fanId', 'lastMessageAt'],
      }),
    );
    await queryRunner.createIndex(
      'conversations',
      new TableIndex({
        name: 'IDX_CONVERSATIONS_CREATOR_LAST_MESSAGE',
        columnNames: ['creatorId', 'lastMessageAt'],
      }),
    );

    await queryRunner.createIndex(
      'messages',
      new TableIndex({
        name: 'IDX_MESSAGES_CONVERSATION_ID',
        columnNames: ['conversationId', 'id'],
      }),
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_MESSAGE_CLIENT_ID" ON "messages" ("conversationId", "senderId", "clientId") WHERE "clientId" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_MESSAGE_CLIENT_ID"`);
    await queryRunner.dropIndex('messages', 'IDX_MESSAGES_CONVERSATION_ID');

    const messages = await queryRunner.getTable('messages');
    if (messages) {
      for (const fk of messages.foreignKeys) {
        await queryRunner.dropForeignKey('messages', fk);
      }
    }
    await queryRunner.dropTable('messages');

    await queryRunner.dropIndex(
      'conversations',
      'IDX_CONVERSATIONS_CREATOR_LAST_MESSAGE',
    );
    await queryRunner.dropIndex(
      'conversations',
      'IDX_CONVERSATIONS_FAN_LAST_MESSAGE',
    );
    await queryRunner.query(`DROP INDEX "UQ_CONVERSATION_FAN_CREATOR"`);

    const conversations = await queryRunner.getTable('conversations');
    if (conversations) {
      for (const fk of conversations.foreignKeys) {
        await queryRunner.dropForeignKey('conversations', fk);
      }
    }
    await queryRunner.dropTable('conversations');
  }
}
