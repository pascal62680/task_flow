// Test d'INTÉGRATION : nécessite une vraie base PostgreSQL.
// Il est ignoré (skip) tant que DATABASE_URL n'est pas défini, pour que
// `npm test` reste utilisable sans base. Lancer avec :
//   DATABASE_URL=postgres://taskflow:taskflow@localhost:5432/taskflow npm run test:int
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createPool, migrate } from '../src/db.js';
import { createPostgresRepository } from '../src/repositories/postgres.js';
import { describeRepositoryContract } from './repository-contract.js';

// La connexion est créée dans beforeAll (pas dans le corps du describe) :
// ainsi, rien ne se connecte quand la suite est ignorée.
describe.skipIf(!process.env.DATABASE_URL)('PostgreSQL (intégration)', () => {
  let pool;

  beforeAll(async () => {
    pool = createPool(process.env.DATABASE_URL);
    await migrate(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  // Table vide + repository neuf avant chaque test du contrat
  const createCleanRepository = async () => {
    await pool.query('TRUNCATE tasks RESTART IDENTITY');
    return createPostgresRepository(pool);
  };

  describeRepositoryContract('postgres', createCleanRepository);

  describe('migrate', () => {
    it('est répétable sans erreur', async () => {
      await expect(migrate(pool)).resolves.toBeUndefined();
    });
  });

  describe('API branchée sur PostgreSQL', () => {
    it('crée une tâche puis la relit, et /health indique db up', async () => {
      const app = createApp({
        repository: await createCleanRepository(),
        log: () => {},
      });

      await request(app)
        .post('/api/tasks')
        .send({ title: 'en base' })
        .expect(201);
      const list = await request(app).get('/api/tasks').expect(200);
      const health = await request(app).get('/health').expect(200);

      expect(list.body[0]).toMatchObject({ title: 'en base', done: false });
      expect(health.body.db).toBe('up');
    });
  });
});
