// Accès à PostgreSQL : création du pool de connexions et migration du schéma.
import pg from 'pg';

const CONNECTION_TIMEOUT_MS = 2000;

// Un "pool" garde quelques connexions ouvertes et les réutilise.
export function createPool(connectionString) {
  return new pg.Pool({
    connectionString,
    // Sans timeout, /health resterait bloqué si la base est injoignable
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
  });
}

// Crée la table si elle n'existe pas encore (appelée au démarrage de l'API).
// "IF NOT EXISTS" rend l'opération répétable sans risque.
export async function migrate(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id         SERIAL PRIMARY KEY,
      title      TEXT NOT NULL,
      done       BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}
