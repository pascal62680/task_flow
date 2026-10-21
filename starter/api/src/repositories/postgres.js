// Repository PostgreSQL : même interface que memory.js (voir ce fichier).
// Les valeurs ($1, $2...) sont TOUJOURS passées en paramètres : jamais de
// concaténation de texte dans une requête SQL (risque d'injection SQL).

export function createPostgresRepository(pool) {
  return {
    async list() {
      const result = await pool.query('SELECT * FROM tasks ORDER BY id');
      return result.rows;
    },

    async create(title) {
      const result = await pool.query(
        'INSERT INTO tasks (title) VALUES ($1) RETURNING *',
        [title],
      );
      return result.rows[0];
    },

    async toggle(id) {
      const result = await pool.query(
        'UPDATE tasks SET done = NOT done WHERE id = $1 RETURNING *',
        [id],
      );
      return result.rows[0] ?? null;
    },

    async remove(id) {
      const result = await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
      return result.rowCount > 0;
    },

    async ping() {
      await pool.query('SELECT 1');
    },
  };
}
