# Gestion des incidents

Quand quelque chose casse en production, on **répare d'abord**, puis on **comprend** et on
**écrit** ce qu'on a appris. Un post-mortem n'a pas pour but de trouver un coupable mais
d'éviter que l'incident se reproduise. Il est **sans blâme** : on parle de processus et de
systèmes, pas de personnes.

## Méthode de diagnostic

Du plus visible au plus profond :

1. **Symptôme** : que voit l'utilisateur ? (code HTTP, message, page blanche)
2. **Proxy** : `docker compose -f compose.prod.yaml logs --since 15m proxy front`
3. **Conteneurs** : `docker compose -f compose.prod.yaml ps` (qui est `unhealthy`, `restarting` ?)
4. **Logs du service suspect** : `docker compose -f compose.prod.yaml logs --since 15m api`
5. **Cause racine** : la configuration, le code, la base, les ressources ?
6. **Correction**, puis **vérification** (`/health`, `ps`).

## Modèle de post-mortem

Copiez ce modèle pour chaque incident.

```markdown
## AAAA-MM-JJ - Titre court de l'incident

**Gravité** : faible / moyenne / élevée
**Durée** : début hh:mm - fin hh:mm (durée totale)
**Auteur(s)** : ...

### Résumé
Deux ou trois phrases : ce qui s'est passé et quel impact pour les utilisateurs.

### Chronologie
- hh:mm - Déploiement / changement à l'origine de l'incident
- hh:mm - Premier signal (alerte, message d'un utilisateur...)
- hh:mm - Diagnostic : ce qu'on a regardé, ce qu'on a trouvé
- hh:mm - Correction appliquée
- hh:mm - Retour à la normale confirmé

### Cause racine
Le « pourquoi » technique. Poser la question « pourquoi ? » plusieurs fois de suite
(les « 5 pourquoi ») jusqu'à atteindre une cause qu'on peut corriger.

### Ce qui a bien fonctionné
- ...

### Ce qui a moins bien fonctionné
- ...

### Actions
| Action | Responsable | Échéance | Statut |
| --- | --- | --- | --- |
| ... | ... | ... | à faire |
```

---

## Exemple : 2025-01-15 - Erreur 502 après un déploiement

**Gravité** : élevée (l'application ne fonctionne plus)
**Durée** : 14:02 - 14:31 (29 minutes)
**Auteur(s)** : binôme TaskFlow

### Résumé

Après le merge d'une PR, le site affichait « 502 Bad Gateway ». L'application était
inaccessible pendant environ 30 minutes. La cause était un fichier `.env` du serveur où
la variable de connexion à la base s'appelait `DATABASE_URI` au lieu de `DATABASE_URL`.

### Chronologie

- 14:02 - Merge de la PR « ajout du mot de passe PostgreSQL ». Le `.env` du serveur est
  modifié à la main au même moment ; `DATABASE_URL` est renommée par erreur `DATABASE_URI`.
- 14:03 - Le déploiement automatique se termine ; le smoke test `/health` du job `deploy` échoue
  après ses tentatives et le job est rouge. Personne ne regarde l'onglet Actions.
- 14:10 - Un utilisateur signale : « le site ne marche plus, erreur 502 ».
- 14:12 - Symptôme : la page s'affiche mais la liste des tâches ne se charge pas ;
  `curl -k https://taskflow.localhost/health` renvoie `502 Bad Gateway`.
- 14:15 - Logs du `proxy` : il relaie simplement un 502 venu de plus loin. Logs du `front` :
  `connect() failed ... while connecting to upstream`, il n'arrive pas à joindre l'`api`.
- 14:18 - `docker compose ps` : `proxy` et `front` sont `Up`, mais `api` est en `Restarting` (jamais `healthy`).
  C'est elle le maillon cassé.
- 14:22 - `docker compose logs api` :
  ```json
  {"level":"fatal","message":"Démarrage impossible : connect ECONNREFUSED 127.0.0.1:5432","hint":"Vérifiez DATABASE_URL et que PostgreSQL est joignable"}
  ```
  L'API essaie `127.0.0.1:5432` : c'est la valeur **par défaut** du code, donc `DATABASE_URL`
  n'est pas définie dans le conteneur.
- 14:26 - `grep DATABASE .env` : `DATABASE_URI=postgres://taskflow:...@db:5432/taskflow`. Faute de frappe trouvée.
- 14:28 - Correction du nom dans `.env`, puis `./deploy.sh <tag>` pour recréer les conteneurs.
- 14:31 - `docker compose ps` : tout est `healthy`, `/health` répond `{"status":"ok","db":"up"}`.

### Cause racine

1. Le nom de la variable dans `.env` était faux (`DATABASE_URI`).
2. L'API a une valeur par défaut (`localhost`) : elle a démarré sans erreur de configuration
   explicite, puis a échoué à joindre une base **qui n'est pas sur localhost** dans Docker.
3. Le `.env` du serveur est modifié à la main, sans relecture ni validation.
4. L'échec du job `deploy` n'a alerté personne.

### Ce qui a bien fonctionné

- Les logs JSON de l'API ont donné l'indice décisif en une commande.
- Le smoke test du job `deploy` a rendu l'échec visible dans le pipeline (job rouge) au lieu
  d'un déploiement « réussi » mais cassé.
- Le diagnostic « du symptôme vers la cause » (Nginx → `ps` → logs API) était efficace.

### Ce qui a moins bien fonctionné

- 8 minutes avant que l'équipe réalise que le déploiement avait échoué.
- Aucune vérification que les variables obligatoires sont présentes.
- Modification manuelle du `.env` sans second regard.

### Actions

| Action | Responsable | Échéance | Statut |
| --- | --- | --- | --- |
| Faire échouer l'API au démarrage si `DATABASE_URL` est absente en production (plutôt que retomber sur localhost) | dev | prochaine PR | à faire |
| Activer les notifications GitHub Actions en cas d'échec du workflow `Release` | tous | demain | à faire |
| Ajouter dans `DEPLOIEMENT.md` une étape « comparer le `.env` avec `.env.example` » | dev | cette semaine | à faire |
| Mettre en place Uptime Kuma sur `/health` pour être alerté avant les utilisateurs | ops | semaine prochaine | à faire |

---

<!-- Ajoutez ici vos propres post-mortems, du plus récent au plus ancien. -->
