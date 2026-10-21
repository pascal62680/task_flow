// Toutes les communications avec l'API passent par ce fichier.
// Les chemins sont relatifs (/api/...) : en dev, Vite les redirige vers l'API ;
// en production, c'est Nginx qui s'en charge.

async function request(path, options) {
  const response = await fetch(path, options);

  if (!response.ok) {
    throw new Error(`Erreur de l'API (HTTP ${response.status})`);
  }

  // 204 No Content : il n'y a pas de corps à lire
  return response.status === 204 ? null : response.json();
}

export function listTasks() {
  return request('/api/tasks');
}

export function createTask(title) {
  return request('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
}

export function toggleTask(id) {
  return request(`/api/tasks/${id}/toggle`, { method: 'PATCH' });
}

export function deleteTask(id) {
  return request(`/api/tasks/${id}`, { method: 'DELETE' });
}

export function getHealth() {
  return request('/health');
}
