// Interface de TaskFlow : affiche la liste et réagit aux actions de l'utilisateur.
import './styles.css';
import {
  createTask,
  deleteTask,
  getHealth,
  listTasks,
  toggleTask,
} from './api.js';

const form = document.querySelector('#new-task-form');
const input = document.querySelector('#new-task-title');
const list = document.querySelector('#task-list');
const errorBox = document.querySelector('#error');
const statusBox = document.querySelector('#status');

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = !message;
}

// Construit un <li> pour une tâche. textContent (et non innerHTML) évite
// toute injection de HTML venant d'un titre malveillant (faille XSS).
function renderTask(task) {
  const item = document.createElement('li');
  item.className = task.done ? 'task done' : 'task';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = task.done;
  checkbox.addEventListener('change', () =>
    runAction(() => toggleTask(task.id)),
  );

  const title = document.createElement('span');
  title.textContent = task.title;

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.textContent = 'Supprimer';
  remove.addEventListener('click', () => runAction(() => deleteTask(task.id)));

  item.append(checkbox, title, remove);
  return item;
}

async function refresh() {
  const tasks = await listTasks();
  list.replaceChildren(...tasks.map(renderTask));
}

// Exécute une action puis rafraîchit la liste ; affiche l'erreur éventuelle.
async function runAction(action) {
  try {
    showError('');
    await action();
    await refresh();
  } catch (error) {
    showError(error.message);
  }
}

async function showHealth() {
  try {
    const health = await getHealth();
    statusBox.textContent = `API : ${health.status} · base : ${health.db} · version ${health.version} (${health.env})`;
  } catch {
    statusBox.textContent = 'API injoignable';
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const title = input.value.trim();
  if (!title) return;

  input.value = '';
  runAction(() => createTask(title));
});

runAction(refresh);
showHealth();
