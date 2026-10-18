#!/usr/bin/env bash
# Génère SESSION_SECRET (qui signe les cookies de session) et l'écrit dans
# .env. À lancer UNE SEULE FOIS, la première fois que le serveur est mis en
# place. Les comptes eux-mêmes (un par personne) se créent séparément avec
# manage_users.py — voir ce fichier.
#   ./set-password.sh
set -euo pipefail

if [[ ! -f .env ]]; then
  echo "Il manque .env — copiez d'abord .env.example : cp .env.example .env" >&2
  exit 1
fi

python3 - <<'PYEOF'
import re
import secrets

secret = secrets.token_hex(32)


def upsert(path, key, value):
    with open(path) as f:
        lines = f.readlines()
    pattern = re.compile(rf"^{re.escape(key)}=")
    lines = [line for line in lines if not pattern.match(line)]
    lines.append(f"{key}={value}\n")
    with open(path, "w") as f:
        f.writelines(lines)


upsert(".env", "SESSION_SECRET", secret)
print("✓ .env mis à jour : SESSION_SECRET.")
print("  (Ceci invalide les sessions déjà ouvertes — tout le monde devra se reconnecter.)")
PYEOF

chmod 600 .env
echo "  Puis créez un compte par personne :"
echo "    docker compose up -d --build tuteur"
echo "    docker compose exec tuteur python3 manage_users.py add <nom> '<mot-de-passe>'"
