/* ============================================================
   SYNC — synchronise le store localStorage 'dudu-a1-u1' avec le
   compte connecté (tuteur_serveur.py : GET/POST /api/progress).

   Aucune des pages n'a besoin d'attendre le réseau pour s'afficher :
   tout continue à marcher instantanément depuis localStorage, comme
   avant. La synchronisation est un « plus », jamais un blocage —
   si elle échoue (hors ligne, serveur éteint), rien ne casse.

   - pullAndMaybeReload() : au chargement, si un autre appareil a
     poussé une progression plus récente, on la récupère et on
     recharge la page une fois pour l'afficher. Sinon, silence total.
     Si CET appareil a des changements jamais envoyés (marque « dirty »),
     ils gagnent sur le serveur et on les renvoie tout de suite.
   - schedulePush(store) : à appeler à la fin de chaque save() — un
     court débounce regroupe les sauvegardes rapprochées en un seul
     envoi réseau.
   - markActive(store) : « aujourd'hui, j'ai travaillé » — ajoute la date du jour à store.active_days
     (la série 🔥 de nav.js). Appelé par les pages au moment où l'on FAIT quelque chose (exercice corrigé,
     carte révisée, test, rédaction, case du plan…), jamais à la simple ouverture d'une page.
   - flush() : envoie tout de suite ce qui attend. Appelé tout seul quand
     la page se cache ou se ferme (pagehide / visibilitychange) : sur
     iPhone, quitter la page juste après une étape tuait le débounce, et
     l'étape n'arrivait jamais sur le serveur.
   ============================================================ */
(function () {
  const LS = 'dudu-a1-u1';
  const DIRTY = 'dudu-sync-dirty';   // hors du store synchronisé : « cet appareil a des changements pas encore envoyés »
  let pushTimer = null, pending = null;

  const readStore = () => { try { return JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch (e) { return {}; } };
  const getDirty = () => { try { return localStorage.getItem(DIRTY); } catch (e) { return null; } };
  const setDirty = () => { try { localStorage.setItem(DIRTY, String(Date.now())); } catch (e) {} };

  /* Fusion de deux stores, « over » gagne clé par clé — sauf qu'un exercice noté (tot) ne redevient
     jamais « pas fait » à cause d'une version plus ancienne, et un test réussi reste réussi. */
  function mergeStores(base, over) {
    const out = Object.assign({}, base, over);
    Object.keys(base).forEach(k => {
      if (!k.startsWith('ex_')) return;
      const b = base[k], o = over[k];
      if (b && b.tot && o && !o.tot) out[k] = Object.assign({}, o, b);
    });
    /* les jours de travail (série 🔥) : l'union des deux appareils, jamais l'un à la place de l'autre */
    ['active_days', 'plan_days', 'spk_days'].forEach(k => {
      if (Array.isArray(base[k]) || Array.isArray(over[k])) {
        out[k] = Array.from(new Set([].concat(base[k] || [], over[k] || []))).sort().slice(-400);
      }
    });
    if (base.tests && over.tests) {
      const t = Object.assign({}, base.tests, over.tests);
      Object.keys(base.tests).forEach(id => {
        if (base.tests[id] && base.tests[id].passed && !(over.tests[id] && over.tests[id].passed)) t[id] = base.tests[id];
      });
      out.tests = t;
    }
    return out;
  }

  function send(keepalive) {
    clearTimeout(pushTimer); pushTimer = null;
    const live = pending; pending = null;
    const stamp = getDirty();
    const data = readStore();                     // le plus frais : toutes les pages écrivent ici avant d'appeler schedulePush
    return fetch('/api/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      keepalive: !!keepalive,
      body: JSON.stringify({ data }),
    })
      .then(res => {
        if (res.ok && !res.redirected) return res.json();
        if (res.status >= 500) throw new Error('http ' + res.status);   // serveur injoignable derrière Caddy : on réessaiera
        return null;                                                    // session expirée (→ /login) : rien à faire ici
      })
      .then(body => {
        if (!body || !body.ok) return;
        if (live) live._syncedAt = body.updated_at;   // l'objet « store » vivant de la page suit, sinon son prochain save() remettrait l'ancien
        try {
          const cur = readStore();
          cur._syncedAt = body.updated_at;
          localStorage.setItem(LS, JSON.stringify(cur));
          if (getDirty() === stamp) localStorage.removeItem(DIRTY);   // rien de nouveau pendant l'envoi
        } catch (e) {}
        failures = 0;
      })
      .catch(() => { retryLater(); });
  }

  /* Hors ligne (métro, avion) : l'envoi échoue, la marque « dirty » reste. On réessaie tout seul — de plus en plus
     espacé (10 s, 20 s, 40 s… 5 min au plus) tant que la page est ouverte, tout de suite quand le réseau revient
     (« online ») ou quand on revient sur la page. Le prochain chargement de page renverrait de toute façon. */
  let retryTimer = null, failures = 0;
  function retryLater() {
    failures++;
    clearTimeout(retryTimer);
    retryTimer = setTimeout(retryNow, Math.min(300000, 10000 * Math.pow(2, failures - 1)));
  }
  function retryNow() {
    clearTimeout(retryTimer); retryTimer = null;
    if (pushTimer || !getDirty()) return;          // un envoi est déjà prévu, ou il n'y a rien à envoyer
    if (navigator.onLine === false) { retryLater(); return; }
    send(false);
  }

  async function pullAndMaybeReload() {
    try {
      const res = await fetch('/api/progress', { credentials: 'same-origin' });
      if (!res.ok) return;
      const body = await res.json();
      if (!body.ok) return;
      const store = readStore();
      const dirty = !!getDirty();
      if (!body.data) { if (dirty) send(); return; }   // rien côté serveur : on y met ce qu'on a
      const newer = (body.updated_at || 0) > (store._syncedAt || 0);
      if (!newer) { if (dirty) send(); return; }       // un envoi s'est perdu : on le refait
      /* Le serveur a plus récent. Si cet appareil n'a rien en attente, le serveur gagne ; sinon on garde
         nos changements par-dessus et on renvoie le tout. Dans les deux cas, rien de noté ne se perd. */
      const merged = dirty ? mergeStores(body.data, store) : mergeStores(store, body.data);
      merged._syncedAt = body.updated_at;
      localStorage.setItem(LS, JSON.stringify(merged));
      if (dirty) send(true);                          // keepalive : la page se recharge tout de suite après
      location.reload();
    } catch (e) { /* hors ligne, ou serveur injoignable : tant pis, on continue en local */ }
  }

  function schedulePush(store) {
    setDirty();
    pending = store;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => send(false), 1500);
  }

  function flush() { if (pushTimer) send(true); }

  addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
    else { failures = 0; retryNow(); }
  });
  addEventListener('online', () => { failures = 0; retryNow(); });

  async function whoami() {
    try {
      const res = await fetch('/api/whoami', { credentials: 'same-origin' });
      if (!res.ok) return null;
      const body = await res.json();
      return body.username || null;
    } catch (e) { return null; }
  }

  async function logout(redirectTo) {
    try { await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }); } catch (e) {}
    /* Appareil partagé : on retire la copie hors ligne de l'application (sw.js la refera à la prochaine connexion).
       TOUS les caches de l'origine : ils sont tous à l'application, y compris ceux d'avant un renommage. */
    try {
      if (window.caches) { const names = await caches.keys(); await Promise.all(names.map(n => caches.delete(n))); }
      if (navigator.serviceWorker) { const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(r => r.unregister())); }
    } catch (e) {}
    location.href = redirectTo || '/login';
  }

  /* La date locale (pas UTC : une séance à 22 h à Montréal compte pour aujourd'hui, pas pour demain). */
  const today = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
  const addDay = (o, day) => {
    if (!o || typeof o !== 'object') return false;
    const days = Array.isArray(o.active_days) ? o.active_days.slice() : [];
    if (days.includes(day)) return false;
    days.push(day); days.sort();
    o.active_days = days.slice(-400);
    return true;
  };
  /* Écrit le jour À LA FOIS dans le « store » vivant de la page (son prochain save() le garde) et directement
     dans localStorage (les pages qui relisent le stockage avant d'écrire — Mémoire, Écoute, plan — le gardent aussi). */
  function markActive(store) {
    try {
      const day = today();
      addDay(store, day);
      const cur = readStore();
      if (!addDay(cur, day)) return false;
      localStorage.setItem(LS, JSON.stringify(cur));
      schedulePush(store || cur);
      setTimeout(() => { try { window.DuduNav && window.DuduNav.refresh && window.DuduNav.refresh(); } catch (e) {} }, 0);
      return true;
    } catch (e) { return false; }
  }

  window.DuduSync = { pullAndMaybeReload, schedulePush, flush, whoami, logout, markActive };
  pullAndMaybeReload();
})();
