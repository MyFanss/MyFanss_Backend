import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createTestingApp } from './helpers/e2e-app';

describe('Posts (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let userId: number;
  let postId: number;

  beforeAll(async () => {
    app = await createTestingApp();

    const signupRes = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        name: 'Test Creator',
        email: 'test-creator@example.com',
        password: 'TestPass123!',
      })
      .expect(201);

    token = signupRes.body.accessToken;
    userId = signupRes.body.user.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /creators/me/posts (Create)', () => {
    it('should create a post with valid data', async () => {
      const res = await request(app.getHttpServer())
        .post('/creators/me/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'My First Post',
          body: 'This is the content of my first post',
          visibility: 'public',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.title).toBe('My First Post');
      expect(res.body.visibility).toBe('public');
      expect(res.body.creatorId).toBe(userId);

      postId = res.body.id;
    });

    it('should reject title longer than 200 chars', async () => {
      const longTitle = 'a'.repeat(201);
      const res = await request(app.getHttpServer())
        .post('/creators/me/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: longTitle,
          body: 'Body',
          visibility: 'public',
        });

      expect(res.status).toBe(400);
    });

    it('should reject body longer than 5000 chars', async () => {
      const longBody = 'a'.repeat(5001);
      const res = await request(app.getHttpServer())
        .post('/creators/me/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Title',
          body: longBody,
          visibility: 'public',
        });

      expect(res.status).toBe(400);
    });

    it('should reject invalid visibility', async () => {
      const res = await request(app.getHttpServer())
        .post('/creators/me/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Title',
          body: 'Body',
          visibility: 'invalid',
        });

      expect(res.status).toBe(400);
    });

    it('should require authentication', async () => {
      const res = await request(app.getHttpServer())
        .post('/creators/me/posts')
        .send({
          title: 'Title',
          body: 'Body',
          visibility: 'public',
        });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /creators/me/posts (List own posts)', () => {
    beforeAll(async () => {
      // Create multiple posts for pagination testing
      for (let i = 0; i < 15; i++) {
        await request(app.getHttpServer())
          .post('/creators/me/posts')
          .set('Authorization', `Bearer ${token}`)
          .send({
            title: `Post ${i}`,
            body: `Body ${i}`,
            visibility: i % 2 === 0 ? 'public' : 'subscribers',
          });
      }
    });

    it('should return paginated posts', async () => {
      const res = await request(app.getHttpServer())
        .get('/creators/me/posts')
        .set('Authorization', `Bearer ${token}`)
        .query({ page: 1, limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('page');
      expect(res.body).toHaveProperty('limit');
      expect(res.body).toHaveProperty('totalPages');
      expect(res.body.data.length).toBeLessThanOrEqual(10);
    });

    it('should sort by publishedAt descending', async () => {
      const res = await request(app.getHttpServer())
        .get('/creators/me/posts')
        .set('Authorization', `Bearer ${token}`)
        .query({ page: 1, limit: 100 });

      expect(res.status).toBe(200);
      const dates = res.body.data.map((p) => new Date(p.publishedAt).getTime());
      for (let i = 0; i < dates.length - 1; i++) {
        expect(dates[i]).toBeGreaterThanOrEqual(dates[i + 1]);
      }
    });

    it('should handle pagination', async () => {
      const res1 = await request(app.getHttpServer())
        .get('/creators/me/posts')
        .set('Authorization', `Bearer ${token}`)
        .query({ page: 1, limit: 5 });

      const res2 = await request(app.getHttpServer())
        .get('/creators/me/posts')
        .set('Authorization', `Bearer ${token}`)
        .query({ page: 2, limit: 5 });

      expect(res1.body.data[0].id).not.toBe(res2.body.data[0].id);
    });

    it('should require authentication', async () => {
      const res = await request(app.getHttpServer()).get('/creators/me/posts');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /creators/:handle/posts (Public posts)', () => {
    let secondToken: string;
    let secondUserId: number;

    beforeAll(async () => {
      // Create a second user
      const signupRes = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          email: 'second-creator@example.com',
          password: 'TestPass123!',
          username: 'secondcreator',
        });

      secondToken = signupRes.body.accessToken;
      secondUserId = signupRes.body.user.id;

      // Create posts with different visibility
      await request(app.getHttpServer())
        .post('/creators/me/posts')
        .set('Authorization', `Bearer ${secondToken}`)
        .send({
          title: 'Public Post',
          body: 'This is public',
          visibility: 'public',
        });

      await request(app.getHttpServer())
        .post('/creators/me/posts')
        .set('Authorization', `Bearer ${secondToken}`)
        .send({
          title: 'Subscriber Post',
          body: 'Only for subscribers',
          visibility: 'subscribers',
        });
    });

    it('should return public posts without authentication', async () => {
      const res = await request(app.getHttpServer()).get(
        `/creators/${secondUserId}/posts`,
      );

      expect(res.status).toBe(200);
      expect(res.body.data).toContainEqual(
        expect.objectContaining({
          title: 'Public Post',
          visibility: 'public',
        }),
      );
    });

    it('should hide subscriber posts from non-subscribers', async () => {
      const res = await request(app.getHttpServer()).get(
        `/creators/${secondUserId}/posts`,
      );

      const subscriberPost = res.body.data.find(
        (p) => p.title === 'Subscriber Post',
      );
      expect(subscriberPost).toBeUndefined();
    });

    it('should be paginated', async () => {
      const res = await request(app.getHttpServer())
        .get(`/creators/${secondUserId}/posts`)
        .query({ page: 1, limit: 1 });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(1);
      expect(res.body).toHaveProperty('totalPages');
    });
  });

  describe('PATCH /creators/me/posts/:id (Update)', () => {
    let updatePostId: number;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/creators/me/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Post to Update',
          body: 'Original body',
          visibility: 'public',
        });

      updatePostId = res.body.id;
    });

    it('should update a post', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/creators/me/posts/${updatePostId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Updated Title',
          body: 'Updated body',
        });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Updated Title');
      expect(res.body.body).toBe('Updated body');
    });

    it('should allow partial updates', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/creators/me/posts/${updatePostId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Another Update' });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Another Update');
    });

    it('should prevent non-owner from updating', async () => {
      const anotherRes = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          email: 'another@example.com',
          password: 'TestPass123!',
          username: 'another',
        });

      const anotherToken = anotherRes.body.accessToken;

      const res = await request(app.getHttpServer())
        .patch(`/creators/me/posts/${updatePostId}`)
        .set('Authorization', `Bearer ${anotherToken}`)
        .send({ title: 'Hacked' });

      expect(res.status).toBe(403);
    });

    it('should return 404 for non-existent post', async () => {
      const res = await request(app.getHttpServer())
        .patch('/creators/me/posts/99999')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Updated' });

      expect(res.status).toBe(404);
    });

    it('should require authentication', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/creators/me/posts/${updatePostId}`)
        .send({ title: 'Updated' });

      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /creators/me/posts/:id (Delete)', () => {
    let deletePostId: number;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/creators/me/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Post to Delete',
          body: 'Will be deleted',
          visibility: 'public',
        });

      deletePostId = res.body.id;
    });

    it('should delete a post', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/creators/me/posts/${deletePostId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(204);

      // Verify deletion
      const getRes = await request(app.getHttpServer()).get(
        `/creators/${userId}/posts`,
      );
      const deleted = getRes.body.data.find((p) => p.id === deletePostId);
      expect(deleted).toBeUndefined();
    });

    it('should prevent non-owner from deleting', async () => {
      // Create another post
      const createRes = await request(app.getHttpServer())
        .post('/creators/me/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Protected Post',
          body: 'Should not be deleted by others',
          visibility: 'public',
        });

      const protectedPostId = createRes.body.id;

      // Try to delete with different user
      const anotherRes = await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          email: 'attacker@example.com',
          password: 'TestPass123!',
          username: 'attacker',
        });

      const attackerToken = anotherRes.body.accessToken;

      const res = await request(app.getHttpServer())
        .delete(`/creators/me/posts/${protectedPostId}`)
        .set('Authorization', `Bearer ${attackerToken}`);

      expect(res.status).toBe(403);
    });

    it('should return 404 for non-existent post', async () => {
      const res = await request(app.getHttpServer())
        .delete('/creators/me/posts/99999')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('should require authentication', async () => {
      const res = await request(app.getHttpServer()).delete(
        `/creators/me/posts/${deletePostId}`,
      );

      expect(res.status).toBe(401);
    });
  });
});
