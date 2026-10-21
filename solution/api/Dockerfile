# ============================================================================
# Dockerfile de l'API TaskFlow
# Un Dockerfile = la "recette" pour fabriquer une image. Chaque instruction
# crée une couche (layer) qui est mise en cache par Docker.
# ============================================================================

# Image de base : Node 20 sur Alpine Linux (une distribution minuscule, ~50 Mo).
# On fixe la version majeure (20) pour que le build reste reproductible.
FROM node:20-alpine

# Dossier de travail dans l'image. Les commandes suivantes s'exécutent ici.
WORKDIR /app

# Variables d'environnement par défaut (surchargeables au lancement du conteneur).
ENV NODE_ENV=production

# --- Astuce de cache : on copie D'ABORD uniquement les fichiers de dépendances.
# Tant que package.json / package-lock.json ne changent pas, Docker réutilise la
# couche `npm ci` ci-dessous et ne réinstalle pas tout à chaque modification du code.
COPY package.json package-lock.json ./

# `npm ci` : installation stricte d'après le package-lock.json (reproductible).
# `--omit=dev` : on n'installe pas ESLint, Vitest... inutiles en production.
RUN npm ci --omit=dev

# Maintenant seulement, on copie le code source (ce qui change souvent).
COPY src ./src

# Version de l'application, affichée par /health. Le CI la fournit :
#   docker build --build-arg APP_VERSION=<sha court> ...
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION

# Sécurité : ne pas tourner en root. L'utilisateur "node" existe déjà dans l'image.
USER node

# EXPOSE est purement documentaire : l'API écoute sur 3000.
# (Pour publier un port, c'est `-p` ou `ports:` dans Compose.)
EXPOSE 3000

# HEALTHCHECK : Docker lance cette commande régulièrement. Si elle échoue
# plusieurs fois de suite, le conteneur passe à l'état "unhealthy".
# /health renvoie 503 si la base est injoignable -> wget échoue -> unhealthy.
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/health || exit 1

# Commande lancée au démarrage du conteneur (forme "exec" : pas de shell intermédiaire,
# donc le signal SIGTERM de `docker stop` arrive bien jusqu'à Node).
CMD ["node", "src/server.js"]
