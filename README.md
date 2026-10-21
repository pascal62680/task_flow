# Fil rouge : TaskFlow

> **Quand** : du jour 2 au jour 4 | **Format** : individuel (avec un binôme pour les revues de code)
> **Objectif** : prendre une application qui « marche sur ma machine » et la rendre **reproductible** (Docker),
> **vérifiée automatiquement** (intégration continue), **publiée** (ghcr.io) et **déployée** derrière Nginx en HTTPS,
> automatiquement et de façon supervisée.

---

## Présentation de TaskFlow

TaskFlow est un gestionnaire de tâches **volontairement simple** : vous n'aurez presque pas de code applicatif à écrire.
Tout l'effort porte sur ce qui entoure le code : images, environnement, pipeline, déploiement, exploitation.

| Partie | Technologie | Port | Rôle |
|---|---|---|---|
| `front/` | Vite + JavaScript sans framework ; en production, servi par **Nginx** | 5173 en dev, 80 dans le conteneur | L'interface web |
| `api/` | Node 20 + Express + `pg` (client PostgreSQL) | 3000 | L'API REST (*REST* : des URL qui représentent des ressources, manipulées avec GET, POST, PATCH, DELETE) |
| base | PostgreSQL 16 | 5432 | Une table `tasks` (créée automatiquement au démarrage de l'API) |

**Routes de l'API**

| Méthode et chemin | Rôle | Réponse |
|---|---|---|
| `GET /api/tasks` | Liste des tâches | 200 |
| `POST /api/tasks` avec `{ "title": "..." }` | Crée une tâche | 201 |
| `PATCH /api/tasks/:id/toggle` | Bascule « terminée / à faire » | 200 ou 404 |
| `DELETE /api/tasks/:id` | Supprime une tâche | 204 ou 404 |
| `GET /health` | État de l'API et de la base : `{"status":"ok","db":"up","version":"dev","env":"local"}` | 200, ou **503** si la base ne répond pas |

`/health` est la route clé de la semaine : elle sert aux healthchecks Docker, au smoke test du pipeline et à la supervision.

**Variables d'environnement de l'API** (valeurs par défaut dans `api/src/config.js`)

| Variable | Défaut | Rôle |
|---|---|---|
| `PORT` | `3000` | Port d'écoute |
| `DATABASE_URL` | `postgres://taskflow:taskflow@localhost:5432/taskflow` | Adresse de la base : `postgres://utilisateur:motdepasse@hôte:port/base` |
| `APP_ENV` | `local` | `local` ou `production` |
| `APP_VERSION` | `dev` | Version affichée par `/health` (le pipeline y mettra le « SHA court » du commit : les 7 premiers caractères de son identifiant, par exemple `a1b2c3d`) |

L'API écrit **une ligne JSON par requête** sur sa sortie standard (`method`, `path`, `status`, `ms`) : vous les lirez avec
`docker logs` et `docker compose logs`.

### Architecture visée en fin de semaine

```
                        Votre poste
  ┌──────────────────────────────────────────────────────────────────────────────┐
  │  DÉVELOPPEMENT (J3) : docker compose up, dans ~/taskflow                     │
  │    navigateur ─▶ http://localhost:8080 ─▶ front (Nginx) ─▶ api:3000 ─▶ db    │
  │                                                                              │
  │  « PRODUCTION » (J4) : stack taskflow-prod, dans ~/taskflow-prod             │
  │    navigateur ─▶ https://taskflow.localhost                                  │
  │        ─▶ proxy (Nginx, HTTPS, seul à publier des ports 80/443)              │
  │            ─▶ front:80 ─▶ api:3000 ─▶ db:5432 (volume pgdata)                │
  │                                                                              │
  │  runner GitHub Actions (conteneur) : reçoit le job deploy de GitHub et       │
  │  lance ./deploy.sh dans ~/taskflow-prod                                      │
  └──────────────────────────────────────────────────────────────────────────────┘
        ▲ images tirées de ghcr.io              ▲ jobs récupérés chez GitHub
        └──────────── GitHub : dépôt taskflow, ci.yml, release.yml ─────────────┘
```

Il n'y a **ni serveur distant ni SSH** dans le TP : votre poste joue le rôle du serveur. Les gestes (images versionnées,
`.env` hors Git, reverse proxy, HTTPS, sauvegardes) sont les mêmes qu'en production réelle.

---

## Mise en place de votre dépôt `taskflow` (jour 2, 15 min)

### 1. Copier le starter et créer le dépôt

Dans un terminal, placez-vous dans le dossier de la formation (votre clone du dépôt de cours), puis :

```bash
cp -r tp/fil-rouge-taskflow/starter ~/taskflow
cd ~/taskflow
git init -b main
git add .
git commit -m "chore: initialise TaskFlow"
gh repo create taskflow --public --source=. --push
```

> Sans `gh` : sur GitHub, **+** > *New repository*, nom `taskflow`, **Public**, ne cochez rien, *Create repository*, puis :
> ```bash
> git remote add origin git@github.com:<vous>/taskflow.git
> git push -u origin main
> ```

**Résultat attendu** :

```console
[main (root-commit) 0a1b2c3] chore: initialise TaskFlow
...
✓ Created repository <vous>/taskflow on GitHub
✓ Pushed commits to https://github.com/<vous>/taskflow.git
```

> **Si ça ne marche pas**
> - `git status` liste `node_modules/` ou `dist/` : le fichier `.gitignore` n'a pas été copié. Vérifiez avec `ls -a` ;
>   recopiez-le depuis `tp/fil-rouge-taskflow/starter/.gitignore`.
> - `Permission denied (publickey)` : votre clé SSH n'est pas sur GitHub (voir `ressources/setup-poste.md`, section 2).

### 2. Vérifier que le starter fonctionne sans Docker

```bash
cd ~/taskflow/api
npm ci
npm test
cd ../front
npm ci
npm test
cd ..
```

**Résultat attendu** (les durées varient) :

```console
 Test Files  3 passed | 1 skipped (4)
      Tests  27 passed | 10 skipped (37)
...
 Test Files  1 passed (1)
      Tests  7 passed (7)
```

Les 10 tests ignorés (*skipped*) sont les tests d'intégration : ils ont besoin d'une vraie base PostgreSQL et ne
s'exécutent que si `DATABASE_URL` est définie. Vous les activerez à l'étape 1, puis dans le pipeline à l'étape 3.

> **Si ça ne marche pas**
> - `npm: command not found` ou version de Node inférieure à 20 : `node -v`, puis `nvm use 20` (voir `setup-poste.md`).
> - `npm ci` se plaint du `package-lock.json` : vous n'êtes pas dans `api/` ou `front/`.

### 3. Protéger `main`

**Settings** > **Branches** > **Add classic branch protection rule** (ou *Add branch protection rule*) :

- *Branch name pattern* : `main`
- ☑ *Require a pull request before merging*
  - ☐ *Require approvals* : **décoché** pour l'instant (vous êtes seul ; votre binôme relira à partir de l'étape 2)
- ☑ *Do not allow bypassing the above settings*
- **Create**

Vérifiez :

```bash
git commit --allow-empty -m "test: push direct"
git push                       # doit être REFUSÉ (GH006: Protected branch update failed)
git reset --hard HEAD~1        # on annule ce commit de test, resté local
```

> **Pourquoi ?** À partir de maintenant, **tout** passe par une branche et une PR, même quand vous êtes seul : c'est ce
> qui permettra au pipeline (étape 3) de tester chaque changement avant qu'il arrive sur `main`.

> **Dépôt public et sécurité.** La protection de branche gratuite impose un dépôt public. Au jour 4, un runner installé
> sur votre poste exécutera des jobs de ce dépôt : réglez dès maintenant **Settings** > **Actions** > **General** >
> *Approval for running fork pull request workflows from contributors* sur **Require approval for all external
> contributors** (le libellé exact varie). Ainsi, la PR d'un inconnu ne peut pas lancer de workflow sans votre accord.
> Si vous avez le GitHub Student Developer Pack (offre gratuite pour les étudiants), un dépôt **privé** garde la
> protection de branche : c'est encore mieux.

### Je valide avec le formateur

- [ ] Mon dépôt `taskflow` existe sur GitHub et contient le starter (sans `node_modules/`).
- [ ] `npm test` passe dans `api/` et dans `front/`.
- [ ] Un push direct sur `main` est refusé.

---

## Les 5 étapes du fil rouge

| Étape | Quand | Durée | Énoncé | Branche conseillée | Ce que vous ajoutez au dépôt |
|---|---|---|---|---|---|
| 1 | J2 après-midi | 2h | [`etape1-docker.md`](etape1-docker.md) | `feature/docker` | `api/Dockerfile`, `api/.dockerignore`, `front/Dockerfile`, `front/.dockerignore`, `front/nginx.conf` |
| 2 | J3 matin | 1h40 | [`etape2-compose.md`](etape2-compose.md) | `feature/compose` | `compose.yaml`, `.env.example`, section « Démarrer avec Docker » du `README.md` |
| 3 | J3 après-midi | 1h30 | [`etape3-ci.md`](etape3-ci.md) | `feature/ci`, puis `feature/release` | `.github/workflows/ci.yml`, `.github/workflows/release.yml` (build et publication), badge |
| 4 | J4 matin et après-midi | 1h15 + 1h | [`etape4-deploiement.md`](etape4-deploiement.md) | `feature/prod`, puis `feature/deploy` | `compose.prod.yaml`, `.env.example` complet, `deploy/`, job `deploy` de `release.yml`, `docs/DEPLOIEMENT.md` |
| 5 | J4 fin d'après-midi | 25 min | [`etape5-incident.md`](etape5-incident.md) | `docs/incident` | `docs/INCIDENTS.md` (post-mortem) |

Chaque étape se termine par une checklist **« Je valide avec le formateur »** et par la PR à ouvrir.

**Conventions** (les mêmes qu'au TP 1) :

- une branche par étape, jamais de commit direct sur `main` ;
- messages de commit au format *Conventional Commits* : `feat:`, `fix:`, `docs:`, `ci:` (pipeline), `build:` (Docker),
  `chore:` (divers), `test:` ;
- une PR (*Pull Request*) par étape, avec une description qui dit **ce qui change** et **comment le vérifier**.

---

## Structure : `starter/` et `solution/`

```
fil-rouge-taskflow/
├── README.md                ← ce fichier
├── etape1-docker.md … etape5-incident.md   ← les énoncés
├── incident/                ← script et journaux de l'étape 5
├── starter/                 ← votre point de départ : le code SANS Docker, CI ni déploiement
│   ├── api/                 ← src/ (app.js, server.js, config.js, db.js, logger.js, repositories/), tests/
│   ├── front/               ← index.html, src/ (main.js, api.js, styles.css), tests/, vite.config.js
│   ├── .gitignore
│   └── README.md
└── solution/                ← le starter + tout ce que vous ajoutez pendant la semaine
    ├── api/Dockerfile, api/.dockerignore
    ├── front/Dockerfile, front/.dockerignore, front/nginx.conf
    ├── compose.yaml, compose.prod.yaml, .env.example
    ├── .github/workflows/ci.yml, .github/workflows/release.yml
    ├── .github/pull_request_template.md, .github/CODEOWNERS
    ├── deploy/nginx/taskflow.conf, deploy/gen-cert.sh, deploy/deploy.sh, deploy/backup.sh
    └── docs/ARCHITECTURE.md, docs/DEPLOIEMENT.md, docs/INCIDENTS.md
```

Le **runner** GitHub Actions du jour 4 n'est pas dans votre dépôt : il est fourni dans
[`../../ressources/lab/runner/`](../../ressources/lab/runner/README.md).

---

## Vous êtes en retard ? Récupérer un fichier de la solution

Le but est d'avancer **et** de comprendre. Si vous êtes bloqué plus de 15 minutes sur un fichier :

1. Définissez une fois par terminal le chemin du dossier de la formation (adaptez-le) :

   ```bash
   export FORMATION=~/formation-dwwm-devops
   ls "$FORMATION/tp/fil-rouge-taskflow/solution"      # doit lister api, front, compose.yaml...
   ```

2. Copiez **seulement** le fichier qui vous bloque, depuis votre dépôt :

   ```bash
   cd ~/taskflow
   cp "$FORMATION/tp/fil-rouge-taskflow/solution/api/Dockerfile" api/Dockerfile
   ```

3. **Lisez-le ligne par ligne** (chaque fichier de la solution est commenté) et comparez avec le vôtre :
   `git diff api/Dockerfile`.
4. Commitez en le disant honnêtement : `git commit -m "build: reprend api/Dockerfile de la solution"`.

| Étape | Fichiers à récupérer si besoin |
|---|---|
| 1 | `api/Dockerfile`, `api/.dockerignore`, `front/Dockerfile`, `front/.dockerignore`, `front/nginx.conf` |
| 2 | `compose.yaml` |
| 3 | `.github/workflows/ci.yml`, `.github/workflows/release.yml` (à n'utiliser **qu'en entier** à l'étape 4 : il contient déjà le job `deploy`) |
| 4 | `compose.prod.yaml`, `.env.example`, `deploy/` (tout le dossier : `cp -r`), `docs/DEPLOIEMENT.md` |
| 5 | Le modèle de post-mortem est dans l'énoncé de l'étape 5 (le fichier `docs/INCIDENTS.md` de la solution contient un exemple rédigé : lisez-le **après** avoir écrit le vôtre) |

> Copier n'est pas tricher si vous comprenez ce que vous copiez : en entreprise, on part très souvent d'un fichier
> existant. Le formateur vous posera des questions sur chaque ligne lors de la validation.
