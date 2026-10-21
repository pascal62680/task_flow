# Procédure de déploiement

La « production » de ce projet est une stack Compose **séparée** (`name: taskflow-prod`),
dans un dossier dédié de votre poste : `~/taskflow-prod/`, le **dossier de déploiement**
(variable `DEPLOY_DIR`). Il joue le rôle du serveur.

## Prérequis

- Docker et le plugin Compose, `openssl`.
- Les images publiées sur ghcr.io (job `build` de `release.yml`).
- Un jeton GitHub (PAT) avec le droit `read:packages` si les images sont privées.
- Les ports 80 et 443 libres, sinon choisir `HTTP_PORT` / `HTTPS_PORT` dans `.env` (ex. 8081 / 8443).

## A. Déploiement manuel (première mise en place)

À faire une fois ; chaque geste sera ensuite automatisé par `release.yml`.

1. **Créer le dossier de déploiement** :
   ```bash
   mkdir -p ~/taskflow-prod/nginx && cd ~/taskflow-prod
   ```
2. **Copier les fichiers** depuis votre clone du dépôt :
   ```bash
   REPO=~/dev/taskflow      # adaptez
   cp $REPO/compose.prod.yaml .
   cp $REPO/deploy/nginx/taskflow.conf nginx/
   cp $REPO/deploy/*.sh .
   chmod +x *.sh
   ```
3. **Créer le `.env`** (jamais dans Git) :
   ```bash
   cp $REPO/.env.example .env
   nano .env            # mot de passe, DATABASE_URL, GHCR_OWNER (minuscules !), ports
   chmod 600 .env
   ```
4. **Générer le certificat auto-signé** : `./gen-cert.sh` (crée `certs/taskflow.crt` et `.key`).
5. **Se connecter au registre** :
   ```bash
   echo "$TOKEN" | docker login ghcr.io -u <votre-compte> --password-stdin
   ```
6. **Lancer** : `./deploy.sh <tag>` (SHA court d'un commit publié, ou `latest`).
7. **Vérifier** :
   ```bash
   docker compose -f compose.prod.yaml ps               # tout doit être "healthy"
   curl -fsk https://localhost:${HTTPS_PORT:-443}/health
   curl -sI http://localhost:${HTTP_PORT:-80}/          # 301 vers https
   ```
   Dans un navigateur : `https://taskflow.localhost` (`*.localhost` pointe vers votre machine ;
   acceptez l'avertissement du certificat auto-signé).
8. **Tester la sauvegarde ET la restauration** (voir plus bas).

## B. Déploiement automatique

Un merge sur `main` déclenche `.github/workflows/release.yml` :

1. `build` construit les images et les publie : `taskflow-api:<sha>` / `:latest` (idem front).
2. `deploy` (runner `[self-hosted, lab]`) copie `compose.prod.yaml`, `nginx/` et les scripts
   vers `$DEPLOY_DIR` (jamais `.env` ni `certs/`), fait `docker login ghcr.io`, puis
   `./deploy.sh <sha>`.
3. Un **smoke test** appelle `https://host.docker.internal:${HTTPS_PORT}/health` avec jusqu'à
   10 nouveaux essais. S'il échoue, le job est rouge.

Configuration nécessaire une fois :

| Élément | Où | Contenu |
| --- | --- | --- |
| Runner self-hosted | `ressources/lab/runner` | Labels `self-hosted`, `lab`, variable `DEPLOY_DIR` |
| Environment `production` | GitHub : Settings > Environments | (Optionnel) approbation manuelle avant déploiement |
| Variable `HTTPS_PORT` | GitHub : Settings > Variables | Seulement si différent de 443 |
| Dossier de déploiement prêt | poste | `.env` et `certs/` créés à la main (étape A) |

## C. Rollback (retour à la version précédente)

Une version cassée est en ligne : on revient à la précédente **sans rien reconstruire**.

1. Trouver le tag de la dernière version saine : un ancien run vert de *Release* dans l'onglet
   Actions, `cat ~/taskflow-prod/.deployed_tag` (version actuelle), ou l'historique des paquets GitHub.
2. **Actions > Release > Run workflow**, saisir le champ **tag** (ex. `a1b2c3d`).
3. Le job `build` est sauté, `deploy` redéploie ce tag et le smoke test valide.

Alternative directe : `cd ~/taskflow-prod && ./deploy.sh a1b2c3d`.

> **Attention aux données.** Le rollback ne revient que sur le **code**. Si la version
> cassée a modifié la base, il faut aussi restaurer une sauvegarde.

## D. Sauvegarde et restauration

- Sauvegarder : `./backup.sh` (fichier `backups/taskflow-<date>.sql.gz`, 7 jours conservés).
- Planifier : voir l'entête de `backup.sh` (cron quotidien).
- Restaurer :
  ```bash
  cd ~/taskflow-prod
  gunzip -c backups/taskflow-XXXX.sql.gz | \
    docker compose -f compose.prod.yaml exec -T db psql -U taskflow -d taskflow
  ```
- Une sauvegarde qu'on n'a jamais restaurée n'est pas une sauvegarde : testez-la.

## E. Check-list de mise en production

- [ ] `.env` présent dans le dossier de déploiement, `chmod 600`, absent de Git
- [ ] `GHCR_OWNER` en minuscules
- [ ] `certs/` et `backups/` ignorés par Git
- [ ] `docker compose -f compose.prod.yaml ps` : tous les services `healthy`
- [ ] `curl -fsk https://<domaine>/health` répond `"status":"ok"` ; HTTP redirige bien vers HTTPS
- [ ] Une sauvegarde existe **et** a été restaurée au moins une fois
- [ ] Le tag actuellement en ligne est noté (`.deployed_tag`)

## F. Sur un vrai serveur (à titre informatif)

Ce lab simule un serveur sur votre poste. Avec un vrai VPS, la logique est identique mais
quelques éléments changent :

| Sujet | Dans le lab | Sur un vrai serveur |
| --- | --- | --- |
| Où tourne le déploiement | runner self-hosted sur le poste, avec accès au Docker local | job sur `ubuntu-latest` qui **se connecte en SSH** au serveur |
| Authentification | socket Docker monté | **clé SSH** dédiée : clé privée dans un secret (`SSH_PRIVATE_KEY`), clé publique dans `~/.ssh/authorized_keys` du serveur |
| Reverse proxy | conteneur `proxy` (Nginx) | Nginx **installé par `apt`** sur le serveur (`proxy_pass http://127.0.0.1:8080`), le front publié seulement sur `127.0.0.1:8080` |
| Certificat | auto-signé (`gen-cert.sh`) | **Let's Encrypt** via `certbot --nginx -d votre-domaine.fr`, renouvelé automatiquement |
| Nom de domaine | `taskflow.localhost` | enregistrement DNS `A` vers l'IP du serveur |

Le job de déploiement ressemblerait à ceci (esquisse, non utilisée dans le lab) :

```yaml
deploy:
  needs: build
  runs-on: ubuntu-latest
  environment: production
  steps:
    - uses: actions/checkout@v4
    - name: Préparer SSH
      run: |
        install -m 700 -d ~/.ssh
        printf '%s\n' "${{ secrets.SSH_PRIVATE_KEY }}" > ~/.ssh/id_deploy
        chmod 600 ~/.ssh/id_deploy
        ssh-keyscan -H "${{ vars.SERVER_HOST }}" >> ~/.ssh/known_hosts
    - name: Copier les fichiers et déployer
      run: |
        scp -i ~/.ssh/id_deploy compose.prod.yaml deploy/*.sh deploy@${{ vars.SERVER_HOST }}:/opt/taskflow/
        ssh -i ~/.ssh/id_deploy deploy@${{ vars.SERVER_HOST }} "cd /opt/taskflow && ./deploy.sh ${{ needs.build.outputs.tag }}"
    - name: Smoke test
      run: curl -fs --retry 10 --retry-all-errors --retry-delay 3 https://${{ vars.SERVER_HOST }}/health
```

Avantage : aucun runner à héberger. Contrepartie : le serveur doit être joignable depuis Internet
en SSH (à protéger : clés uniquement, pas de mot de passe, pare-feu, `fail2ban`).
