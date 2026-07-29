import * as request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { clearDatabase, createE2eApp, E2eTestApp } from './helpers/e2e-app';
import { bearerToken, signupUser } from './helpers/auth';
import { User } from '../src/users/user.entity';
import { UserRole } from '../src/auth/enums/role.enum';
import { Conversation } from '../src/messaging/conversation.entity';
import { Message } from '../src/messaging/message.entity';

describe('Messaging (e2e)', () => {
  let testApp: E2eTestApp;
  let userRepository: Repository<User>;
  let conversationRepository: Repository<Conversation>;
  let messageRepository: Repository<Message>;

  let fanToken: string;
  let fanId: number;

  let creatorToken: string;
  let creatorId: number;

  let otherFanToken: string;
  let otherFanId: number;

  const server = () => testApp.app.getHttpServer();

  const makeCreator = async (id: number) => {
    await userRepository.update(id, { role: UserRole.CREATOR });
  };

  beforeAll(async () => {
    testApp = await createE2eApp();
    userRepository = testApp.moduleFixture.get<Repository<User>>(
      getRepositoryToken(User),
    );
    conversationRepository = testApp.moduleFixture.get<
      Repository<Conversation>
    >(getRepositoryToken(Conversation));
    messageRepository = testApp.moduleFixture.get<Repository<Message>>(
      getRepositoryToken(Message),
    );
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  beforeEach(async () => {
    await clearDatabase(testApp.dataSource);

    const fan = await signupUser(testApp.app, {
      name: 'Fan User',
      email: 'fan@example.com',
    });
    fanToken = fan.token;
    fanId = fan.user.id;

    const creator = await signupUser(testApp.app, {
      name: 'Creator User',
      email: 'creator@example.com',
    });
    creatorToken = creator.token;
    creatorId = creator.user.id;
    await makeCreator(creatorId);

    const otherFan = await signupUser(testApp.app, {
      name: 'Other Fan',
      email: 'other-fan@example.com',
    });
    otherFanToken = otherFan.token;
    otherFanId = otherFan.user.id;
  });

  describe('POST /conversations', () => {
    it('requires authentication (401)', async () => {
      await request(server())
        .post('/conversations')
        .send({ creatorId })
        .expect(401);
    });

    it('creates a new conversation (201) for a fan targeting a creator', async () => {
      const res = await request(server())
        .post('/conversations')
        .set('Authorization', bearerToken(fanToken))
        .send({ creatorId })
        .expect(201);

      expect(res.body).toMatchObject({ fanId, creatorId });
    });

    it('get-or-create reuses the same conversation on a duplicate pair (200)', async () => {
      const first = await request(server())
        .post('/conversations')
        .set('Authorization', bearerToken(fanToken))
        .send({ creatorId })
        .expect(201);

      const second = await request(server())
        .post('/conversations')
        .set('Authorization', bearerToken(fanToken))
        .send({ creatorId })
        .expect(200);

      expect(second.body.id).toBe(first.body.id);

      const count = await conversationRepository.count();
      expect(count).toBe(1);
    });

    it('forbids creators from initiating conversations (403)', async () => {
      await request(server())
        .post('/conversations')
        .set('Authorization', bearerToken(creatorToken))
        .send({ creatorId: fanId })
        .expect(403);
    });

    it('returns 404 when the target creator does not exist', async () => {
      await request(server())
        .post('/conversations')
        .set('Authorization', bearerToken(fanToken))
        .send({ creatorId: 999999 })
        .expect(404);
    });

    it('returns 400 when the target is not a creator', async () => {
      await request(server())
        .post('/conversations')
        .set('Authorization', bearerToken(fanToken))
        .send({ creatorId: otherFanId })
        .expect(400);
    });

    it('returns 400 when targeting yourself', async () => {
      await request(server())
        .post('/conversations')
        .set('Authorization', bearerToken(fanToken))
        .send({ creatorId: fanId })
        .expect(400);
    });
  });

  describe('GET /conversations/me', () => {
    it('requires authentication (401)', async () => {
      await request(server()).get('/conversations/me').expect(401);
    });

    it('lists conversations for both participants', async () => {
      await request(server())
        .post('/conversations')
        .set('Authorization', bearerToken(fanToken))
        .send({ creatorId })
        .expect(201);

      const fanInbox = await request(server())
        .get('/conversations/me')
        .set('Authorization', bearerToken(fanToken))
        .expect(200);
      expect(fanInbox.body.data).toHaveLength(1);

      const creatorInbox = await request(server())
        .get('/conversations/me')
        .set('Authorization', bearerToken(creatorToken))
        .expect(200);
      expect(creatorInbox.body.data).toHaveLength(1);

      const otherInbox = await request(server())
        .get('/conversations/me')
        .set('Authorization', bearerToken(otherFanToken))
        .expect(200);
      expect(otherInbox.body.data).toHaveLength(0);
    });

    it('paginates the inbox with a stable cursor, ordered by lastMessageAt desc', async () => {
      const creatorIds: number[] = [];
      for (let i = 0; i < 3; i++) {
        const c = await signupUser(testApp.app, {
          name: `Creator ${i}`,
          email: `creator${i}@example.com`,
        });
        await makeCreator(c.user.id);
        creatorIds.push(c.user.id);

        await request(server())
          .post('/conversations')
          .set('Authorization', bearerToken(fanToken))
          .send({ creatorId: c.user.id })
          .expect(201);
      }

      const page1 = await request(server())
        .get('/conversations/me')
        .query({ limit: 2 })
        .set('Authorization', bearerToken(fanToken))
        .expect(200);
      expect(page1.body.data).toHaveLength(2);
      expect(page1.body.hasMore).toBe(true);

      const page2 = await request(server())
        .get('/conversations/me')
        .query({ limit: 2, cursor: page1.body.nextCursor })
        .set('Authorization', bearerToken(fanToken))
        .expect(200);
      expect(page2.body.data).toHaveLength(1);
      expect(page2.body.hasMore).toBe(false);

      const allIds = [...page1.body.data, ...page2.body.data].map(
        (c: { id: number }) => c.id,
      );
      expect(new Set(allIds).size).toBe(3);
    });
  });

  describe('POST /conversations/:id/messages', () => {
    let conversationId: number;

    beforeEach(async () => {
      const res = await request(server())
        .post('/conversations')
        .set('Authorization', bearerToken(fanToken))
        .send({ creatorId })
        .expect(201);
      conversationId = res.body.id;
    });

    it('requires authentication (401)', async () => {
      await request(server())
        .post(`/conversations/${conversationId}/messages`)
        .send({ body: 'Hello' })
        .expect(401);
    });

    it('supports a two-way exchange between fan and creator', async () => {
      const fanMsg = await request(server())
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', bearerToken(fanToken))
        .send({ body: 'Hi there!' })
        .expect(201);
      expect(fanMsg.body).toMatchObject({
        conversationId,
        senderId: fanId,
        body: 'Hi there!',
      });

      const creatorMsg = await request(server())
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', bearerToken(creatorToken))
        .send({ body: 'Hey, thanks!' })
        .expect(201);
      expect(creatorMsg.body).toMatchObject({
        conversationId,
        senderId: creatorId,
        body: 'Hey, thanks!',
      });
    });

    it('returns 403 for a non-participant', async () => {
      await request(server())
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', bearerToken(otherFanToken))
        .send({ body: 'Sneaky' })
        .expect(403);
    });

    it('returns 404 for a non-existent conversation', async () => {
      await request(server())
        .post('/conversations/999999/messages')
        .set('Authorization', bearerToken(fanToken))
        .send({ body: 'Hello' })
        .expect(404);
    });

    it('rejects an empty body (validation)', async () => {
      await request(server())
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', bearerToken(fanToken))
        .send({ body: '' })
        .expect(400);
    });

    it('rejects a whitespace-only body (validation)', async () => {
      await request(server())
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', bearerToken(fanToken))
        .send({ body: '     ' })
        .expect(400);
    });

    it('rejects a body over 2000 characters (validation)', async () => {
      await request(server())
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', bearerToken(fanToken))
        .send({ body: 'a'.repeat(2001) })
        .expect(400);
    });

    it('is idempotent when the same clientId is resent', async () => {
      const first = await request(server())
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', bearerToken(fanToken))
        .send({ body: 'Retry me', clientId: 'client-abc-123' })
        .expect(201);

      const second = await request(server())
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', bearerToken(fanToken))
        .send({ body: 'Retry me', clientId: 'client-abc-123' })
        .expect(201);

      expect(second.body.id).toBe(first.body.id);

      const count = await messageRepository.count({
        where: { conversationId },
      });
      expect(count).toBe(1);
    });

    it('is idempotent when the same Idempotency-Key header is resent', async () => {
      const first = await request(server())
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', bearerToken(fanToken))
        .set('Idempotency-Key', 'header-key-456')
        .send({ body: 'Header retry' })
        .expect(201);

      const second = await request(server())
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', bearerToken(fanToken))
        .set('Idempotency-Key', 'header-key-456')
        .send({ body: 'Header retry' })
        .expect(201);

      expect(second.body.id).toBe(first.body.id);
      const count = await messageRepository.count({
        where: { conversationId },
      });
      expect(count).toBe(1);
    });

    it('bumps the conversation lastMessageAt and preview after a send', async () => {
      await request(server())
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', bearerToken(fanToken))
        .send({ body: 'Updating preview' })
        .expect(201);

      const conversation = await conversationRepository.findOne({
        where: { id: conversationId },
      });
      expect(conversation?.lastMessagePreview).toBe('Updating preview');
      expect(conversation?.lastMessageAt).not.toBeNull();
    });

    it('blocks sending to a soft-deleted recipient', async () => {
      await userRepository.update(creatorId, { is_deleted: true });

      await request(server())
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', bearerToken(fanToken))
        .send({ body: 'Are you there?' })
        .expect(403);
    });
  });

  describe('GET /conversations/:id/messages', () => {
    let conversationId: number;

    beforeEach(async () => {
      const res = await request(server())
        .post('/conversations')
        .set('Authorization', bearerToken(fanToken))
        .send({ creatorId })
        .expect(201);
      conversationId = res.body.id;
    });

    it('returns 403 for a non-participant', async () => {
      await request(server())
        .get(`/conversations/${conversationId}/messages`)
        .set('Authorization', bearerToken(otherFanToken))
        .expect(403);
    });

    it('returns 404 for a non-existent conversation', async () => {
      await request(server())
        .get('/conversations/999999/messages')
        .set('Authorization', bearerToken(fanToken))
        .expect(404);
    });

    it('paginates messages oldest to newest with a stable cursor', async () => {
      const ids: number[] = [];
      for (let i = 0; i < 5; i++) {
        const res = await request(server())
          .post(`/conversations/${conversationId}/messages`)
          .set('Authorization', bearerToken(fanToken))
          .send({ body: `Message ${i}` })
          .expect(201);
        ids.push(res.body.id);
      }

      const page1 = await request(server())
        .get(`/conversations/${conversationId}/messages`)
        .query({ limit: 2 })
        .set('Authorization', bearerToken(fanToken))
        .expect(200);
      expect(page1.body.data.map((m: { id: number }) => m.id)).toEqual(
        ids.slice(0, 2),
      );

      const page2 = await request(server())
        .get(`/conversations/${conversationId}/messages`)
        .query({ limit: 2, cursor: page1.body.nextCursor })
        .set('Authorization', bearerToken(fanToken))
        .expect(200);
      expect(page2.body.data.map((m: { id: number }) => m.id)).toEqual(
        ids.slice(2, 4),
      );

      const page3 = await request(server())
        .get(`/conversations/${conversationId}/messages`)
        .query({ limit: 2, cursor: page2.body.nextCursor })
        .set('Authorization', bearerToken(fanToken))
        .expect(200);
      expect(page3.body.data.map((m: { id: number }) => m.id)).toEqual(
        ids.slice(4, 5),
      );
      expect(page3.body.hasMore).toBe(false);
    });
  });

  describe('POST /conversations/:id/read', () => {
    let conversationId: number;

    beforeEach(async () => {
      const res = await request(server())
        .post('/conversations')
        .set('Authorization', bearerToken(fanToken))
        .send({ creatorId })
        .expect(201);
      conversationId = res.body.id;
    });

    it('requires authentication (401)', async () => {
      await request(server())
        .post(`/conversations/${conversationId}/read`)
        .send({})
        .expect(401);
    });

    it('returns 403 for a non-participant', async () => {
      await request(server())
        .post(`/conversations/${conversationId}/read`)
        .set('Authorization', bearerToken(otherFanToken))
        .send({})
        .expect(403);
    });

    it('marks unread messages from the other participant as read', async () => {
      const msg1 = await request(server())
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', bearerToken(fanToken))
        .send({ body: 'First' })
        .expect(201);

      await request(server())
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', bearerToken(fanToken))
        .send({ body: 'Second' })
        .expect(201);

      const readRes = await request(server())
        .post(`/conversations/${conversationId}/read`)
        .set('Authorization', bearerToken(creatorToken))
        .send({ messageId: msg1.body.id })
        .expect(200);
      expect(readRes.body.updated).toBe(1);

      const messages = await messageRepository.find({
        where: { conversationId },
        order: { id: 'ASC' },
      });
      expect(messages[0].readAt).not.toBeNull();
      expect(messages[1].readAt).toBeNull();
    });

    it('does not mark the reader’s own messages as read', async () => {
      await request(server())
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', bearerToken(creatorToken))
        .send({ body: 'From creator' })
        .expect(201);

      await request(server())
        .post(`/conversations/${conversationId}/read`)
        .set('Authorization', bearerToken(creatorToken))
        .send({})
        .expect(200);

      const messages = await messageRepository.find({
        where: { conversationId },
      });
      expect(messages[0].readAt).toBeNull();
    });
  });
});
