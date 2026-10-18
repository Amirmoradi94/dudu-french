#!/usr/bin/env bash
# Envoie la page, les médias et la configuration sur le VPS, puis (re)démarre les conteneurs.
#
#   ./deploy.sh user@203.0.113.10
#   ./deploy.sh user@203.0.113.10 --code-only     (sans réenvoyer les médias ; un NOUVEAU dossier, ex. voices/, exige un déploiement complet)
#
# Le dossier de contenu part à chaque fois (les deux modes) : content/ s'il existe, sinon
# l'unité d'exemple content.sample/. Ses médias (gros fichiers audio / images) sont les dossiers
# listés dans <contenu>/media.txt, un par ligne — envoyés seulement sans --code-only.
#
# Prérequis sur le VPS : Docker et le plugin compose, et une clé SSH qui marche.
# Les secrets (.env : clé d'API, SESSION_SECRET) sont créés UNE FOIS sur le
# serveur et ne sont jamais envoyés par ce script.
#
# Le dossier distant : /srv/dudu, ou REMOTE_DIR=… devant la commande, ou une ligne
# REMOTE_DIR="${REMOTE_DIR:-/srv/autre}" dans un fichier deploy.local (facultatif, privé, jamais versionné
# dans le dépôt public) à côté de ce script.

set -euo pipefail

TARGET="${1:-}"
MODE="${2:-}"
[[ -f deploy.local ]] && source ./deploy.local
REMOTE_DIR="${REMOTE_DIR:-/srv/dudu}"

if [[ -z "$TARGET" ]]; then
  echo "Usage : ./deploy.sh user@ip [--code-only]" >&2
  exit 1
fi

say() { printf '\n\033[1m» %s\033[0m\n' "$1"; }

say "Préparation du dossier distant $REMOTE_DIR"
ssh "$TARGET" "mkdir -p $REMOTE_DIR"

# sw.js (application hors ligne) part en copie « tamponnée » : version = empreinte du contenu,
# plus la liste des voix à mettre en cache. Le sw.js du dépôt n'est pas modifié.
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
./stamp-sw.sh "$STAGE/sw.js"

say "Envoi du code et de la configuration"
rsync -az \
  "$STAGE/sw.js" \
  login.html signup.html Unite1_Revision.html Ecoute.html Memoire.html plan.html test.html faibles.html carnet.html atelier.html lexique.js vocab.js sync.js mistakes.js \
  app.html lesson.js troupe.css troupe-classic.css troupe-widgets.css troupe-widgets.js nav.js cast.js classic-cast.js sfx.js places.js course.js unlock.js \
  tuteur_serveur.py manage_users.py Dockerfile docker-compose.yml Caddyfile caddy-entrypoint.sh \
  set-password.sh nginx-*.conf .env.example manifest.webmanifest icons \
  "$TARGET:$REMOTE_DIR/"

# docker-compose.override.yml (facultatif, jamais versionné dans le dépôt public) : montages des médias, etc.
if [[ -f docker-compose.override.yml ]]; then
  rsync -az docker-compose.override.yml "$TARGET:$REMOTE_DIR/"
fi

CONTENT="content"
[[ -d "$CONTENT" ]] || CONTENT="content.sample"
say "Envoi du contenu du cours ($CONTENT/)"
rsync -az --delete "$CONTENT/" "$TARGET:$REMOTE_DIR/$CONTENT/"

if [[ "$MODE" != "--code-only" ]]; then
  MEDIA=()
  [[ -d voices ]] && MEDIA+=(voices)   # les voix de La Troupe (facultatives : pas dans le dépôt public)
  if [[ -f "$CONTENT/media.txt" ]]; then
    while IFS= read -r d; do [[ -n "$d" && "$d" != \#* ]] && MEDIA+=("$d"); done < "$CONTENT/media.txt"
  fi
  if (( ${#MEDIA[@]} )); then
    say "Envoi des médias (${MEDIA[*]})"
    rsync -az --delete "${MEDIA[@]}" "$TARGET:$REMOTE_DIR/"
  fi
fi

say "Vérification des secrets sur le serveur"
MISSING=""
ssh "$TARGET" "test -f $REMOTE_DIR/.env" || MISSING="$MISSING .env"
if [[ -z "$MISSING" ]]; then
  ssh "$TARGET" "grep -q '^SESSION_SECRET=.' $REMOTE_DIR/.env" || MISSING="$MISSING SESSION_SECRET"
fi
if [[ -n "$MISSING" ]]; then
  cat >&2 <<EOF

  ⚠  Il manque sur le serveur :$MISSING
     À faire une seule fois :

       ssh $TARGET
       cd $REMOTE_DIR
       cp .env.example .env
       nano .env                                  # collez la clé OpenRouter
       chmod +x set-password.sh
       ./set-password.sh                          # écrit SESSION_SECRET

     Puis relancez ./deploy.sh, et créez les comptes avec
       docker compose exec tuteur python3 manage_users.py add <nom> '<mot-de-passe>'
     (ou mettez SIGNUP_INVITE_CODE dans .env pour l'inscription sur /signup).

EOF
  exit 1
fi

say "Construction et démarrage des conteneurs"
ssh "$TARGET" "cd $REMOTE_DIR && docker compose up -d --build"

# Docker bind-monte chaque fichier individuellement (docker-compose.yml), pas
# le dossier : le montage reste attaché à l'INODE présent au démarrage du
# conteneur. rsync remplace un fichier par un nouvel inode (écrit un fichier
# temporaire puis le renomme), donc un simple changement de page/HTML ne
# retraverse jamais dans le conteneur tant qu'il n'est pas relancé — même si
# `docker compose up` ne le juge pas nécessaire, faute de changement dans
# docker-compose.yml lui-même. On force donc un restart à chaque déploiement.
# (Un NOUVEAU fichier monté — comme sw.js — change docker-compose.yml : « up -d » ci-dessus
# RECRÉE alors le conteneur caddy, ce qu'un simple restart ne ferait pas.)
say "Redémarrage de Caddy (relit les fichiers montés depuis le disque)"
ssh "$TARGET" "cd $REMOTE_DIR && docker compose restart caddy"

say "État des services"
ssh "$TARGET" "cd $REMOTE_DIR && docker compose ps"

say "Test de santé du tuteur"
ssh "$TARGET" "cd $REMOTE_DIR && docker compose exec -T tuteur python3 -c \
  \"import urllib.request,json;print(json.load(urllib.request.urlopen('http://127.0.0.1:8765/health')))\"" \
  || echo "  (le conteneur démarre peut-être encore — réessayez dans quelques secondes)"

say "Terminé"
