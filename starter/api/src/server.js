// Point d'entrée : lit la configuration, se connecte à la base, migre, puis écoute.
import { createApp } from './app.js';
import { readConfig } from './config.js';
import { createPool, migrate } from './db.js';
import { writeLog } from './logger.js';
import { createPostgresRepository } from './repositories/postgres.js';

// Arrêt propre quand Docker envoie SIGTERM (docker stop / redéploiement).
function shutdownOnSignal(server, pool) {
  const stop = () => {
    writeLog({ level: 'info', message: 'Arrêt demandé, fermeture...' });
    server.close(() => pool.end().then(() => process.exit(0)));
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

async function main() {
  const config = readConfig();
  const pool = createPool(config.databaseUrl);

  // Une erreur sur une connexion inactive ne doit pas faire planter l'API
  pool.on('error', (err) =>
    writeLog({
      level: 'error',
      message: `Erreur pool PostgreSQL : ${err.message}`,
    }),
  );

  await migrate(pool);

  const app = createApp({
    repository: createPostgresRepository(pool),
    appEnv: config.appEnv,
    appVersion: config.appVersion,
  });

  const server = app.listen(config.port, () => {
    writeLog({
      level: 'info',
      message: `API démarrée sur le port ${config.port}`,
      env: config.appEnv,
      version: config.appVersion,
    });
  });

  shutdownOnSignal(server, pool);
}

// Si le démarrage échoue (ex: base injoignable), on logge et on quitte avec un code
// d'erreur : Docker (restart policy) ou l'orchestrateur décidera de relancer.
main().catch((err) => {
  writeLog({
    level: 'fatal',
    message: `Démarrage impossible : ${err.message || err.code || err}`,
    hint: 'Vérifiez DATABASE_URL et que PostgreSQL est joignable',
  });
  process.exit(1);
});
