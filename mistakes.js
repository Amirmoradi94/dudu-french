/* ============================================================
   MISTAKES — le « carnet d'erreurs » : ce que l'élève rate, regroupé
   par thème, pour que l'appli (et le tuteur) sache où il faut y
   retourner. Module sans dépendance : window.DuduMistakes.

   Les données vivent dans le store partagé 'dudu-a1-u1' (donc
   synchronisées avec le compte) sous store.mistakes :
     { "<key>": {key, unit, src:'ex'|'spk'|'conv'|'test'|'write', ref, tab, topic,
                 q, said, better, why, n, first, last, fixed} }

   Le module ne sauvegarde jamais : c'est l'APPELANT qui appelle son
   propre save() après log() / fix(). Plafond : 300 entrées (on jette
   d'abord les erreurs corrigées les plus anciennes, puis les plus
   anciennes encore ouvertes).
   ============================================================ */
(function () {
  const DAY = 86400000;
  const CAP = 300;
  const SHOW = 'Autre';

  const clip = (s, n) => {
    s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
  };
  const table = store => {
    if (!store.mistakes || typeof store.mistakes !== 'object' || Array.isArray(store.mistakes)) store.mistakes = {};
    return store.mistakes;
  };
  /* clé dérivée du texte corrigé : « Elle est née au Japon. » et « elle est née au japon » ne font qu'un */
  const normKey = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[’`]/g, "'").replace(/[^a-z0-9']+/g, ' ').trim().slice(0, 80);

  function evict(t) {
    const keys = Object.keys(t);
    if (keys.length <= CAP) return;
    /* corrigées d'abord (la plus ancienne en tête), puis les ouvertes les plus anciennes */
    keys.sort((a, b) => {
      const A = t[a], B = t[b];
      const fa = A.fixed ? 0 : 1, fb = B.fixed ? 0 : 1;
      return fa - fb || (A.last || 0) - (B.last || 0);
    });
    keys.slice(0, keys.length - CAP).forEach(k => { delete t[k]; });
  }

  /* Enregistre une erreur (ou la refait : n++). */
  function log(store, m) {
    if (!store || !m) return null;
    const t = table(store);
    const now = Date.now();
    let key = String(m.key || '').trim();
    if (!key) key = keyOf(m.src || 'conv', m.better || m.q);
    if (!key || /:$/.test(key)) return null;
    const old = t[key];
    const e = old || {key, n: 0, first: now};
    e.unit = +m.unit || e.unit || 1;
    e.src = m.src || e.src || 'ex';
    if (m.ref != null && m.ref !== '') e.ref = String(m.ref);
    if (m.tab) e.tab = String(m.tab);
    /* « 1 · Les verbes… » (h3 des cartes) et « Les verbes… » (liste envoyée au tuteur) : un seul thème */
    e.topic = clip(String(m.topic || e.topic || SHOW).replace(/^\s*\d+\s*·\s*/, ''), 120);
    e.q = clip(m.q != null ? m.q : e.q, 160);
    e.said = clip(m.said != null ? m.said : e.said, 160);
    e.better = clip(m.better != null ? m.better : e.better, 160);
    e.why = clip(m.why != null ? m.why : e.why, 120);
    e.n = (e.n || 0) + 1;
    e.last = now;
    delete e.fixed;
    t[key] = e;
    evict(t);
    return e;
  }

  /* Marque une erreur comme corrigée (sans effet si elle n'existe pas, ou l'est déjà). */
  function fix(store, key) {
    if (!store || !store.mistakes) return false;
    const e = store.mistakes[key];
    if (!e || e.fixed) return false;
    e.fixed = Date.now();
    return true;
  }
  /* Annule fix() (bouton « annuler » de faibles.html). */
  function unfix(store, key) {
    const e = store && store.mistakes && store.mistakes[key];
    if (!e || !e.fixed) return false;
    delete e.fixed;
    return true;
  }

  /* opts : {unit, maxUnit, open:true|false}. open:true = à revoir, open:false = corrigées, absent = toutes. */
  function list(store, opts) {
    opts = opts || {};
    const t = store && store.mistakes;
    if (!t) return [];
    return Object.keys(t).map(k => t[k]).filter(e => {
      if (!e) return false;
      if (opts.unit != null && +e.unit !== +opts.unit) return false;
      if (opts.maxUnit != null && +e.unit > +opts.maxUnit) return false;
      if (opts.open === true && e.fixed) return false;
      if (opts.open === false && !e.fixed) return false;
      return true;
    }).sort((a, b) => (b.last || 0) - (a.last || 0));
  }

  const recency = (last, now) => {
    const age = now - (last || 0);
    return age < 7 * DAY ? 1 : age < 30 * DAY ? 0.5 : 0.25;
  };

  /* Regroupe par thème : [{topic, unit, n, items, last, weight}], le plus lourd d'abord.
     Un thème = le titre de l'étape (carte de grammaire / vocabulaire, section de Parler…). */
  function byTopic(store, opts) {
    opts = Object.assign({open: true}, opts || {});
    const now = Date.now(), groups = {};
    list(store, opts).forEach(e => {
      const topic = String(e.topic || SHOW).replace(/^\s*\d+\s*·\s*/, '');
      const g = groups[topic] || (groups[topic] = {topic, unit: e.unit, n: 0, items: [], last: 0, weight: 0});
      g.items.push(e);                       // list() est déjà trié : le plus récent d'abord
      g.n += e.n || 1;
      g.weight += (e.n || 1) * recency(e.last, now);
      if ((e.last || 0) > g.last) { g.last = e.last; g.unit = e.unit; }
    });
    return Object.keys(groups).map(k => groups[k])
      .sort((a, b) => b.weight - a.weight || b.last - a.last);
  }

  /* Court texte anglais pour le contexte du tuteur : les k thèmes les plus faibles, un exemple chacun. */
  function summary(store, maxUnit, k) {
    const groups = byTopic(store, {maxUnit: maxUnit == null ? 99 : maxUnit, open: true}).slice(0, k || 4);
    if (!groups.length) return '';
    const lines = groups.map(g => {
      const e = g.items.find(x => x.better) || g.items[0];
      let ex = '';
      if (e && e.better) {
        ex = e.said ? ` e.g. said "${clip(e.said, 60)}" instead of "${clip(e.better, 60)}"`
                    : ` e.g. "${clip(e.better, 60)}" was missed`;
      }
      return `- ${clip(g.topic, 70)} (${g.n} mistake${g.n > 1 ? 's' : ''})${ex}`;
    });
    return lines.join('\n');
  }

  /* Lien « Refaire » d'une erreur : l'exercice dans la page de révision, ou le test. */
  function redoHref(e, from) {
    if (!e) return 'faibles';
    const ref = e.ref || '';
    if (/^test:/.test(ref)) return 'test?id=' + encodeURIComponent(ref.slice(5)) + (from ? '&from=' + from : '');
    if (ref === 'carnet') return 'carnet#drill';                 // drill de conjugaison
    if (/^ecoute(#|$)/.test(ref)) return ref;                    // questions des vidéos (ecoute#uN)
    if (/^atelier/.test(ref)) return ref;                        // Atelier d'écriture (atelier?u=N#<tâche>)
    if (!ref) return 'revision?u=' + (e.unit || 1) + (from ? '&from=' + from : '');
    return 'revision?u=' + (e.unit || 1) + (e.tab ? '&tab=' + encodeURIComponent(e.tab) : '')
      + '&go=' + encodeURIComponent(ref) + (from ? '&from=' + from : '');
  }

  /* clé des erreurs rapportées par le tuteur : <src>:<texte corrigé normalisé> */
  const keyOf = (src, text) => src + ':' + normKey(text);

  window.DuduMistakes = {log, fix, unfix, list, byTopic, summary, redoHref, keyOf, CAP};
})();
