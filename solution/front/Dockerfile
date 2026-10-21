# ============================================================================
# Dockerfile du front TaskFlow - build "multi-stage" (en plusieurs étapes)
#
# Étape 1 (build) : Node compile le site (Vite -> fichiers statiques HTML/JS/CSS).
# Étape 2 (final) : Nginx sert ces fichiers. Node n'est PAS dans l'image finale :
#                   elle est ainsi minuscule (~50 Mo) et expose peu de surface d'attaque.
# ============================================================================

# ---------- Étape 1 : construire le site ------------------------------------
# "AS build" donne un nom à cette étape pour pouvoir y faire référence plus bas.
FROM node:20-alpine AS build
WORKDIR /app

# Même astuce de cache que pour l'API : les dépendances d'abord, le code ensuite.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Produit le dossier /app/dist (le site compilé)
RUN npm run build

# ---------- Étape 2 : servir le site avec Nginx -----------------------------
FROM nginx:1.27-alpine

# L'image Nginx remplace les variables ${...} des fichiers placés dans
# /etc/nginx/templates/*.template et génère /etc/nginx/conf.d/default.conf.
# On l'utilise pour récupérer automatiquement l'adresse du DNS (voir nginx.conf).
ENV NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1
COPY nginx.conf /etc/nginx/templates/default.conf.template

# On ne copie QUE le résultat du build depuis l'étape 1.
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

# Vérifie que Nginx répond (la page d'accueil, sans dépendre de l'API).
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1

# Pas de CMD : l'image Nginx a déjà le bon (nginx -g 'daemon off;').
