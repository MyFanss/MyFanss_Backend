import * as request from 'supertest';
import { clearDatabase, createE2eApp, E2eTestApp } from './helpers/e2e-app';
import { bearerToken, signupUser } from './helpers/auth';

describe('Posts (e2e)', () => {
  let testApp: E2eTestApp;
  let token: string;
  let userId: number;

  beforeAll(async () => {
    testApp = await createE2eApp();
    await clearDatabase(testApp.dataSource);

    const auth = await signupUser(testApp.app, {
      name: 'Test Creator',
      email: 'test-creator@example.com',
    });
    token = auth.token;
    userId = auth.user.id;
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  const server = () => testApp.app.getHttpServer();
  const authHeader = () => bearerToken(token);

  describe('POST /creators/me/posts (Create)', () => {
    it('should create a post with valid data', async () => {
      const res = await request(server())
        .post('/creators/me/posts')
        .set('Authorization', authHeader())
        .send({
          title: 'My First Post',
          body: 'This is the content of my first post',
          visibility: 'public',
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.title).toBe('My First Post');
      expect(res.body.visibility).toBe('public');
      expect(res.body.creatorId).toBe(userId);
    });

    it('should reject title longer than 200 chars', async () => {
      await request(server())
        .post('/creators/me/posts')
        .set('Authorization', authHeader())
        .send({
          title: 'a'.repeat(201),
          body: 'Body',
          visibility: 'public',
        })
        .expect(400);
    });

    it('should reject body longer than 5000 chars', async () => {
      await request(server())
        .post('/creators/me/posts')
        .set('Authorization', authHeader())
        .send({
          title: 'Title',
          body: 'a'.repeat(5001),
          visibility: 'public',
        })
        .expect(400);
    });

    it('should reject invalid visibility', async () => {
      await request(server())
        .post('/creators/me/posts')
        .set('Authorization', authHeader())
        .send({
          title: 'Title',
          body: 'Body',
          visibility: 'invalid',
        })
        .expect(400);
    });

    it('should require authentication', async () => {
      await request(server())
        .post('/creators/me/posts')
        .send({
          title: 'Title',
          body: 'Body',
          visibility: 'public',
        })
        .expect(401);
    });
  });

  describe('GET /creators/me/posts (List own posts)', () => {
    beforeAll(async () => {
      for (let i = 0; i < 15; i++) {
        await request(server())
          .post('/creators/me/posts')
          .set('Authorization', authHeader())
          .send({
            title: `Post ${i}`,
            body: `Body ${i}`,
            visibility: i % 2 === 0 ? 'public' : 'subscribers',
          })
          .expect(201);
      }
    });

    it('should return paginated posts', async () => {
      const res = await request(server())
        .get('/creators/me/posts')
        .set('Authorization', authHeader())
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('page');
      expect(res.body).toHaveProperty('limit');
      expect(res.body).toHaveProperty('totalPages');
      expect(res.body.data.length).toBeLessThanOrEqual(10);
    });

    it('should sort by publishedAt descending', async () => {
      const res = await request(server())
        .get('/creators/me/posts')
        .set('Authorization', authHeader())
        .query({ page: 1, limit: 100 })
        .expect(200);

      const dates = res.body.data.map((p) => new Date(p.publishedAt).getTime());
      for (let i = 0; i < dates.length - 1; i++) {
        expect(dates[i]).toBeGreaterThanOrEqual(dates[i + 1]);
      }
    });

    it('should handle pagination', async () => {
      const res1 = await request(server())
        .get('/creators/me/posts')
        .set('Authorization', authHeader())
        .query({ page: 1, limit: 5 })
        .expect(200);

      const res2 = await request(server())
        .get('/creators/me/posts')
        .set('Authorization', authHeader())
        .query({ page: 2, limit: 5 })
        .expect(200);

      expect(res1.body.data.length).toBeGreaterThan(0);
      expect(res2.body.data.length).toBeGreaterThan(0);
      expect(res1.body.data[0].id).not.toBe(res2.body.data[0].id);
    });

    it('should require authentication', async () => {
      await request(server()).get('/creators/me/posts').expect(401);
    });
  });

  describe('GET /creators/:handle/posts (Public posts)', () => {
    let secondUserId: number;

    beforeAll(async () => {
      const secondUser = await signupUser(testApp.app, {
        name: 'Second Creator',
        email: 'second-creator@example.com',
      });
      const secondToken = bearerToken(secondUser.token);
      secondUserId = secondUser.user.id;

      await request(server())
        .post('/creators/me/posts')
        .set('Authorization', secondToken)
        .send({
          title: 'Public Post',
          body: 'This is public',
          visibility: 'public',
        })
        .expect(201);

      await request(server())
        .post('/creators/me/posts')
        .set('Authorization', secondToken)
        .send({
          title: 'Subscriber Post',
          body: 'Only for subscribers',
          visibility: 'subscribers',
        })
        .expect(201);
    });

    it('should return public posts without authentication', async () => {
      const res = await request(server())
        .get(`/creators/${secondUserId}/posts`)
        .expect(200);

      expect(res.body.data).toContainEqual(
        expect.objectContaining({
          title: 'Public Post',
          visibility: 'public',
        }),
      );
    });

    it('should hide subscriber posts from non-subscribers', async () => {
      const res = await request(server())
        .get(`/creators/${secondUserId}/posts`)
        .expect(200);

      const subscriberPost = res.body.data.find(
        (p) => p.title === 'Subscriber Post',
      );
      expect(subscriberPost).toBeUndefined();
    });

    it('should be paginated', async () => {
      const res = await request(server())
        .get(`/creators/${secondUserId}/posts`)
        .query({ page: 1, limit: 1 })
        .expect(200);

      expect(res.body.data.length).toBeLessThanOrEqual(1);
      expect(res.body).toHaveProperty('totalPages');
    });
  });

  describe('PATCH /creators/me/posts/:id (Update)', () => {
    let updatePostId: number;

    beforeAll(async () => {
      const res = await request(server())
        .post('/creators/me/posts')
        .set('Authorization', authHeader())
        .send({
          title: 'Post to Update',
          body: 'Original body',
          visibility: 'public',
        })
        .expect(201);

      updatePostId = res.body.id;
    });

    it('should update a post', async () => {
      const res = await request(server())
        .patch(`/creators/me/posts/${updatePostId}`)
        .set('Authorization', authHeader())
        .send({
          title: 'Updated Title',
          body: 'Updated body',
        })
        .expect(200);

      expect(res.body.title).toBe('Updated Title');
      expect(res.body.body).toBe('Updated body');
    });

    it('should allow partial updates', async () => {
      const res = await request(server())
        .patch(`/creators/me/posts/${updatePostId}`)
        .set('Authorization', authHeader())
        .send({ title: 'Another Update' })
        .expect(200);

      expect(res.body.title).toBe('Another Update');
    });

    it('should prevent non-owner from updating', async () => {
      const otherUser = await signupUser(testApp.app, {
        name: 'Another User',
        email: 'another@example.com',
      });

      await request(server())
        .patch(`/creators/me/posts/${updatePostId}`)
        .set('Authorization', bearerToken(otherUser.token))
        .send({ title: 'Hacked' })
        .expect(403);
    });

    it('should return 404 for non-existent post', async () => {
      await request(server())
        .patch('/creators/me/posts/99999')
        .set('Authorization', authHeader())
        .send({ title: 'Updated' })
        .expect(404);
    });

    it('should require authentication', async () => {
      await request(server())
        .patch(`/creators/me/posts/${updatePostId}`)
        .send({ title: 'Updated' })
        .expect(401);
    });
  });

  describe('DELETE /creators/me/posts/:id (Delete)', () => {
    let deletePostId: number;

    beforeAll(async () => {
      const res = await request(server())
        .post('/creators/me/posts')
        .set('Authorization', authHeader())
        .send({
          title: 'Post to Delete',
          body: 'Will be deleted',
          visibility: 'public',
        })
        .expect(201);

      deletePostId = res.body.id;
    });

    it('should delete a post', async () => {
      await request(server())
        .delete(`/creators/me/posts/${deletePostId}`)
        .set('Authorization', authHeader())
        .expect(204);

      const getRes = await request(server())
        .get(`/creators/${userId}/posts`)
        .expect(200);

      const deleted = getRes.body.data.find((p) => p.id === deletePostId);
      expect(deleted).toBeUndefined();
    });

    it('should prevent non-owner from deleting', async () => {
      const createRes = await request(server())
        .post('/creators/me/posts')
        .set('Authorization', authHeader())
        .send({
          title: 'Protected Post',
          body: 'Should not be deleted by others',
          visibility: 'public',
        })
        .expect(201);

      const attacker = await signupUser(testApp.app, {
        name: 'Attacker',
        email: 'attacker@example.com',
      });

      await request(server())
        .delete(`/creators/me/posts/${createRes.body.id}`)
        .set('Authorization', bearerToken(attacker.token))
        .expect(403);
    });

    it('should return 404 for non-existent post', async () => {
      await request(server())
        .delete('/creators/me/posts/99999')
        .set('Authorization', authHeader())
        .expect(404);
    });

    it('should require authentication', async () => {
      await request(server())
        .delete(`/creators/me/posts/${deletePostId}`)
        .expect(401);
    });
  });
});
