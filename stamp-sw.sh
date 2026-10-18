#!/usr/bin/env bash
# Écrit une copie de sw.js prête à déployer, avec :
#   VERSION = empreinte du contenu de l'application (pages, *.js, *.css, icônes, dossier de contenu, liste des voix) —
#             elle ne change que si un fichier a changé, et alors chaque téléphone retélécharge l'application ;
#   VOICES  = toutes les voix de La Troupe (voices/v2/*.mp3), mises en cache dès l'installation.
# Le sw.js du dépôt garde 'dev' et [] (il marche tel quel en local).
#
#   ./stamp-sw.sh /chemin/vers/sw.js      (appelé par deploy.sh)
set -euo pipefail
cd "$(dirname "$0")"
OUT="${1:?Usage : ./stamp-sw.sh <fichier de sortie>}"

shopt -s nullglob
voices=(voices/v2/*.mp3)
CONTENT="content"; [[ -d "$CONTENT" ]] || CONTENT="content.sample"   # le même choix que deploy.sh
VERSION=$( { cat ./*.html ./*.js ./*.css manifest.webmanifest icons/v4/*; find "$CONTENT" -type f | LC_ALL=C sort | xargs cat; printf '%s\n' "${voices[@]}"; } | shasum -a 256 | cut -c1-12)
ARR="["
for v in "${voices[@]}"; do ARR+="'/$v',"; done
ARR="${ARR%,}]"

awk -v ver="$VERSION" -v voices="$ARR" '
  /^const VERSION = / { print "const VERSION = \047" ver "\047;"; n++; next }
  /^const VOICES = /  { print "const VOICES = " voices ";"; n++; next }
  { print }
  END { if (n != 2) exit 1 }
' sw.js > "$OUT" || { echo "stamp-sw.sh : VERSION / VOICES introuvables dans sw.js" >&2; exit 1; }
echo "sw.js : version $VERSION, ${#voices[@]} voix" >&2
