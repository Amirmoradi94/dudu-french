/* ============================================================
   SW — le « service worker » de DuDu : l'application s'ouvre et
   marche SANS Internet (métro, avion) une fois qu'on l'a ouverte une
   fois connecté.

   Enregistré par nav.js (donc seulement depuis les pages derrière le
   mot de passe). Servi par Caddy derrière le même forward_auth que le
   reste, en « no-cache » (règle *.js du Caddyfile) : le navigateur
   revérifie sw.js à chaque ouverture et installe la nouvelle version
   dès qu'un octet change.

   VERSION et VOICES sont remplis au déploiement par stamp-sw.sh
   (VERSION = empreinte du contenu : elle ne change que si un fichier
   change). Dans le dépôt : 'dev' et [] — les voix sont alors mises en
   cache au fur et à mesure qu'elles jouent.

   Stratégies :
   - pages, *.js, *.css, manifeste : le réseau d'abord (3 s maximum),
     sinon la copie en cache. Toute réponse réseau valable met le cache
     à jour. (Pas « cache d'abord » : une page neuve avec un vieux
     lesson.js / vocab.js casse ou cache des mots — le Caddyfile les sert
     en no-cache exprès pour ça.)
   - icônes, voix de La Troupe (voices/) : le cache d'abord (fichiers
     versionnés, ils ne changent jamais à la même adresse).
   - audio du livre / du cahier : mis en cache quand on l'écoute, puis
     rejoué depuis le cache (avec les requêtes « Range » que Safari exige).
     Plafond de taille : les plus anciens partent d'abord.
   - images des pages (*_assets/) : pareil, plafond séparé.
   - « Télécharger l'unité » (Moi → Hors ligne, nav.js) : la page demande
     chaque fichier de l'unité avec l'en-tête X-Dudu-Warm, et le fichier
     va droit au cache — voir prefetch() plus bas.
   - /api/* : JAMAIS en cache. Les appels au tuteur (IA) reçoivent, sans
     réseau, une réponse JSON { error } lisible que les pages affichent
     déjà telle quelle. /api/progress, /api/whoami… passent tout droit
     (sync.js gère lui-même l'échec et réessaie).
   - /login, /signup : jamais touchés.

   Piège du forward_auth : avec un cookie expiré, Caddy répond 302 vers
   /login. Une réponse redirigée n'est donc JAMAIS mise en cache (sinon
   la page de connexion prendrait la place de app.html ou de nav.js).
   ============================================================ */
'use strict';

const VERSION = 'dev';   // remplacé par stamp-sw.sh
const VOICES = [];       // remplacé par stamp-sw.sh (voices/v2/*.mp3)

const SHELL = 'dudu-shell-' + VERSION;
const AUDIO = 'dudu-audio';             // pas versionné : un déploiement ne vide pas l'audio déjà téléchargé
const IMAGES = 'dudu-images';
const FONTS = 'dudu-fonts';
const AUDIO_MAX = 80 * 1024 * 1024;      // ~ 40 pistes du livre
const IMAGES_MAX = 40 * 1024 * 1024;
const NET_TIMEOUT = 3000;                // au-delà, on sert la copie (le « réseau qui rame » du métro)

/* Les adresses courtes du Caddyfile → le fichier servi (la clé en cache). */
const ROUTES = {
  '/': '/app.html', '/app': '/app.html', '/revision': '/Unite1_Revision.html', '/ecoute': '/Ecoute.html',
  '/memoire': '/Memoire.html', '/plan': '/plan.html', '/test': '/test.html', '/faibles': '/faibles.html',
  '/carnet': '/carnet.html', '/atelier': '/atelier.html', '/index.html': '/app.html', '/ancien': '/app.html',
};

/* Le cœur : sans un seul de ces fichiers, l'installation échoue (et l'ancienne version reste en place). */
const CORE = [
  '/app.html', '/Unite1_Revision.html', '/plan.html', '/carnet.html', '/faibles.html', '/Memoire.html',
  '/Ecoute.html', '/test.html', '/atelier.html',
  '/nav.js', '/sync.js', '/cast.js', '/classic-cast.js', '/sfx.js', '/lesson.js', '/lexique.js', '/vocab.js',
  '/mistakes.js', '/places.js', '/course.js', '/unlock.js', '/troupe-widgets.js',
  // le dossier de contenu (le cours : voir README.md) — chaque fichier existe aussi dans content.sample/
  '/content/meta.js', '/content/lexique.js', '/content/vocab.js', '/content/verbs.js', '/content/tests.js',
  '/content/ateliers.js', '/content/videos.js',
  '/troupe.css', '/troupe-classic.css', '/troupe-widgets.css',
  '/manifest.webmanifest',
  '/icons/v4/icon.svg', '/icons/v4/favicon-32.png', '/icons/v4/apple-touch-icon.png',
  '/icons/v4/icon-192.png', '/icons/v4/icon-512.png', '/icons/v4/icon-maskable-192.png', '/icons/v4/icon-maskable-512.png',
];

/* Les appels au tuteur. /api/health compris : la bulle du tuteur s'en sert pour savoir s'il répond. */
const AI = /^\/api\/(ask|ask-voice|converse|grade|atelier|translate|examples|health)(\/|$)/;
const OFFLINE_MSG = "Pas d'Internet : le tuteur a besoin d'une connexion. Le reste (leçons, exercices, traductions, 🔈) marche hors ligne. — The tutor needs internet; everything else works offline.";

/* Une réponse qu'on a le droit de garder : 200, pas une redirection (→ /login), de notre origine. */
const keepable = res => res && res.ok && res.status === 200 && !res.redirected && res.type === 'basic';

/* ------------------------------ installation ------------------------------ */
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    const grab = async (url, fresh) => {
      const res = await fetch(new Request(url, { cache: fresh ? 'no-cache' : 'default', credentials: 'same-origin' }));
      if (!keepable(res)) throw new Error(url + ' : ' + res.status + (res.redirected ? ' (redirigé)' : ''));
      await cache.put(url, res);
    };
    // Le cœur doit être complet ; une voix qui manque n'empêche rien (elle se mettra en cache en jouant).
    await Promise.all(CORE.map(u => grab(u, true)));
    await Promise.allSettled(VOICES.map(u => grab(u, false)));
    await self.skipWaiting();   // tout est « réseau d'abord » : la nouvelle version peut prendre la main tout de suite
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    // toute ancienne version, y compris d'avant un renommage de l'application (« ancien-shell-… »)
    await Promise.all(names.filter(n => n.includes('-shell-') && n !== SHELL).map(n => caches.delete(n)));
    if (self.registration.navigationPreload) { try { await self.registration.navigationPreload.disable(); } catch (e) {} }
    await self.clients.claim();
  })());
});

/* ------------------------------ aiguillage ------------------------------ */
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  event.waitUntil(adopt());                                    // les caches d'avant un renommage (voir plus bas)

  if (url.origin !== self.location.origin) {
    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') event.respondWith(fonts(event));
    return;                                                    // YouTube, podcasts… : en ligne seulement
  }
  const path = url.pathname;

  if (path.startsWith('/api/')) {
    if (AI.test(path)) event.respondWith(tutor(req));
    return;                                                    // le reste de /api : réseau, tel quel
  }
  if (req.method !== 'GET') return;
  if (path === '/login' || path === '/signup' || path === '/login.html' || path === '/signup.html' || path === '/sw.js') return;

  const warm = req.headers.get('X-Dudu-Warm');
  if (/^\/[A-Za-z0-9_]+_Audio\//.test(path)) { event.respondWith(warm ? prefetch(event, AUDIO, AUDIO_MAX, warm) : audio(event)); return; }
  if (/^\/[a-z0-9]+_assets\//.test(path)) { event.respondWith(warm ? prefetch(event, IMAGES, IMAGES_MAX, warm) : image(event)); return; }
  if (path.startsWith('/voices/') || path.startsWith('/icons/')) { event.respondWith(cacheFirst(event, path)); return; }

  const key = ROUTES[path.replace(/\/$/, '') || '/'] || (/\.(html|js|css|webmanifest)$/.test(path) ? path : null);
  if (key || req.mode === 'navigate') event.respondWith(networkFirst(event, key || path));
});

/* ------------------------------ réseau d'abord ------------------------------ */
function networkFirst(event, key) {
  const req = event.request;
  const nav = req.mode === 'navigate';
  const net = fetch(req);
  // La réponse réseau met le cache à jour, même si on a déjà répondu avec la copie (délai dépassé).
  event.waitUntil(net.then(async res => {
    if (keepable(res)) await (await caches.open(SHELL)).put(key, res.clone());
  }).catch(() => {}));

  return (async () => {
    const cached = () => caches.match(key, { ignoreSearch: true });
    let timer;
    const late = new Promise(r => { timer = setTimeout(() => r('late'), NET_TIMEOUT); });
    try {
      const first = await Promise.race([net, late]);
      if (first === 'late') {
        const c = await cached();
        if (c) return c;
        return await net;                                       // rien en cache : on attend le réseau
      }
      // 302 → /login (opaqueredirect pour une navigation) : on la rend telle quelle, le navigateur suit.
      if (first.status >= 500) { const c = await cached(); if (c) return c; }  // tuteur/Caddy en panne : la copie vaut mieux
      return first;
    } catch (e) {
      const c = await cached();
      if (c) return c;
      if (nav) return offlinePage();
      return Response.error();
    } finally { clearTimeout(timer); }
  })();
}

/* ------------------------------ cache d'abord ------------------------------ */
async function cacheFirst(event, key) {
  const hit = await caches.match(key, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(event.request);
  if (keepable(res)) {
    const copy = res.clone();
    event.waitUntil(caches.open(SHELL).then(c => c.put(key, copy)));
  }
  return res;
}

/* ------------------------------ les images des pages ------------------------------ */
async function image(event) {
  const cache = await caches.open(IMAGES);
  const hit = await lookup(IMAGES, new URL(event.request.url).pathname);
  if (hit) return hit;
  const res = await fetch(event.request);
  if (keepable(res)) {
    const copy = res.clone();
    event.waitUntil(store(cache, new URL(event.request.url).pathname, copy).then(() => trim(IMAGES, IMAGES_MAX)));
  }
  return res;
}

/* ------------------------------ l'audio du livre ------------------------------
   <audio> demande des morceaux (« Range: bytes=… », réponse 206) — et Safari ne joue PAS
   une réponse 200 complète à une telle demande. Or le cache ne garde pas les 206. Donc :
   - déjà en cache → on découpe le morceau demandé dans le fichier complet ;
   - pas en cache  → la demande va au réseau telle quelle (la lecture démarre sans attendre)
                      et, en parallèle, on télécharge le fichier COMPLET pour le cache. */
async function audio(event) {
  const req = event.request;
  const key = new URL(req.url).pathname;
  const hit = await lookup(AUDIO, key);
  if (hit) return slice(hit, req.headers.get('range'));
  event.waitUntil(download(AUDIO, AUDIO_MAX, key));
  return fetch(req);
}

/* Le fichier COMPLET, rangé en cache puis trim(). Un seul téléchargement à la fois par fichier, même si la lecture
   et « Télécharger l'unité » le demandent en même temps. Ne rejette jamais : 'ok' | 'auth' (cookie expiré → /login)
   | 'http' (404, 5xx…) | 'net' (pas de réseau). */
const inflight = new Map();
function download(name, max, key, room) {
  if (!inflight.has(key)) {
    const job = (async () => {
      const res = await fetch(new Request(key, { credentials: 'same-origin' }));
      if (!keepable(res)) return (res.redirected || res.status === 401 || res.status === 403) ? 'auth' : 'http';
      if (room) {                                   // 'fill' : seulement s'il y a la place sans rien enlever
        const len = +res.headers.get('Content-Length') || 0;
        if ((await usage(name)) + len > max) { try { res.body && res.body.cancel(); } catch (e) {} return 'full'; }
      }
      await store(await caches.open(name), key, res);
      await trim(name, max);
      return 'ok';
    })().catch(() => 'net').finally(() => inflight.delete(key));
    inflight.set(key, job);
  }
  return inflight.get(key);
}

/* ------------------------------ « Télécharger l'unité » ------------------------------
   nav.js demande chaque fichier de l'unité avec l'en-tête X-Dudu-Warm. La réponse est vide (204) : le fichier va
   au cache, pas à la page. C'est la PAGE qui fait la boucle, un fichier par requête : un service worker peut être
   arrêté à tout moment, une boucle de 50 Mo menée d'ici serait coupée en route.
   - 'touch' : déjà en cache → rangé de nouveau, en dernier. Les fichiers de l'unité deviennent les plus récents,
               donc trim() enlèvera d'abord ceux des AUTRES unités, jamais ceux qu'on vient de vérifier.
               Pas en cache → rien (X-Dudu-Cached: 0).
   - 'get'   : pas en cache → téléchargé en entier, rangé, trim().
   - 'fill'  : pareil, mais seulement s'il reste la place SANS rien enlever (sinon 507, rien n'est téléchargé) :
               le téléchargement automatique sur Wi-Fi ne remplace jamais une unité téléchargée exprès.
   En-têtes de la réponse : X-Dudu-Cached 0|1, X-Dudu-Size (octets), X-Dudu-Max (le plafond de ce cache).
   Erreurs : 401 cookie expiré, 502 le serveur refuse le fichier, 503 pas de réseau, 507 plus de place ('fill'). */
async function prefetch(event, name, max, mode) {
  const key = new URL(event.request.url).pathname;
  const cache = await caches.open(name);
  const reply = (status, hit) => new Response(null, {
    status,
    headers: {
      'X-Dudu-Cached': hit ? '1' : '0', 'X-Dudu-Size': String(hit ? +hit.headers.get('X-Dudu-Size') || 0 : 0),
      'X-Dudu-Max': String(max), 'Cache-Control': 'no-store',
    },
  });
  let hit = await lookup(name, key);
  if (hit) {
    if (mode === 'touch') {
      // delete puis put : un simple put sur une clé existante ne la déplace pas forcément en fin de liste.
      const blob = await hit.blob();
      await cache.delete(key);
      await cache.put(key, new Response(blob, { headers: hit.headers }));
    }
    return reply(204, hit);
  }
  if (mode !== 'get' && mode !== 'fill') return reply(204, null);
  const got = await download(name, max, key, mode === 'fill');
  if (got !== 'ok') return reply({ auth: 401, net: 503, full: 507 }[got] || 502, null);
  return reply(204, await cache.match(key));
}

async function slice(res, range) {
  if (!range) return res;
  const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  const buf = await res.arrayBuffer();
  const size = buf.byteLength;
  let start, end;
  if (m && m[1] !== '') { start = +m[1]; end = m[2] !== '' ? Math.min(+m[2], size - 1) : size - 1; }
  else if (m && m[2] !== '') { start = Math.max(0, size - +m[2]); end = size - 1; }   // « bytes=-500 » : les 500 derniers
  if (!m || start > end || start >= size) {
    return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + size } });
  }
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'audio/mpeg',
      'Content-Range': 'bytes ' + start + '-' + end + '/' + size,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  });
}

/* On range le corps avec sa taille en en-tête : trim() additionne sans relire les fichiers. */
async function store(cache, key, res) {
  const blob = await res.blob();
  await cache.put(key, new Response(blob, {
    headers: {
      'Content-Type': res.headers.get('Content-Type') || blob.type || 'application/octet-stream',
      'Content-Length': String(blob.size), 'Accept-Ranges': 'bytes', 'X-Dudu-Size': String(blob.size),
    },
  }));
}

/* Au-dessus du plafond, les plus anciens partent d'abord (cache.keys() rend l'ordre d'arrivée). */
async function sizes(cache) {
  const keys = await cache.keys();
  // X-Dudu-Size, sinon Content-Length (store() écrit les deux) : un fichier rangé sous un ancien nom d'en-tête compte aussi
  const size = r => +(r && (r.headers.get('X-Dudu-Size') || r.headers.get('Content-Length'))) || 0;
  return { keys, sizes: await Promise.all(keys.map(k => cache.match(k).then(size))) };
}
async function usage(name) {
  return (await sizes(await caches.open(name))).sizes.reduce((a, b) => a + b, 0);
}
async function trim(name, max) {
  const cache = await caches.open(name);
  const { keys, sizes: sz } = await sizes(cache);
  let total = sz.reduce((a, b) => a + b, 0);
  for (let i = 0; i < keys.length && total > max; i++) { await cache.delete(keys[i]); total -= sz[i]; }
}

/* ------------------------------ caches d'avant un renommage ------------------------------
   L'application a changé de nom, ses caches aussi (« ancien-audio » → AUDIO). L'audio et les images déjà
   téléchargés (« Télécharger l'unité ») ne doivent pas se perdre : tout cache « …-audio », « …-images » ou
   « …-fonts » qui n'est pas le nôtre est un ancien, sans qu'on ait à connaître l'ancien nom.
   - adopt() passe ses fichiers dans le nôtre, un par un, en fond (le premier fetch le lance). Pas d'un bloc dans
     'activate' : les pages attendraient la fin de la copie (jusqu'à 120 Mo). Un service worker arrêté en route
     reprend au démarrage suivant : chaque fichier quitte l'ancien cache juste après être entré dans le nôtre.
   - lookup() : le nôtre, sinon un ancien — le fichier change alors de cache tout de suite. */
const SUFFIX = { [AUDIO]: '-audio', [IMAGES]: '-images', [FONTS]: '-fonts' };
async function legacy(name) {
  return (await caches.keys()).filter(n => n !== name && n.endsWith(SUFFIX[name]));
}
async function lookup(name, key) {
  const cache = await caches.open(name);
  const hit = await cache.match(key, { ignoreSearch: true });
  if (hit) return hit;
  for (const old of await legacy(name)) {
    const prev = await caches.open(old);
    const was = await prev.match(key, { ignoreSearch: true });
    if (!was) continue;
    await store(cache, key, was);                              // réécrit aussi l'en-tête de taille sous son nom actuel
    await prev.delete(key, { ignoreSearch: true });
    return cache.match(key);
  }
  return undefined;
}
let adopting = null;
function adopt() {
  if (!adopting) adopting = (async () => {
    for (const name of [AUDIO, IMAGES, FONTS]) {
      const olds = await legacy(name);
      if (!olds.length) continue;
      const cache = await caches.open(name);
      for (const old of olds) {
        const prev = await caches.open(old);
        for (const req of await prev.keys()) {
          const res = await prev.match(req);
          if (res && !(await cache.match(req))) {
            if (name === FONTS) await cache.put(req, res);         // réponses d'un autre site : telles quelles
            else await store(cache, new URL(req.url).pathname, res);
          }
          await prev.delete(req);
        }
        await caches.delete(old);
      }
      if (name !== FONTS) await trim(name, name === AUDIO ? AUDIO_MAX : IMAGES_MAX);
    }
  })().catch(() => { adopting = null; });                       // on réessaiera au prochain fetch
  return adopting;
}

/* ------------------------------ polices Google ------------------------------ */
async function fonts(event) {
  const cache = await caches.open(FONTS);
  const hit = await cache.match(event.request);
  const net = fetch(event.request).then(res => {
    if (res.ok) { const copy = res.clone(); cache.put(event.request, copy).catch(() => {}); }
    return res;
  });
  if (hit) { event.waitUntil(net.catch(() => {})); return hit; }
  return net;
}

/* ------------------------------ le tuteur ------------------------------ */
async function tutor(req) {
  try {
    return await fetch(req);
  } catch (e) {
    if (e && e.name === 'AbortError') throw e;               // la page a abandonné elle-même (délai) : elle a son message
    return new Response(JSON.stringify({ ok: false, offline: true, error: OFFLINE_MSG }), {
      status: 503, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
}

/* ------------------------------ page jamais ouverte ------------------------------ */
function offlinePage() {
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Hors ligne — DuDu</title>
<style>body{font:17px/1.5 system-ui,sans-serif;margin:0;min-height:100vh;display:grid;place-items:center;background:#fbf6ec;color:#2b2622;padding:16px;box-sizing:border-box}
@media (prefers-color-scheme:dark){body{background:#1d1a17;color:#efe7da}}
main{max-width:26rem;text-align:center}a{color:inherit;font-weight:600}small{opacity:.7}</style></head>
<body><main><h1>📡 Hors ligne</h1>
<p>Cette page n'a pas encore été ouverte avec Internet, elle n'est donc pas sur ce téléphone.</p>
<p><small>This page hasn't been opened online yet, so it isn't saved on this device.</small></p>
<p><a href="/">← Revenir au parcours</a></p></main></body></html>`;
  return new Response(html, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}
