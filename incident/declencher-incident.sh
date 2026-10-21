#!/usr/bin/env bash
# ============================================================================
# declencher-incident.sh : provoque l'incident de l'étape 5 sur la stack
# « taskflow-prod » (dossier de déploiement $DEPLOY_DIR, ~/taskflow-prod par défaut).
#
# Apprenant : lancez-le SANS le lire (sinon, plus de suspense) :
#     bash declencher-incident.sh
#
# Formateur : l'opération est réversible.
#   - ce que fait le script : renomme une variable du fichier .env du dossier de
#     déploiement (copie d'origine gardée dans .env.bak, mêmes droits), puis recrée
#     le seul conteneur « api » avec la version actuellement déployée ;
#   - pour tout remettre en état :  bash declencher-incident.sh --restaurer
#   - autre dossier de déploiement : DEPLOY_DIR=/chemin/absolu bash declencher-incident.sh
# Le détail (cause, logs attendus, correction) est dans solution-formateur.md.
# ============================================================================
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-$HOME/taskflow-prod}"
COMPOSE_FILE="compose.prod.yaml"
ENV_FILE="$DEPLOY_DIR/.env"
BACKUP_FILE="$DEPLOY_DIR/.env.bak"

die() {
  echo "Erreur : $*" >&2
  exit 1
}

usage() {
  echo "Usage : bash $0              # déclencher l'incident"
  echo "        bash $0 --restaurer  # remettre la configuration d'origine (formateur)"
}

# Recrée uniquement le conteneur « api », avec le tag actuellement en ligne
# (noté par deploy.sh dans .deployed_tag), sans toucher à la base ni au proxy.
recreate_api() {
  local tag="latest"
  if [ -s "$DEPLOY_DIR/.deployed_tag" ]; then
    tag="$(cat "$DEPLOY_DIR/.deployed_tag")"
  fi
  (
    cd "$DEPLOY_DIR"
    IMAGE_TAG="$tag" docker compose -f "$COMPOSE_FILE" up -d --no-deps --force-recreate api
  )
}

trigger() {
  if grep -q '^DATABASE_UR=' "$ENV_FILE"; then
    die "l'incident est déjà déclenché (pour revenir en arrière : bash $0 --restaurer)"
  fi
  grep -q '^DATABASE_URL=' "$ENV_FILE" \
    || die "$ENV_FILE ne contient pas la variable attendue : la partie A de l'étape 4 est-elle terminée ?"

  # Copie d'origine, avec les mêmes droits (chmod 600)
  cp -p "$ENV_FILE" "$BACKUP_FILE"
  # Écriture « en place » (redirection vers le fichier existant) : les droits de .env sont conservés
  sed 's/^DATABASE_URL=/DATABASE_UR=/' "$BACKUP_FILE" > "$ENV_FILE"

  recreate_api
  echo
  echo "==> Un « déploiement » vient d'avoir lieu. Attendez 30 secondes, puis ouvrez"
  echo "    https://taskflow.localhost (ou votre port HTTPS) et suivez l'énoncé de l'étape 5."
}

restore() {
  [ -f "$BACKUP_FILE" ] || die "aucune sauvegarde $BACKUP_FILE : rien à restaurer"
  cat "$BACKUP_FILE" > "$ENV_FILE"
  rm -f "$BACKUP_FILE"
  recreate_api
  echo
  echo "==> Configuration d'origine restaurée et api recréée."
  echo "    Vérifiez : docker compose -f $COMPOSE_FILE ps (dans $DEPLOY_DIR)"
}

[ -f "$DEPLOY_DIR/$COMPOSE_FILE" ] \
  || die "$DEPLOY_DIR/$COMPOSE_FILE introuvable. Précisez le dossier : DEPLOY_DIR=/chemin/absolu bash $0"
[ -f "$ENV_FILE" ] || die "$ENV_FILE introuvable : la partie A de l'étape 4 est-elle terminée ?"
command -v docker >/dev/null 2>&1 || die "la commande docker est introuvable"

case "${1:-}" in
  "") trigger ;;
  --restaurer) restore ;;
  -h | --help) usage ;;
  *)
    usage >&2
    exit 1
    ;;
esac
