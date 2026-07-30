import * as request from 'supertest';
import { clearDatabase, createE2eApp, E2eTestApp } from './helpers/e2e-app';
import { bearerToken, signupUser } from './helpers/auth';

describe('Posts (e2e)', () => {
  let testApp: E2eTestApp;
  let token: string;
  let userId: number;
  let handle: string;

  beforeAll(async () => {
    testApp = await createE2eApp();
    await clearDatabase(testApp.dataSource);

    const auth = await signupUser(testApp.app, {
      name: 'Test Creator',
      email: 'test-creator@example.com',
    });
    token = auth.token;
    userId = auth.user.id;
    handle = 'creator_main';

    await request(testApp.app.getHttpServer())
      .post('/creators/onboard')
      .set('Authorization', bearerToken(token))
      .send({ handle })
      .expect(201);
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  const server = () => testApp.app.getHttpServer();
  const authHeader = () => bearerToken(token);

  async function onboardAsCreator(creatorToken: string, creatorHandle: string) {
    await request(server())
      .post('/creators/onboard')
      .set('Authorization', bearerToken(creatorToken))
      .send({ handle: creatorHandle })
      .expect(201);
  }

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

  describe('GET /creators/:handle/posts (Handle resolution + visibility)', () => {
    let secondUserId: number;
    let secondHandle: string;
    let secondToken: string;
    let publicPostId: number;
    let subscriberPostId: number;

    beforeAll(async () => {
      const secondUser = await signupUser(testApp.app, {
        name: 'Second Creator',
        email: 'second-creator@example.com',
      });
      secondToken = secondUser.token;
      secondUserId = secondUser.user.id;
      secondHandle = 'creator_two';

      await onboardAsCreator(secondToken, secondHandle);

      const publicRes = await request(server())
        .post('/creators/me/posts')
        .set('Authorization', bearerToken(secondToken))
        .send({
          title: 'Public Post',
          body: 'This is public',
          visibility: 'public',
        })
        .expect(201);
      publicPostId = publicRes.body.id;

      const subscriberRes = await request(server())
        .post('/creators/me/posts')
        .set('Authorization', bearerToken(secondToken))
        .send({
          title: 'Subscriber Post',
          body: 'Only for subscribers — should never leak',
          visibility: 'subscribers',
        })
        .expect(201);
      subscriberPostId = subscriberRes.body.id;
    });

    it('resolves a string handle like "creator_two" (not a numeric id)', async () => {
      await request(server())
        .get(`/creators/${secondHandle}/posts`)
        .expect(200);
    });

    it('returns 404 for a handle that does not exist', async () => {
      await request(server())
        .get('/creators/no_such_creator_handle/posts')
        .expect(404);
    });

    it('resolves the handle case-insensitively', async () => {
      const res = await request(server())
        .get(`/creators/${secondHandle.toUpperCase()}/posts`)
        .expect(200);

      expect(res.body.data).toContainEqual(
        expect.objectContaining({ title: 'Public Post' }),
      );
    });

    it('does not treat a UUID-shaped path segment as a primary key (404, not 500/200)', async () => {
      await request(server())
        .get('/creators/123e4567-e89b-12d3-a456-426614174000/posts')
        .expect(404);
    });

    it('returns public posts without authentication', async () => {
      const res = await request(server())
        .get(`/creators/${secondHandle}/posts`)
        .expect(200);

      expect(res.body.data).toContainEqual(
        expect.objectContaining({
          title: 'Public Post',
          visibility: 'public',
        }),
      );
    });

    it('hides subscriber posts from anonymous callers', async () => {
      const res = await request(server())
        .get(`/creators/${secondHandle}/posts`)
        .expect(200);

      const subscriberPost = res.body.data.find(
        (p) => p.title === 'Subscriber Post',
      );
      expect(subscriberPost).toBeUndefined();
    });

    it('hides subscriber posts from an authenticated non-subscriber', async () => {
      const stranger = await signupUser(testApp.app, {
        name: 'Stranger',
        email: 'stranger@example.com',
      });

      const res = await request(server())
        .get(`/creators/${secondHandle}/posts`)
        .set('Authorization', bearerToken(stranger.token))
        .expect(200);

      const subscriberPost = res.body.data.find(
        (p) => p.title === 'Subscriber Post',
      );
      expect(subscriberPost).toBeUndefined();
    });

    it('shows subscriber posts to an active subscriber', async () => {
      const fan = await signupUser(testApp.app, {
        name: 'Loyal Fan',
        email: 'loyal-fan@example.com',
      });

      await request(server())
        .post('/subscriptions')
        .set('Authorization', bearerToken(fan.token))
        .send({ creatorId: secondUserId })
        .expect(201);

      const res = await request(server())
        .get(`/creators/${secondHandle}/posts`)
        .set('Authorization', bearerToken(fan.token))
        .expect(200);

      expect(res.body.data).toContainEqual(
        expect.objectContaining({ title: 'Subscriber Post' }),
      );
    });

    it('hides subscriber posts again once the subscription is cancelled', async () => {
      const fan = await signupUser(testApp.app, {
        name: 'Fickle Fan',
        email: 'fickle-fan@example.com',
      });

      await request(server())
        .post('/subscriptions')
        .set('Authorization', bearerToken(fan.token))
        .send({ creatorId: secondUserId })
        .expect(201);

      await request(server())
        .delete(`/subscriptions/${secondUserId}`)
        .set('Authorization', bearerToken(fan.token))
        .expect(200);

      const res = await request(server())
        .get(`/creators/${secondHandle}/posts`)
        .set('Authorization', bearerToken(fan.token))
        .expect(200);

      const subscriberPost = res.body.data.find(
        (p) => p.title === 'Subscriber Post',
      );
      expect(subscriberPost).toBeUndefined();
    });

    it('shows the owner their own subscriber-only posts', async () => {
      const res = await request(server())
        .get(`/creators/${secondHandle}/posts`)
        .set('Authorization', bearerToken(secondToken))
        .expect(200);

      expect(res.body.data).toContainEqual(
        expect.objectContaining({ title: 'Subscriber Post' }),
      );
    });

    it('does not leak a subscriber post to a fan subscribed to a DIFFERENT creator (cross-tenant IDOR)', async () => {
      const otherCreator = await signupUser(testApp.app, {
        name: 'Other Creator',
        email: 'other-creator-idor@example.com',
      });
      await onboardAsCreator(otherCreator.token, 'creator_idor_other');

      const fan = await signupUser(testApp.app, {
        name: 'Cross Tenant Fan',
        email: 'cross-tenant-fan@example.com',
      });
      await request(server())
        .post('/subscriptions')
        .set('Authorization', bearerToken(fan.token))
        .send({ creatorId: otherCreator.user.id })
        .expect(201);

      const res = await request(server())
        .get(`/creators/${secondHandle}/posts`)
        .set('Authorization', bearerToken(fan.token))
        .expect(200);

      const subscriberPost = res.body.data.find(
        (p) => p.title === 'Subscriber Post',
      );
      expect(subscriberPost).toBeUndefined();
    });

    it('should be paginated', async () => {
      const res = await request(server())
        .get(`/creators/${secondHandle}/posts`)
        .query({ page: 1, limit: 1 })
        .expect(200);

      expect(res.body.data.length).toBeLessThanOrEqual(1);
      expect(res.body).toHaveProperty('totalPages');
    });

    describe('GET /creators/:handle/posts/:postId (detail parity)', () => {
      it('returns the public post to an anonymous caller', async () => {
        const res = await request(server())
          .get(`/creators/${secondHandle}/posts/${publicPostId}`)
          .expect(200);

        expect(res.body.title).toBe('Public Post');
      });

      it('returns 404 (not 403) for a subscriber post requested anonymously — no existence leak', async () => {
        const res = await request(server())
          .get(`/creators/${secondHandle}/posts/${subscriberPostId}`)
          .expect(404);

        expect(JSON.stringify(res.body)).not.toContain('Only for subscribers');
      });

      it('returns the subscriber post to an active subscriber', async () => {
        const fan = await signupUser(testApp.app, {
          name: 'Detail Fan',
          email: 'detail-fan@example.com',
        });
        await request(server())
          .post('/subscriptions')
          .set('Authorization', bearerToken(fan.token))
          .send({ creatorId: secondUserId })
          .expect(201);

        const res = await request(server())
          .get(`/creators/${secondHandle}/posts/${subscriberPostId}`)
          .set('Authorization', bearerToken(fan.token))
          .expect(200);

        expect(res.body.title).toBe('Subscriber Post');
      });

      it('returns 404 for a non-existent post id under a valid handle', async () => {
        await request(server())
          .get(`/creators/${secondHandle}/posts/9999999`)
          .expect(404);
      });
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

  describe('DELETE /creators/me/posts/:id (soft-delete)', () => {
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

    it('deletes a post and hides it from the owner list and the public handle route', async () => {
      await request(server())
        .delete(`/creators/me/posts/${deletePostId}`)
        .set('Authorization', authHeader())
        .expect(204);

      const ownList = await request(server())
        .get('/creators/me/posts')
        .set('Authorization', authHeader())
        .query({ limit: 100 })
        .expect(200);
      expect(
        ownList.body.data.find((p) => p.id === deletePostId),
      ).toBeUndefined();

      const publicList = await request(server())
        .get(`/creators/${handle}/posts`)
        .expect(200);
      expect(
        publicList.body.data.find((p) => p.id === deletePostId),
      ).toBeUndefined();
    });

    it('returns 404 for the detail endpoint after deletion', async () => {
      await request(server())
        .get(`/creators/${handle}/posts/${deletePostId}`)
        .expect(404);
    });

    it('should hide the deleted post from the owner active list', async () => {
      const res = await request(server())
        .get('/creators/me/posts')
        .set('Authorization', authHeader())
        .query({ page: 1, limit: 100 })
        .expect(200);

      const deleted = res.body.data.find((p) => p.id === deletePostId);
      expect(deleted).toBeUndefined();
    });

    it('should list the deleted post in the owner archive', async () => {
      const res = await request(server())
        .get('/creators/me/posts/archived')
        .set('Authorization', authHeader())
        .expect(200);

      const archived = res.body.data.find((p) => p.id === deletePostId);
      expect(archived).toBeDefined();
      expect(archived.deletedAt).not.toBeNull();
    });

    it('should be idempotent — deleting an already-deleted post returns 204', async () => {
      await request(server())
        .delete(`/creators/me/posts/${deletePostId}`)
        .set('Authorization', authHeader())
        .expect(204);
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

  describe('POST /creators/me/posts/:id/restore (Restore)', () => {
    let restorePostId: number;

    beforeAll(async () => {
      const res = await request(server())
        .post('/creators/me/posts')
        .set('Authorization', authHeader())
        .send({
          title: 'Post to Restore',
          body: 'Will be deleted then restored',
          visibility: 'public',
        })
        .expect(201);

      restorePostId = res.body.id;

      await request(server())
        .delete(`/creators/me/posts/${restorePostId}`)
        .set('Authorization', authHeader())
        .expect(204);
    });

    it('should restore a soft-deleted post back to public/owner lists', async () => {
      const res = await request(server())
        .post(`/creators/me/posts/${restorePostId}/restore`)
        .set('Authorization', authHeader())
        .expect(200);

      expect(res.body.deletedAt).toBeNull();

      const ownList = await request(server())
        .get('/creators/me/posts')
        .set('Authorization', authHeader())
        .query({ page: 1, limit: 100 })
        .expect(200);
      expect(
        ownList.body.data.find((p) => p.id === restorePostId),
      ).toBeDefined();

      const publicList = await request(server())
        .get(`/creators/${handle}/posts`)
        .query({ page: 1, limit: 100 })
        .expect(200);
      expect(
        publicList.body.data.find((p) => p.id === restorePostId),
      ).toBeDefined();
    });

    it('should return 409 when restoring a post that is not deleted', async () => {
      await request(server())
        .post(`/creators/me/posts/${restorePostId}/restore`)
        .set('Authorization', authHeader())
        .expect(409);
    });

    it("should prevent restoring another creator's post", async () => {
      const createRes = await request(server())
        .post('/creators/me/posts')
        .set('Authorization', authHeader())
        .send({
          title: 'Another Post',
          body: 'Owned by original creator',
          visibility: 'public',
        })
        .expect(201);

      await request(server())
        .delete(`/creators/me/posts/${createRes.body.id}`)
        .set('Authorization', authHeader())
        .expect(204);

      const otherUser = await signupUser(testApp.app, {
        name: 'Other Restorer',
        email: 'other-restorer@example.com',
      });

      await request(server())
        .post(`/creators/me/posts/${createRes.body.id}/restore`)
        .set('Authorization', bearerToken(otherUser.token))
        .expect(403);
    });

    it('should return 404 for non-existent post', async () => {
      await request(server())
        .post('/creators/me/posts/99999/restore')
        .set('Authorization', authHeader())
        .expect(404);
    });

    it('should require authentication', async () => {
      await request(server())
        .post(`/creators/me/posts/${restorePostId}/restore`)
        .expect(401);
    });
  });
});
