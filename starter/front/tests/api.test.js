// Tests de src/api.js : on remplace fetch par un faux (mock), pas besoin d'API.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTask,
  deleteTask,
  getHealth,
  listTasks,
  toggleTask,
} from '../src/api.js';

// Fabrique une fausse réponse HTTP
function fakeResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe('api.js', () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('listTasks appelle GET /api/tasks et renvoie la liste', async () => {
    const tasks = [{ id: 1, title: 'a', done: false }];
    fetchMock.mockResolvedValue(fakeResponse(200, tasks));

    const result = await listTasks();

    expect(fetchMock).toHaveBeenCalledWith('/api/tasks', undefined);
    expect(result).toEqual(tasks);
  });

  it('createTask envoie le titre en JSON avec POST', async () => {
    const created = { id: 2, title: 'nouvelle', done: false };
    fetchMock.mockResolvedValue(fakeResponse(201, created));

    const result = await createTask('nouvelle');

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/tasks');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ title: 'nouvelle' });
    expect(result).toEqual(created);
  });

  it('toggleTask appelle PATCH /api/tasks/:id/toggle', async () => {
    fetchMock.mockResolvedValue(fakeResponse(200, { id: 3, done: true }));

    await toggleTask(3);

    expect(fetchMock).toHaveBeenCalledWith('/api/tasks/3/toggle', {
      method: 'PATCH',
    });
  });

  it('deleteTask appelle DELETE et gère la réponse 204 sans corps', async () => {
    fetchMock.mockResolvedValue(fakeResponse(204, undefined));

    const result = await deleteTask(4);

    expect(fetchMock).toHaveBeenCalledWith('/api/tasks/4', {
      method: 'DELETE',
    });
    expect(result).toBeNull();
  });

  it('getHealth lit /health', async () => {
    const health = { status: 'ok', db: 'up', version: 'dev', env: 'local' };
    fetchMock.mockResolvedValue(fakeResponse(200, health));

    expect(await getHealth()).toEqual(health);
  });

  it("lève une erreur lisible quand l'API répond une erreur HTTP", async () => {
    fetchMock.mockResolvedValue(fakeResponse(500, { error: 'boom' }));

    await expect(listTasks()).rejects.toThrow('HTTP 500');
  });

  it("propage l'erreur réseau quand l'API est injoignable", async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(listTasks()).rejects.toThrow('Failed to fetch');
  });
});
