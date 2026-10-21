#!/usr/bin/env bash
# ============================================================================
# backup.sh : sauvegarde la base PostgreSQL de TaskFlow avec pg_dump.
#
# Produit un fichier horodaté et compressé : backups/taskflow-AAAAMMJJ-HHMMSS.sql.gz
# et supprime les sauvegardes de plus de 7 jours (rotation).
#
# Utilisation manuelle (depuis le dossier de déploiement) :  ./backup.sh
# Planification (cron, chaque nuit à 3h) :  crontab -e  puis ajouter
#     0 3 * * * ~/taskflow-prod/backup.sh >> ~/taskflow-prod/backups/backup.log 2>&1
#
# RESTAURATION (à tester AVANT d'en avoir besoin !) :
#     gunzip -c backups/taskflow-XXXX.sql.gz | \
#       docker compose -f compose.prod.yaml exec -T db psql -U taskflow -d taskflow
# ============================================================================
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-$(cd "$(dirname "$0")" && pwd)}"
BACKUP_DIR="${BACKUP_DIR:-$DEPLOY_DIR/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

cd "$DEPLOY_DIR"
mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
FINAL_FILE="$BACKUP_DIR/taskflow-$TIMESTAMP.sql.gz"
TEMP_FILE="$FINAL_FILE.partial"

# En cas d'échec, on supprime le fichier incomplet (sinon on le prendrait pour une
# vraie sauvegarde). `trap ... EXIT` s'exécute toujours à la fin du script.
trap 'rm -f "$TEMP_FILE"' EXIT

echo "==> Sauvegarde vers $FINAL_FILE"
# -T : pas de terminal (indispensable dans un script ou un cron)
docker compose -f compose.prod.yaml exec -T db \
  pg_dump -U taskflow -d taskflow --clean --if-exists \
  | gzip > "$TEMP_FILE"

# Un dump vide est une sauvegarde ratée : on refuse de le garder.
if [ ! -s "$TEMP_FILE" ]; then
  echo "Erreur : la sauvegarde est vide" >&2
  exit 1
fi

# Le fichier n'a son vrai nom qu'une fois complet et valide
mv "$TEMP_FILE" "$FINAL_FILE"

echo "==> Rotation : suppression des sauvegardes de plus de $RETENTION_DAYS jours"
find "$BACKUP_DIR" -name 'taskflow-*.sql.gz' -mtime "+$RETENTION_DAYS" -print -delete

echo "==> Terminé : $(ls -1 "$BACKUP_DIR"/taskflow-*.sql.gz | wc -l) sauvegarde(s) conservée(s)"
