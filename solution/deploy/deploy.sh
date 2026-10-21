#!/usr/bin/env bash
# ============================================================================
# deploy.sh : met à jour la "prod" TaskFlow vers une version donnée.
#
# Placé dans le dossier de déploiement (~/taskflow-prod, avec compose.prod.yaml
# et .env). À lancer DEPUIS ce dossier, ou en précisant DEPLOY_DIR :
#     ./deploy.sh <tag>
#     <tag> = SHA court du commit (ex: a1b2c3d) ou "latest".
# Rollback : relancer avec le tag d'une version précédente.
# ============================================================================

# Mode "strict" : arrêt à la première erreur (-e), variables non définies interdites
# (-u), erreurs détectées au milieu d'un pipe (pipefail).
set -euo pipefail

# Premier argument obligatoire ; le message après ":?" s'affiche s'il manque.
TAG="${1:?Usage: ./deploy.sh <tag>  (ex: ./deploy.sh a1b2c3d)}"

# Dossier contenant compose.prod.yaml et .env (par défaut : le dossier du script)
DEPLOY_DIR="${DEPLOY_DIR:-$(cd "$(dirname "$0")" && pwd)}"
cd "$DEPLOY_DIR"

# Raccourci : la commande compose complète. IMAGE_TAG est lu par compose.prod.yaml.
compose() {
  IMAGE_TAG="$TAG" docker compose -f compose.prod.yaml "$@"
}

echo "==> Déploiement de la version : $TAG (dans $DEPLOY_DIR)"

echo "==> Téléchargement des images (pull)"
compose pull

# `up -d` ne recrée que les conteneurs dont l'image ou la configuration a changé.
echo "==> Redémarrage des services"
compose up -d --remove-orphans

# Le proxy a mémorisé l'adresse IP du front au démarrage : si le front vient d'être
# recréé, elle a pu changer. Un rechargement (sans coupure) la lui fait redécouvrir.
# On réessaie quelques fois : le front peut mettre un instant à être joignable.
echo "==> Rechargement du proxy"
for attempt in 1 2 3 4 5 6 7 8 9 10; do
  if compose exec -T proxy nginx -s reload; then break; fi
  if [ "$attempt" = 10 ]; then echo "Rechargement du proxy impossible" >&2; exit 1; fi
  sleep 3
done

echo "==> État des services"
compose ps

# Mémorise la version en ligne (utile pour savoir à quoi revenir en cas de souci)
echo "$TAG" > .deployed_tag

# Supprime les images devenues inutiles pour ne pas remplir le disque.
echo "==> Nettoyage des images inutilisées"
docker image prune -f

echo "==> Déploiement terminé : $TAG"
