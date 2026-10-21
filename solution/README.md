# TaskFlow

Un petit gestionnaire de tâches, volontairement simple : c'est le **fil rouge** de la
formation DevOps. Le code est fourni ; votre travail sera de le **conteneuriser, tester
automatiquement, publier et déployer**.

```
taskflow/
├── front/   # Interface web : Vite + JavaScript (sans framework)
└── api/     # API REST : Node 20 + Express + PostgreSQL
```

## Ce qu'il faut sur votre poste

- Node.js 20 ou plus (`node -v`)
- Docker (uniquement pour lancer la base PostgreSQL pendant cette première étape)

## Lancer l'application en local

### 1. La base de données PostgreSQL (une seule ligne)

```bash
docker run -d --name taskflow-db -e POSTGRES_USER=taskflow -e POSTGRES_PASSWORD=taskflow -e POSTGRES_DB=taskflow -p 5432:5432 postgres:16-alpine
```

> Ces valeurs correspondent à `DATABASE_URL` par défaut :
> `postgres://taskflow:taskflow@localhost:5432/taskflow`.
> Pour arrêter puis supprimer la base : `docker rm -f taskflow-db`.

### 2. L'API (port 3000)

```bash
cd api
npm ci
npm run dev
```

Vérification : <http://localhost:3000/health> doit afficher `{"status":"ok","db":"up",...}`.

### 3. Le front (port 5173)

Dans un **second terminal** :

```bash
cd front
npm ci
npm run dev
```

Ouvrez <http://localhost:5173>. En développement, Vite redirige `/api` et `/health`
vers l'API (voir `front/vite.config.js`).

## Variables d'environnement de l'API

| Variable       | Défaut                                                  | Rôle                              |
| -------------- | ------------------------------------------------------- | --------------------------------- |
| `PORT`         | `3000`                                                  | Port d'écoute                     |
| `DATABASE_URL` | `postgres://taskflow:taskflow@localhost:5432/taskflow`  | Connexion PostgreSQL              |
| `APP_ENV`      | `local`                                                 | `local` ou `production`           |
| `APP_VERSION`  | `dev`                                                   | Version affichée dans `/health`   |

Voir `api/.env.example`. Ne commitez jamais un vrai fichier `.env`.

## Qualité du code

Dans `api/` **et** dans `front/` :

| Commande               | Rôle                                         |
| ---------------------- | -------------------------------------------- |
| `npm run lint`         | Analyse du code avec ESLint                  |
| `npm run format:check` | Vérifie le formatage Prettier                |
| `npm run format`       | Reformate automatiquement le code            |
| `npm test`             | Tests unitaires (Vitest)                     |

Spécifique à l'API : `npm run test:int` lance le test d'intégration avec une vraie base
(il est ignoré si `DATABASE_URL` n'est pas défini) :

```bash
DATABASE_URL=postgres://taskflow:taskflow@localhost:5432/taskflow npm run test:int
```

## Aperçu de l'API

| Méthode et chemin           | Rôle                                  | Réponse          |
| --------------------------- | ------------------------------------- | ---------------- |
| `GET /api/tasks`            | Liste des tâches                      | 200              |
| `POST /api/tasks`           | Crée une tâche (`{ "title": "..." }`) | 201              |
| `PATCH /api/tasks/:id/toggle` | Bascule terminée / à faire          | 200 ou 404       |
| `DELETE /api/tasks/:id`     | Supprime une tâche                    | 204 ou 404       |
| `GET /health`               | État de l'API et de la base           | 200, ou 503 si la base est down |

L'API écrit **une ligne JSON par requête** sur sa sortie standard (`method`, `path`,
`status`, `ms`) : vous les retrouverez avec `docker logs` plus tard.

---

## Version « solution » : Docker, CI/CD et déploiement

Cette version contient en plus tout ce qui est construit pendant la formation.

### Tout lancer avec Docker Compose (une commande)

```bash
docker compose up -d --build
docker compose ps            # db, api et front doivent être "healthy"
```

Application : <http://localhost:8080> · santé : <http://localhost:8080/health>.
Arrêter : `docker compose down` (garde les données) ou `docker compose down -v` (efface aussi le volume).

### Fichiers ajoutés

| Fichier / dossier | Rôle |
| --- | --- |
| `api/Dockerfile`, `front/Dockerfile`, `front/nginx.conf`, `*/.dockerignore` | Images Docker |
| `compose.yaml` | Environnement de développement (db + api + front) |
| `compose.prod.yaml`, `.env.example` | Version « prod » (images ghcr.io, `.env`, service `proxy` HTTPS seul exposé) |
| `.github/workflows/ci.yml` | Lint, tests (avec Postgres) et build à chaque PR / push |
| `.github/workflows/release.yml` | Publication des images sur ghcr.io puis déploiement + smoke test |
| `.github/pull_request_template.md`, `.github/CODEOWNERS` | Collaboration |
| `deploy/nginx/taskflow.conf`, `deploy/gen-cert.sh`, `deploy/deploy.sh`, `deploy/backup.sh` | Prod : reverse proxy HTTPS, certificat, déploiement, sauvegarde |
| `docs/ARCHITECTURE.md`, `docs/DEPLOIEMENT.md`, `docs/INCIDENTS.md` | Documentation d'exploitation |
