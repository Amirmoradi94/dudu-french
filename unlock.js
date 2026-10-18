/* ============================================================
   UNLOCK — qui peut ouvrir quelle unité. Module sans dépendance : window.Unlock.
   Une seule source de vérité : la page d'accueil (/app), la page classique
   (revision), le mode leçon, les tests, le plan, l'atelier, Mémoire, le carnet…
   demandent tous ici, et sont donc toujours d'accord.

   La règle
     L'unité N est OUVERTE si c'est la première (1), OU si elle a de la progression
     (un exercice de l'unité N a un enregistrement ex_<id> avec tot > 0, OU le test
     de fin d'unité N est réussi), OU si le test de l'unité N-1 est réussi.
     « L'unité en cours » (frontier) = la plus haute unité ouverte ; en dessous :
     passées (toujours ouvertes) ; au-dessus : VERROUILLÉES.

   « A de la progression » se lit sur les données brutes du store, pas sur le
   parcours : toutes les pages tombent donc sur le même résultat. Il faut pour cela
   savoir à quelle unité appartient chaque exercice (les ids de l'unité 1 n'ont pas de
   préfixe : v1, p2, c… — on ne peut pas les deviner). Cette correspondance id → unité
   vient du cours (Course.parseCourse → exWhere) ou de la page classique vivante
   (.unit[data-u] .ex[data-id]), et elle est gardée dans localStorage
   « dudu-unlock-map » pour que les autres pages n'aient pas à télécharger la
   (lourde) page de révision. Sans cette carte, ready() charge course.js + le cours
   une seule fois, puis la garde.

   Le module ne SAUVEGARDE jamais le store (il est synchronisé avec le serveur) et n'en
   garde aucun : chaque fonction d'état reçoit le store en argument (par défaut :
   une lecture fraîche de 'dudu-a1-u1'). Seule écriture : dudu-unlock-map.

   API
     Unlock.UNITS                       [1..5]
     Unlock.state(store?, map?)         → état synchrone, ou null s'il n'y a pas de carte
     Unlock.ready(store?)               → Promise de l'état (charge le cours au besoin ; jamais rejetée)
     Unlock.remember(courseOuExWhere)   → met la carte à jour depuis Course.parseCourse(…) ou exWhere
     Unlock.rememberFromDoc(doc?)       → idem depuis le DOM vivant de la page classique
     Unlock.hasMap()                    → true si une carte est disponible
     Unlock.lockText(n)                 → {fr, en, need}  « Verrouillée · termine l'unité 3 pour l'ouvrir »
     Unlock.lockIcon()                  → un cadenas SVG en ligne (currentColor)
     Unlock.hint(état)                  → une ligne « Unités 4 à 5 verrouillées · termine l'unité 3… » (HTML, '' si rien n'est verrouillé)
     Unlock.notice(n, {about})          → petit message (role=status) qui dit pourquoi
     Unlock.lockControl(el, n)          → marque un contrôle verrouillé (aria-disabled, hors tabulation, message au clic)
     Unlock.fromUrl(key?)               → lit « ?locked=N » (laissé par une redirection) et le retire de l'adresse
   L'état : {frontier, units, approx, open(n), locked(n), stateOf(n), clamp(n),
             testUnit(id), testLocked(id), lockedUnits(), openUnits()}
   ============================================================ */
(function () {
  'use strict';

  const LS = 'dudu-a1-u1';
  const MAP_KEY = 'dudu-unlock-map';
  const UNITS = Object.keys((window.COURSE || {}).units || {1: 1}).map(Number);   // les unités de content/meta.js (= Course.TEST_MAX_UNIT)
  const FIRST = UNITS[0];

  /* ------------------------------ le store (lecture seule) ------------------------------ */
  const readStore = () => { try { return JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch (e) { return {}; } };
  const testPassed = (store, id) => !!(store && store.tests && store.tests[id] && store.tests[id].passed);

  /* ------------------------------ la carte id → unité ------------------------------ */
  let MAP = null;                               // {v, units:{1:[ids],…}, at} — en mémoire, puis dans localStorage

  const validMap = m => !!(m && m.units && UNITS.every(n => Array.isArray(m.units[n]) && m.units[n].length > 0));
  /* index inverse, construit une fois par carte : id → unité */
  let IDX = null, IDX_OF = null;
  function indexOf(map) {
    if (IDX_OF === map && IDX) return IDX;
    const ix = Object.create(null);
    UNITS.forEach(n => (map.units[n] || []).forEach(id => { ix[id] = n; }));
    IDX = ix; IDX_OF = map;
    return ix;
  }

  function loadStoredMap() {
    try {
      const m = JSON.parse(localStorage.getItem(MAP_KEY) || 'null');
      if (validMap(m)) return m;
    } catch (e) {}
    return null;
  }
  function getMap() {
    if (!MAP) MAP = loadStoredMap();
    return MAP;
  }
  const hasMap = () => !!getMap();

  /* Met la carte à jour. `src` : un cours (Course.parseCourse — lit .exWhere) ou directement un exWhere {id: {unit}}.
     N'écrit dans localStorage que si la carte a changé (pas de réécriture à chaque visite). */
  function remember(src) {
    try {
      const ew = src && src.exWhere ? src.exWhere : src;
      if (!ew || typeof ew !== 'object') return false;
      const units = {};
      UNITS.forEach(n => { units[n] = []; });
      Object.keys(ew).forEach(id => {
        const u = ew[id] && +ew[id].unit;
        if (units[u]) units[u].push(id);
      });
      return store_(units);
    } catch (e) { return false; }
  }
  function rememberFromDoc(doc) {
    try {
      doc = doc || document;
      const units = {};
      UNITS.forEach(n => { units[n] = []; });
      doc.querySelectorAll('.unit[data-u] .ex[data-id]').forEach(x => {
        const u = +x.closest('.unit[data-u]').dataset.u;
        if (units[u] && !units[u].includes(x.dataset.id)) units[u].push(x.dataset.id);
      });
      return store_(units);
    } catch (e) { return false; }
  }
  function store_(units) {
    const next = {v: 1, units, at: Date.now()};
    if (!validMap(next)) return false;           // un document incomplet ne remplace jamais une bonne carte
    const prev = getMap();
    const same = prev && UNITS.every(n => prev.units[n].length === units[n].length && prev.units[n].every((id, i) => id === units[n][i]));
    MAP = same ? prev : next;
    if (!same) { try { localStorage.setItem(MAP_KEY, JSON.stringify(next)); } catch (e) {} }
    return true;
  }

  /* ------------------------------ la règle ------------------------------ */

  /* L'unité n a-t-elle de la progression ? (map = carte id → unité ; null → on ne regarde que les tests) */
  function hasProgress(store, n, map) {
    if (testPassed(store, String(n))) return true;
    if (!map) return false;
    return (map.units[n] || []).some(id => { const r = store['ex_' + id]; return !!(r && r.tot > 0); });
  }
  function isOpenUnit(store, n, map) {
    return n === FIRST || hasProgress(store, n, map) || testPassed(store, String(n - 1));
  }

  /* Un test (« 3 » ou un bilan « 1-2 », « 3-4 ») dépend de la plus haute unité qu'il couvre. */
  function testUnit(id) {
    const nums = String(id == null ? '' : id).split(/[^0-9]+/).filter(Boolean).map(Number).filter(n => n > 0);
    return nums.length ? Math.max.apply(null, nums) : NaN;
  }

  /* L'état complet. `approx` : calculé sans carte (tests seulement) — voir ready(). */
  function compute(store, map) {
    store = store || {};
    let frontier = FIRST;
    UNITS.forEach(n => { if (isOpenUnit(store, n, map)) frontier = n; });
    const valid = n => UNITS.indexOf(n) >= 0;
    const st = {
      frontier, units: UNITS.slice(), approx: !map,
      open: n => { n = +n; return valid(n) && n <= frontier; },
      locked: n => { n = +n; return valid(n) && n > frontier; },
      stateOf: n => { n = +n; return !valid(n) ? null : n < frontier ? 'past' : n === frontier ? 'current' : 'locked'; },
      /* une unité demandée (adresse, store.unit, puce…) → une unité qu'on a le droit d'ouvrir */
      clamp: n => { n = +n; return valid(n) && n <= frontier ? n : frontier; },
      testUnit,
      testLocked: id => { const u = testUnit(id); return valid(u) && u > frontier; },
      lockedUnits: () => UNITS.filter(n => n > frontier),
      openUnits: () => UNITS.filter(n => n <= frontier),
    };
    return st;
  }

  /* L'état, tout de suite — ou null s'il n'y a pas encore de carte (utiliser ready()). */
  function state(store, map) {
    map = map || getMap();
    if (!map) return null;
    return compute(store || readStore(), map);
  }

  /* ------------------------------ sans carte : charger le cours, une fois ------------------------------ */
  let loading = null;
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = () => res(); s.onerror = () => rej(new Error('script ' + src));
      document.head.appendChild(s);
    });
  }
  function loadMap() {
    if (loading) return loading;
    const p = (async () => {
      if (!window.Course) await loadScript('course.js');
      const c = await window.Course.loadCourse();
      remember(c);
      return getMap();
    })();
    loading = p;
    p.catch(() => { if (loading === p) loading = null; });   // un échec n'est pas gardé : le prochain appel réessaie
    return p;
  }
  /* L'état, avec chargement si besoin. Ne rejette jamais : si le cours est introuvable (réseau), on retombe sur
     un état « approximatif » (calculé sur les tests seulement, approx: true) plutôt que de bloquer la page. */
  function ready(store) {
    const m = getMap();
    if (m) return Promise.resolve(compute(store || readStore(), m));
    return loadMap().then(
      map => compute(store || readStore(), map),
      () => compute(store || readStore(), null)
    );
  }

  /* ------------------------------ les textes (partout les mêmes) ------------------------------ */
  function lockText(n) {
    const need = Math.max(1, (+n || 2) - 1);
    return {
      fr: `Verrouillée · termine l'unité ${need} pour l'ouvrir`,
      en: `Locked — pass the unit ${need} test to open it.`,
      need,
    };
  }

  /* ------------------------------ un peu d'interface partagée ------------------------------ */
  const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

  const LOCK_PATH = '<rect x="5" y="11" width="14" height="10" rx="2.5" fill="currentColor"/><path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>';
  const lockIcon = () => `<svg class="ul-ico" viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false">${LOCK_PATH}</svg>`;

  /* Les variables de couleur : La Troupe (--t-*) ou, à défaut, la feuille de la page classique d'origine (--surface, --ink…). */
  const CSS = `
.ul-ico{display:inline-block;vertical-align:-.14em;flex:none}
.ul-toast{position:fixed;left:50%;bottom:calc(88px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:2147483000;
  box-sizing:border-box;width:max-content;max-width:min(92vw,440px);display:flex;gap:10px;align-items:flex-start;
  padding:12px 16px 12px 14px;border-radius:16px;background:var(--t-paper,var(--surface,#fff));color:var(--t-ink,var(--ink,#2b2230));
  border:2px solid var(--t-mustard,var(--gold,#f0a01c));box-shadow:0 5px 0 var(--t-line,rgba(0,0,0,.12)),0 14px 30px rgba(0,0,0,.18);
  font:700 14px/1.35 var(--t-font-b,system-ui,sans-serif);animation:ul-in .28s cubic-bezier(.2,.9,.3,1.2) both}
.ul-toast .ul-ico{font-size:20px;margin-top:1px;color:var(--t-mustard-d,var(--gold-d,#b36b00))}
.ul-toast b{display:block;font-weight:800}
.ul-toast small{display:block;margin-top:2px;font:600 12.5px/1.35 var(--t-font-b,system-ui,sans-serif);color:var(--t-ink-2,var(--muted,#6b6573))}
.ul-toast.is-out{opacity:0;transform:translateX(-50%) translateY(8px);transition:opacity .25s,transform .25s}
@keyframes ul-in{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%)}}
@media (prefers-reduced-motion:reduce){.ul-toast{animation:none}.ul-toast.is-out{transition:none}}
[data-locked="1"]{cursor:not-allowed}
.ul-hint{display:flex;gap:8px;align-items:flex-start;margin:10px 0 0;font:700 13px/1.35 var(--t-font-b,system-ui,sans-serif);color:var(--t-ink,var(--ink,#2b2230))}
.ul-hint .ul-ico{font-size:17px;margin-top:1px;color:var(--t-ink-2,var(--muted,#6b6573))}
.ul-hint small{display:block;font:600 12.5px/1.35 var(--t-font-b,system-ui,sans-serif);color:var(--t-ink-2,var(--muted,#6b6573))}
`;
  function ensureCss() {
    if (document.getElementById('ul-css')) return;
    const st = document.createElement('style'); st.id = 'ul-css'; st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  /* Un message qui dit pourquoi, sans bloquer : disparaît seul. `about` : une phrase d'introduction facultative
     (« L'unité 4 est verrouillée… »). Un seul message à la fois. */
  let toastTimer = 0;
  function notice(n, opts) {
    try {
      opts = opts || {};
      ensureCss();
      const old = document.querySelector('.ul-toast'); if (old) old.remove();
      clearTimeout(toastTimer);
      const t = lockText(n);
      const el = document.createElement('div');
      el.className = 'ul-toast'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
      el.innerHTML = `${lockIcon()}<div><b>${esc(opts.about || `L'unité ${n} est verrouillée.`)}</b>${esc(t.fr.replace(/^Verrouillée · /, '').replace(/^./, c => c.toUpperCase()))}.<small>${esc(t.en)}</small></div>`;
      document.body.appendChild(el);
      const gone = () => { if (reduced()) { el.remove(); return; } el.classList.add('is-out'); setTimeout(() => el.remove(), 300); };
      toastTimer = setTimeout(gone, opts.ms || 6500);
      el.addEventListener('click', () => { clearTimeout(toastTimer); gone(); });
    } catch (e) {}
  }

  /* Une ligne qui dit, sous un sélecteur d'unités, lesquelles sont verrouillées et pourquoi (« '' » s'il n'y en a aucune). */
  function hint(st) {
    if (!st || !st.lockedUnits().length) return '';
    ensureCss();
    const lu = st.lockedUnits(), first = lu[0], last = lu[lu.length - 1], t = lockText(first);
    const which = lu.length > 1 ? `Unités ${first} à ${last} verrouillées` : `Unité ${first} verrouillée`;
    return `<span class="ul-hint" role="note">${lockIcon()}<span>${esc(which)} · ${esc(t.fr.replace(/^Verrouillée · /, ''))}.<small>${esc(t.en)}</small></span></span>`;
  }

  /* Marque un contrôle (puce, bouton, lien) comme verrouillé : aria-disabled, hors de l'ordre de tabulation, un titre,
     et un tap/clic qui ne fait rien d'autre que dire pourquoi. Les liens perdent leur href. */
  function lockControl(el, n) {
    if (!el) return el;
    const t = lockText(n);
    el.setAttribute('aria-disabled', 'true');
    el.setAttribute('data-locked', '1');
    el.tabIndex = -1;
    if (el.tagName === 'A') { el.removeAttribute('href'); el.setAttribute('role', 'link'); }
    el.title = t.fr;
    const base = el.getAttribute('aria-label');
    if (!base) el.setAttribute('aria-label', `${(el.textContent || '').replace(/\s+/g, ' ').trim()} — verrouillée : ${t.fr.replace(/^Verrouillée · /, '')}`);
    if (!el.__ulBound) {
      el.__ulBound = true;
      const stop = e => { e.preventDefault(); e.stopImmediatePropagation(); notice(n); };
      el.addEventListener('click', stop, true);
      el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') stop(e); }, true);
    }
    return el;
  }

  /* Une redirection laisse « ?locked=N » dans l'adresse : on le lit une fois, on le retire (replaceState), et on rend N. */
  function fromUrl(key) {
    try {
      key = key || 'locked';
      const q = new URLSearchParams(location.search);
      const n = parseInt(q.get(key), 10);
      if (!n) return 0;
      q.delete(key);
      const s = q.toString();
      history.replaceState(history.state, '', location.pathname + (s ? '?' + s : '') + location.hash);
      return UNITS.indexOf(n) >= 0 ? n : 0;
    } catch (e) { return 0; }
  }

  ensureCss();         // les classes .ul-* sont prêtes dès le chargement

  window.Unlock = {
    UNITS, MAP_KEY,
    state, ready, remember, rememberFromDoc, hasMap,
    lockText, lockIcon, notice, lockControl, fromUrl, hint,
    testUnit, hasProgress,
  };
})();
