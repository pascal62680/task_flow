// Repository "en mémoire" : mêmes méthodes que la version PostgreSQL,
// mais les données vivent dans une variable. Parfait pour les tests (rapide, sans BDD).
//
// Interface commune à tous les repositories :
//   list()          -> Promise<Task[]>
//   create(title)   -> Promise<Task>
//   toggle(id)      -> Promise<Task | null>   (null si l'id n'existe pas)
//   remove(id)      -> Promise<boolean>       (false si l'id n'existe pas)
//   ping()          -> Promise<void>          (rejette si la base est injoignable)

export function createMemoryRepository() {
  // On ne modifie jamais le tableau : on le REMPLACE par une nouvelle copie.
  let tasks = [];
  let nextId = 1;

  return {
    async list() {
      return tasks;
    },

    async create(title) {
      const task = {
        id: nextId,
        title,
        done: false,
        created_at: new Date().toISOString(),
      };
      nextId += 1;
      tasks = [...tasks, task];
      return task;
    },

    async toggle(id) {
      const current = tasks.find((task) => task.id === id);
      if (!current) return null;

      const updated = { ...current, done: !current.done };
      tasks = tasks.map((task) => (task.id === id ? updated : task));
      return updated;
    },

    async remove(id) {
      const remaining = tasks.filter((task) => task.id !== id);
      const wasFound = remaining.length < tasks.length;
      tasks = remaining;
      return wasFound;
    },

    async ping() {
      // La mémoire est toujours disponible
    },
  };
}
