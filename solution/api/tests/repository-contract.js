// "Contrat" de test partagé : les MÊMES tests vérifient que n'importe quel
// repository (mémoire ou PostgreSQL) respecte la même interface.
// Ce fichier n'est pas un test lui-même (pas de .test.js) : il est importé.
import { beforeEach, describe, expect, it } from 'vitest';

export function describeRepositoryContract(name, createRepository) {
  describe(`${name} - contrat du repository`, () => {
    let repository;

    beforeEach(async () => {
      repository = await createRepository(); // un repository vide à chaque test
    });

    it('renvoie une liste vide au départ', async () => {
      expect(await repository.list()).toEqual([]);
    });

    it('crée une tâche non terminée avec un id', async () => {
      const task = await repository.create('Écrire le Dockerfile');

      expect(task).toMatchObject({
        title: 'Écrire le Dockerfile',
        done: false,
      });
      expect(task.id).toBeGreaterThan(0);
      expect(await repository.list()).toHaveLength(1);
    });

    it("liste les tâches dans l'ordre de création", async () => {
      await repository.create('première');
      await repository.create('seconde');

      const titles = (await repository.list()).map((task) => task.title);
      expect(titles).toEqual(['première', 'seconde']);
    });

    it("bascule l'état terminé / non terminé", async () => {
      const { id } = await repository.create('à basculer');

      expect((await repository.toggle(id)).done).toBe(true);
      expect((await repository.toggle(id)).done).toBe(false);
    });

    it('renvoie null pour toggle sur un id inconnu', async () => {
      expect(await repository.toggle(9999)).toBeNull();
    });

    it('supprime une tâche et renvoie true', async () => {
      const { id } = await repository.create('à supprimer');

      expect(await repository.remove(id)).toBe(true);
      expect(await repository.list()).toEqual([]);
    });

    it('renvoie false pour remove sur un id inconnu', async () => {
      expect(await repository.remove(9999)).toBe(false);
    });

    it('répond à ping sans erreur', async () => {
      await expect(repository.ping()).resolves.toBeUndefined();
    });
  });
}
