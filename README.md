# DuDu — learn French, one small step at a time

A small, self-hosted, Duolingo-style revision app for beginner (CEFR A1) French learners. It was built to revise a real
evening class. The interface is in French, and every French sentence has an English translation one tap away.

**This repository is the engine only.** It ships with one short original sample unit ("Au café"). No textbook content is
included. You plug in your own course as a content folder (see [Your own content](#your-own-content)).

## What it does

- **A learning path** (`/`): units → steps, unlocked one after the other, with a daily plan (`/plan`) that picks what to do
  today and for how long.
- **Lessons** in two modes: a full page per unit (documents, grammar, vocabulary, phonetics, workbook-style exercises)
  and a step-by-step lesson player (`?mode=lesson`): one question per screen, instant feedback.
- **Exercise types**: fill-in-the-blank with accepted variants, multiple choice, matching, dictation (read by the browser's
  French voice), speaking drills with word tiles (browser speech recognition), free speaking, and role-play conversations
  with an AI tutor.
- **AI tutor** (OpenRouter, optionally Claude): explains any selected text, answers questions, corrects writing
  (`/atelier`), grades the writing and speaking parts of end-of-unit tests (`/test`), and gives pronunciation feedback.
- **Spaced-repetition vocabulary cards** (`/memoire`), a notebook of rules and verb tables with a conjugation drill
  (`/carnet`), a "weak points" page built from your mistakes (`/faibles`), and a listening page (`/ecoute`).
- **Accounts and sync**: one account per learner (SQLite), progress synced across devices, invite-code or open sign-up,
  per-person and site-wide daily caps on paid AI calls.
- Installable as a phone app (web manifest, home-screen guide).

## Run it locally

You need Docker with the compose plugin, and an [OpenRouter](https://openrouter.ai/keys) API key.

```bash
git clone <this repo> french-class && cd french-class
cp .env.example .env
```

Edit `.env`:

- `OPENROUTER_API_KEY=` your key (required: the tutor, grading and speaking feedback use it).
- uncomment `TUTEUR_COOKIE_SECURE=0` (needed on plain `http://localhost`).

Then:

```bash
./set-password.sh
docker compose up -d --build
docker compose exec tuteur python3 manage_users.py add me 'a-good-password'
```

Open <http://localhost:8080>, sign in, and you're on the sample unit's path.

`set-password.sh` writes `SESSION_SECRET` (it signs session cookies) into `.env`. Everything the app needs is in `.env`.
`.env` is git-ignored, so keep your keys there and never in a tracked file.

### AI keys and costs

| Variable | Needed? | What for |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | required | All AI features. Model in `TUTEUR_MODEL` (default in `.env.example`: a cheap Gemini Flash-Lite). Audio models: `TUTEUR_VOICE_MODEL`, `TUTEUR_DRILL_MODEL`. |
| `ANTHROPIC_API_KEY` | optional | With it, text answers go through Claude (`TUTEUR_CLAUDE_MODEL`). Audio stays on OpenRouter. |
| `TUTEUR_DAILY_AI_CALLS`, `TUTEUR_DAILY_AI_CALLS_TOTAL` | optional | Daily caps per person and site-wide (they bound the bill). `0` = no limit. |
| `TUTEUR_DAILY_LOOKUPS`, `TUTEUR_DAILY_LOOKUPS_TOTAL` | optional | The same caps for the small word-translation calls. |

`docker compose exec tuteur python3 manage_users.py usage` shows the daily totals and the top users.

### Accounts

- `manage_users.py add <name> <password>`, `list`, `remove <name>`.
- Or let people sign up on `/signup`: set `SIGNUP_INVITE_CODE` (they need the code), or `SIGNUP_OPEN=1` (anyone can sign up).

## How it fits together

```
browser ──► Caddy (127.0.0.1:8080) ──► static pages, JS, CSS, media     (behind a session cookie)
                    │
                    └── /api/* ──► tuteur_serveur.py (Python stdlib + anthropic SDK)
                                     ├── accounts, sessions, synced progress (SQLite volume)
                                     └── OpenRouter / Claude
```

- **Pages**: `app.html` (path), `Unite1_Revision.html` (the unit page and lesson player, with `lesson.js`), `plan.html`,
  `test.html`, `Memoire.html`, `carnet.html`, `atelier.html`, `Ecoute.html`, `faibles.html`, `login.html`, `signup.html`.
- **Shared modules**: `course.js` (course model parsed from the unit HTML), `unlock.js` (which unit is open),
  `sync.js` (progress sync), `mistakes.js` (the mistake log), `nav.js` (app shell), `cast.js` / `classic-cast.js` /
  `places.js` (the illustrated characters and places), `sfx.js`, `troupe*.css`, `lexique.js` / `vocab.js` (glossary and
  word-pack engines).
- **Caddy** (`Caddyfile`) does the login gate (`forward_auth` to the tutor), caching headers, and URL rewrites.
  At container start, `caddy-entrypoint.sh` **assembles the pages**: each line `<!--@include content/…-->` in an HTML file
  is replaced by that file from the content folder. Browsers get whole pages, with normal ETags.
- **Sounds**: `sfx.js` plays recorded sound effects and character voices from `voices/v2/` when they exist
  (`fx-<name>.mp3`, `<char>-<B|C>-<slug>.mp3`; the slugs and their French lines are listed in `sfx.js`). That folder
  is **not included** in this repository: without it, every effect falls back to a short synthesised sound and the
  characters stay silent. Record your own files there to give them a voice.

## Your own content

The course lives in a **content folder**, mounted at `/srv/content` (Caddy) and `/app/content` (tutor). By default it is
`content.sample/`. To use yours:

```bash
cp -r content.sample content        # start from the sample
echo 'CONTENT_DIR=./content' >> .env
docker compose up -d                # re-creates the containers with the new folder
```

After editing content, run `docker compose restart caddy` (the pages are reassembled at start). `content/` is
git-ignored, so your course never lands in this repository by accident.

| File | What it holds |
| --- | --- |
| `meta.js` | `window.COURSE`: the units (number, title, short labels), home-page goals, topics, path labels, the unit page's header/footer texts. Up to 5 units (one illustrated place and colour each). |
| `units.html` | The lessons: one `<div class="unit" data-u="N">` per unit with six panels (`docs`, `parler`, `gram`, `voc`, `phon`, `cahier`). The comment at the top of the sample explains the markup: steps are `.card`s with an `<h3>` (or `h2.sec` sections), exercises are `.ex[data-id]` with `.inp[data-a]` blanks, `.opt[data-ok]` choices, `.mitem[data-key]` pairs. |
| `revision/parler.js` | Speaking drills and tutor role-plays (`SLOTS`, `TILE_EN`, `SPK`, `CONV`). |
| `revision/dictees.js` | Dictations (`DICTEES`). |
| `revision/pages.js`, `tracks.js`, `flashcards.js`, `footer.html` | Optional extras of the unit page (page-image viewer, audio track table, flashcard decks, footer). Keep the files even if empty. |
| `vocab.js` | `VOCAB`: the words to memorise, per unit, with an example sentence (Mémoire). |
| `lexique.js` | `GLOSS_SOURCES`: the offline French→English glossary used for tap-to-translate. |
| `tests.js` | `TESTS` and `TEST_TOPICS`: end-of-unit tests (listening, reading, grammar/vocabulary, writing, speaking). A listening item with no `src` is read aloud by the browser's French voice. |
| `ateliers.js` | `ATELIERS`: writing tasks corrected by the tutor. |
| `verbs.js` | `VERBS` (and optional `VERB_EXPRS`): the notebook's verb tables. |
| `videos.js` | `VIDEOS`: listening resources per unit (YouTube embeds, audio links, questions). |
| `tutor.json` | What each unit covers, inserted into the tutor's prompts, and the course name. |
| `media.txt` | Media folders (audio, images) that `deploy.sh` uploads. |

**Media.** Audio and images referenced by your units (`<div class="audio" data-src="…">`, `<img src="…">`) are served from
the site root. Mount their folders with a `docker-compose.override.yml` next to `docker-compose.yml` (compose reads it
automatically and it is git-ignored):

```yaml
services:
  caddy:
    volumes:
      - ./my_audio:/srv/my_audio:ro
```

**Copyright.** Only put material in a content folder that you have the right to use. Never commit textbook scans,
audio or transcripts to a public repository.

## Deploy to a server

`deploy.sh user@host` copies the code, the content folder (`content/`, or `content.sample/` if you have none) and its media
to `/srv/dudu` on the server (`REMOTE_DIR=…` to change it), then rebuilds and restarts the containers. `--code-only` skips the media. Create `.env` on
the server once (`cp .env.example .env`, add your key, `./set-password.sh`); the script never sends it.
Caddy listens on `127.0.0.1:8080` only. Put an HTTPS proxy in front of it: `nginx-example.conf` is a ready nginx block
for certbot.

## License

MIT. See [LICENSE](LICENSE).
