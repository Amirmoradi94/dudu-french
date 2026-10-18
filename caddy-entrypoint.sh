#!/bin/sh
# Point d'entrée du conteneur Caddy : assemble les pages, puis lance Caddy.
#
# Les pages HTML du dépôt (montées dans /srv-src) ne contiennent pas le cours : à la place,
# des lignes  <!--@include content/units.html-->  . Ce script remplace chacune de ces lignes
# par le fichier nommé (lu sous /srv, où le dossier de contenu est monté en /srv/content)
# et écrit la page complète dans /srv, d'où Caddy la sert. Le navigateur reçoit donc une
# page entière, comme avant (et file_server garde ses ETag : les 304 continuent).
#
# Un fichier inclus qui manque arrête le conteneur avec un message clair (sinon la page
# s'afficherait vide, sans dire pourquoi).
#
# Le contenu change ? « docker compose restart caddy » réassemble (deploy.sh le fait toujours).
set -eu

SRC=/srv-src
OUT=/srv

[ -d "$OUT/content" ] || { echo "assemble: $OUT/content est absent — voir CONTENT_DIR dans .env / docker-compose.yml" >&2; exit 1; }

for f in "$SRC"/*.html; do
  name=$(basename "$f")
  awk -v root="$OUT" -v page="$name" '
    /^[ \t]*<!--@include [^ \t]+-->[ \t]*$/ {
      p = $0
      sub(/^[ \t]*<!--@include /, "", p)
      sub(/-->[ \t]*$/, "", p)
      file = root "/" p
      if (p ~ /\.\./ || system("test -f \"" file "\"") != 0) {
        printf "assemble: %s inclut %s, introuvable\n", page, file > "/dev/stderr"
        failed = 1
        exit 2
      }
      while ((getline line < file) > 0) print line
      close(file)
      next
    }
    { print }
  ' "$f" > "$OUT/$name.tmp" || { rm -f "$OUT/$name.tmp"; exit 1; }
  mv "$OUT/$name.tmp" "$OUT/$name"
done
echo "assemble: pages prêtes ($(ls "$SRC"/*.html | wc -l | tr -d ' ') fichiers)"

exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
