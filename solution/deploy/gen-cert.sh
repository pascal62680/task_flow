#!/usr/bin/env bash
# ============================================================================
# gen-cert.sh : génère un certificat HTTPS AUTO-SIGNÉ pour taskflow.localhost.
#
# Un certificat prouve l'identité d'un site. Normalement il est signé par une autorité
# reconnue (Let's Encrypt...). Ici on se signe soi-même : le chiffrement fonctionne,
# mais le navigateur affichera un avertissement (c'est normal en lab, d'où `curl -k`).
#
# Utilisation (dans le dossier de déploiement) :   ./gen-cert.sh
# Résultat :   certs/taskflow.crt (public)  et  certs/taskflow.key (PRIVÉ, chmod 600)
# Le dossier certs/ est ignoré par Git : ne commitez jamais une clé privée.
# ============================================================================
set -euo pipefail

CERT_DIR="${CERT_DIR:-certs}"
DOMAIN="${DOMAIN:-taskflow.localhost}"
DAYS="${DAYS:-365}"

if ! command -v openssl >/dev/null 2>&1; then
  echo "Erreur : openssl n'est pas installé (Debian/Ubuntu : sudo apt install openssl)" >&2
  exit 1
fi

mkdir -p "$CERT_DIR"

# -x509 : produit directement un certificat auto-signé (pas de demande à une autorité)
# -nodes : clé privée non chiffrée par mot de passe (Nginx doit pouvoir la lire seul)
# subjectAltName : les navigateurs modernes ignorent le CN et lisent cette liste de noms
openssl req -x509 -nodes -newkey rsa:2048 -days "$DAYS" \
  -keyout "$CERT_DIR/taskflow.key" \
  -out "$CERT_DIR/taskflow.crt" \
  -subj "/CN=$DOMAIN" \
  -addext "subjectAltName=DNS:$DOMAIN,DNS:localhost,IP:127.0.0.1,DNS:host.docker.internal"

# La clé doit être lisible par le conteneur Nginx (qui peut tourner avec un autre
# utilisateur que vous), mais pas modifiable. 644 convient dans le lab ; sur un vrai
# serveur, on restreindrait davantage.
chmod 644 "$CERT_DIR/taskflow.key" "$CERT_DIR/taskflow.crt"

echo "Certificat créé dans $CERT_DIR/ (valable $DAYS jours, pour $DOMAIN)"
