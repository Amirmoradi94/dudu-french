#!/usr/bin/env python3
"""
Gère les comptes du site (table « users » de tuteur_serveur.py).

À lancer À L'INTÉRIEUR du conteneur tuteur, pour parler à la même base que le
serveur (voir TUTEUR_DB_PATH dans docker-compose.yml) :

    docker compose exec tuteur python3 manage_users.py add sara 'un-bon-mot-de-passe'
    docker compose exec tuteur python3 manage_users.py list
    docker compose exec tuteur python3 manage_users.py remove sara
    docker compose exec tuteur python3 manage_users.py usage      # appels IA des 7 derniers jours
    docker compose exec tuteur python3 manage_users.py usage 30

En local (sans Docker), lancez-le simplement à côté de tuteur_serveur.py —
il utilisera le même TUTEUR_DB_PATH (ou ./dudu.db par défaut).
"""

import sys

import time

from tuteur_serveur import (
    DB_PATH,
    create_user,
    find_user_by_name,
    get_db,
    init_db,
    limits_text,
    usage_summary,
)


def cmd_add(args):
    if len(args) != 2:
        print("Usage : manage_users.py add <nom_utilisateur> <mot_de_passe>", file=sys.stderr)
        return 1
    username, password = args
    if find_user_by_name(username):
        print(f"✗ « {username} » existe déjà. Utilisez « remove » puis « add » pour changer le mot de passe.",
              file=sys.stderr)
        return 1
    if len(password) < 4:
        print("✗ Mot de passe trop court (4 caractères minimum).", file=sys.stderr)
        return 1
    create_user(username, password)
    print(f"✓ Compte créé pour « {username.strip().lower()} ».")
    return 0


def cmd_list(args):
    conn = get_db()
    try:
        rows = conn.execute("SELECT username, created_at FROM users ORDER BY created_at").fetchall()
    finally:
        conn.close()
    if not rows:
        print("Aucun compte pour l'instant.")
        return 0
    for row in rows:
        print(f"  {row['username']}")
    return 0


def cmd_remove(args):
    if len(args) != 1:
        print("Usage : manage_users.py remove <nom_utilisateur>", file=sys.stderr)
        return 1
    username = args[0]
    row = find_user_by_name(username)
    if not row:
        print(f"✗ « {username} » n'existe pas.", file=sys.stderr)
        return 1
    conn = get_db()
    try:
        # ON DELETE CASCADE efface aussi sa progression enregistrée.
        conn.execute("DELETE FROM users WHERE id = ?", (row["id"],))
        conn.commit()
    finally:
        conn.close()
    print(f"✓ Compte « {username.strip().lower()} » supprimé (et sa progression avec).")
    return 0


def cmd_usage(args):
    """Appels payants au modèle (table ai_usage), jour par jour, du plus récent au plus ancien."""
    try:
        days = int(args[0]) if args else 7
    except ValueError:
        print("Usage : manage_users.py usage [nombre_de_jours]", file=sys.stderr)
        return 1
    print(f"Plafond quotidien : {limits_text()} (jours en UTC)")
    print("  jour         réponses  recherches  personnes  — les plus actifs (réponses/recherches)")
    now = time.time()
    for i in range(max(1, days)):
        day = time.strftime("%Y-%m-%d", time.gmtime(now - i * 86400))
        u = usage_summary(day)
        line = f"  {day}  {u['tutor']:8d}  {u['lookup']:10d}  {u['people']:9d}"
        if u["top"]:
            line += "  — " + ", ".join(f"{n} {t}/{l}" for n, t, l in u["top"][:5])
        print(line)
    return 0


COMMANDS = {"add": cmd_add, "list": cmd_list, "remove": cmd_remove, "usage": cmd_usage}


def main():
    init_db()
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS:
        print(f"Base : {DB_PATH}")
        print("Usage :")
        print("  manage_users.py add <nom_utilisateur> <mot_de_passe>")
        print("  manage_users.py list")
        print("  manage_users.py remove <nom_utilisateur>")
        print("  manage_users.py usage [nombre_de_jours]")
        sys.exit(1)
    sys.exit(COMMANDS[sys.argv[1]](sys.argv[2:]))


if __name__ == "__main__":
    main()
