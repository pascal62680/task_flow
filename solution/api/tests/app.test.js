// Tests unitaires de l'API : repository en mémoire, aucune base de données.
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { createMemoryRepository } from '../src/repositories/memory.js';

describe('API TaskFlow', () => {
  let app;
  let log;

  beforeEach(() => {
    log = vi.fn(); // espion : remplace l'écriture des logs sur stdout
    app = createApp({
      repository: createMemoryRepository(),
      appEnv: 'test',
      appVersion: '1.2.3',
      log,
    });
  });

  describe('GET /api/tasks', () => {
    it('renvoie une liste vide au départ', async () => {
      const response = await request(app).get('/api/tasks');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  describe('POST /api/tasks', () => {
    it('crée une tâche et répond 201', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .send({ title: '  Apprendre Docker  ' });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        title: 'Apprendre Docker', // espaces retirés
        done: false,
      });
    });

    it.each([
      ['sans titre', {}],
      ['avec un titre vide', { title: '   ' }],
      ["avec un titre qui n'est pas du texte", { title: 42 }],
      ['avec un titre trop long', { title: 'x'.repeat(201) }],
    ])('répond 400 %s', async (_label, body) => {
      const response = await request(app).post('/api/tasks').send(body);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeTypeOf('string');
    });

    it('répond 400 pour un JSON invalide', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .set('Content-Type', 'application/json')
        .send('{pas du json');

      expect(response.status).toBe(400);
    });
  });

  describe('PATCH /api/tasks/:id/toggle', () => {
    it("bascule l'état de la tâche", async () => {
      const { body: created } = await request(app)
        .post('/api/tasks')
        .send({ title: 'à faire' });

      const response = await request(app).patch(
        `/api/tasks/${created.id}/toggle`,
      );

      expect(response.status).toBe(200);
      expect(response.body.done).toBe(true);
    });

    it('répond 404 pour une tâche inconnue', async () => {
      const response = await request(app).patch('/api/tasks/999/toggle');

      expect(response.status).toBe(404);
    });

    it('répond 400 pour un identifiant invalide', async () => {
      const response = await request(app).patch('/api/tasks/abc/toggle');

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/tasks/:id', () => {
    it('supprime la tâche et répond 204', async () => {
      const { body: created } = await request(app)
        .post('/api/tasks')
        .send({ title: 'à supprimer' });

      const response = await request(app).delete(`/api/tasks/${created.id}`);
      const list = await request(app).get('/api/tasks');

      expect(response.status).toBe(204);
      expect(list.body).toEqual([]);
    });

    it('répond 404 pour une tâche inconnue', async () => {
      const response = await request(app).delete('/api/tasks/999');

      expect(response.status).toBe(404);
    });
  });

  describe('GET /health', () => {
    it('indique que la base est up', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'ok',
        db: 'up',
        version: '1.2.3',
        env: 'test',
      });
    });

    it('répond 503 quand la base est down', async () => {
      const brokenRepository = {
        ...createMemoryRepository(),
        ping: async () => {
          throw new Error('connexion refusée');
        },
      };
      const brokenApp = createApp({ repository: brokenRepository, log });

      const response = await request(brokenApp).get('/health');

      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({ status: 'error', db: 'down' });
    });
  });

  describe('erreurs et logs', () => {
    it('répond 404 sur une route inconnue', async () => {
      const response = await request(app).get('/nimporte-quoi');

      expect(response.status).toBe(404);
    });

    it("répond 500 sans exposer le détail de l'erreur", async () => {
      const failingRepository = {
        ...createMemoryRepository(),
        list: async () => {
          throw new Error('secret interne');
        },
      };
      const failingApp = createApp({ repository: failingRepository, log });

      const response = await request(failingApp).get('/api/tasks');

      expect(response.status).toBe(500);
      expect(JSON.stringify(response.body)).not.toContain('secret interne');
      expect(log).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'error', message: 'secret interne' }),
      );
    });

    it('logge chaque requête avec method, path, status et ms', async () => {
      await request(app).get('/api/tasks?limit=5');

      expect(log).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          path: '/api/tasks', // sans la query string
          status: 200,
          ms: expect.any(Number),
        }),
      );
    });
  });
});
