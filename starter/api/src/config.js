// Lecture de la configuration depuis les variables d'environnement.
// Une seule fonction, pure : on lui donne un objet env, elle renvoie la config.

const DEFAULT_PORT = 3000;
const DEFAULT_DATABASE_URL =
  'postgres://taskflow:taskflow@localhost:5432/taskflow';

export function readConfig(env = process.env) {
  return Object.freeze({
    port: Number(env.PORT) || DEFAULT_PORT,
    databaseUrl: env.DATABASE_URL || DEFAULT_DATABASE_URL,
    appEnv: env.APP_ENV || 'local',
    appVersion: env.APP_VERSION || 'dev',
  });
}
