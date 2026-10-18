# Tuteur de français — petite API, une seule dépendance (le SDK anthropic).
# Bibliothèque standard de Python (urllib) pour OpenRouter ; le SDK anthropic
# pour Claude.
FROM python:3.12-alpine

ENV PYTHONUNBUFFERED=1 \
    TUTEUR_HOST=0.0.0.0 \
    TUTEUR_PORT=8765

ENV TUTEUR_DB_PATH=/app/data/dudu.db

WORKDIR /app
# Seule dépendance : le SDK officiel d'Anthropic (réponses texte par Claude).
RUN pip install --no-cache-dir "anthropic>=1.13,<2"
COPY tuteur_serveur.py /app/tuteur_serveur.py
COPY manage_users.py /app/manage_users.py

# On ne tourne pas en root. /app/data accueille la base SQLite (comptes +
# progression) — montée sur un volume Docker nommé pour survivre à un rebuild.
RUN adduser -D -H tuteur && mkdir -p /app/data && chown tuteur:tuteur /app/data
USER tuteur

EXPOSE 8765

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD python3 -c "import urllib.request,sys; \
      sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8765/health',timeout=4).status==200 else 1)"

CMD ["python3", "/app/tuteur_serveur.py"]
