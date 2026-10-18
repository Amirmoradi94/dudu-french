/* ============================================================
   COURSE — le modèle partagé du cours : structure (unités → panneaux →
   étapes), état « fait / faible » lu dans le store, et le parcours (path)
   d'une unité. Module sans dépendance : window.Course.

   Utilisé par plan.html (plan du jour), par la page d'accueil « parcours »
   (/app) et par le mode leçon de Unite1_Revision.html (?mode=lesson).
   Rien n'est écrit en dur sur le contenu des unités : tout est lu dans le
   HTML de la page de révision (fetch + DOMParser, ou le document vivant).

   Le module ne SAUVEGARDE jamais le store et n'en garde aucun : chaque
   fonction d'état reçoit le store en premier argument (le store 'dudu-a1-u1'
   est un objet réassigné par les pages à chaque retour au premier plan).

   Un « course » = { N: {docs:[step], gram:[], voc:[], phon:[], parler:[], cahier:[]} }
   avec en plus course.exWhere (non énumérable) : data-id de CHAQUE exercice →
   {unit, panel}, même ceux qu'aucune étape ne regroupe.
   Une « step » = {unit, panel, title, exIds, nAudio, est, letter?, gp?, bonus?}
   (gp : n° de chapitre du livre de grammaire ; bonus : étape facultative, qui ne bloque pas l'unité).
   ============================================================ */
(function () {
  'use strict';

  const LS = 'dudu-a1-u1';
  const COURSE_URL = 'Unite1_Revision.html';

  /* Les tests de tests.js : une unité en a un jusqu'à TEST_MAX_UNIT
     (les bilans 1–2 et 3–4 sont proposés après les unités 2 et 4). */
  const TEST_MAX_UNIT = Math.max(...Object.keys((window.COURSE || {}).units || {1: 1}).map(Number));   // la dernière unité de content/meta.js
  const BILANS = {2: {id: '1-2', label: 'unités 1–2'}, 4: {id: '3-4', label: 'unités 3–4'}};

  const PANELS = ['docs', 'parler', 'gram', 'voc', 'phon', 'cahier'];

  /* ------------------------------ le store ------------------------------ */
  const readStore = () => { try { return JSON.parse(localStorage.getItem(LS) || '{}') || {}; } catch (e) { return {}; } };

  /* ------------------------------ structure du cours ------------------------------ */

  /* texte d'un titre sans le bouton « EN » ni les traductions */
  function cleanText(el) {
    const c = el.cloneNode(true);
    c.querySelectorAll('button, .en, [class*="en-"], .note').forEach(x => x.remove());
    return c.textContent.replace(/\s+/g, ' ').trim();
  }

  /* Types d'exercices « spéciaux » : ils se notent par leur propre mécanisme
     (dictée, répétez, parole libre, conversation), pas par .inp / .opt / .mitem. */
  const SPECIAL = '.dic, .spk, .speak-q, .conv';

  /* Un exercice qu'on peut terminer : au moins une case à remplir / un choix / une paire à relier,
     un bouton « Vérifier » (.check — certains exercices, comme v3 « l'âge des célébrités », construisent leurs
     cases en JavaScript : la page statique n'en a pas encore, la page vivante oui), ou un type spécial.
     Sans rien de tout cela (p. ex. « Écoutez et observez » ou « Écoutez et répétez — pas de correction ici »
     du cahier : c21-pg1, c21-pg2, c24-pg2), check() n'enregistre jamais rien, store['ex_<id>'].tot reste vide
     et l'étape ne pourrait JAMAIS être terminée. Le résultat est le même sur le HTML récupéré et sur la page vivante. */
  const isGradable = x => !!x.querySelector('.inp, .opt, .mitem, .check') || x.matches(SPECIAL) || !!x.querySelector(SPECIAL);

  function makeStep(unit, panel, title, els, extra) {
    const ids = [];
    let nAudio = 0;
    /* Phonétique : les exercices « répétez » (.ex.spk, qui demandent le micro) ne font pas partie de l'étape —
       sans micro, l'élève ne pourrait jamais la terminer. Ils restent dans exWhere (liens « à retravailler »). */
    const skip = x => panel === 'phon' && x.classList.contains('spk');
    /* Les exercices sans rien à noter sont écartés de exIds (voir isGradable) : ils restent dans le
       HTML et dans exWhere, mais ne comptent plus dans la progression de l'étape. */
    const take = x => { if (!skip(x) && isGradable(x) && !ids.includes(x.dataset.id)) ids.push(x.dataset.id); };
    els.forEach(el => {
      el.querySelectorAll('.ex[data-id]').forEach(take);
      if (el.matches && el.matches('.ex[data-id]')) take(el);
      nAudio += el.querySelectorAll('.audio').length;
    });
    if (!ids.length) return null;
    const est = panel === 'parler' ? 3 * ids.length : Math.min(25, 4 + 2 * ids.length + 3 * nAudio);
    return Object.assign({unit, panel, title, exIds: ids, nAudio, est}, extra || {});
  }

  /* Les étapes d'UN panneau (élément section.panel). Règles de regroupement :
       - parler / cahier : chaque h2.sec ouvre une étape qui court jusqu'au h2.sec suivant ;
       - docs / gram / voc / phon : une carte avec h3 = une étape ; les cartes sans h3 (unité 1 :
         gram/voc) sont regroupées sous le h2.sec qui les précède.
     opts.keepEls : attache à chaque étape (propriété NON énumérable) `els`, les éléments qui la composent
     — pour le lecteur de leçon, qui travaille sur le document vivant. */
  function panelSteps(n, panel, p, opts) {
    const keep = !!(opts && opts.keepEls);
    const out = [];
    const push = (s, els) => {
      if (!s) return;
      if (keep) Object.defineProperty(s, 'els', {value: els, enumerable: false});
      out.push(s);
    };
    if (panel === 'parler' || panel === 'cahier') {
      let cur = null;
      const flush = () => { if (cur) push(makeStep(n, panel, cur.title, cur.els), cur.els); };
      Array.from(p.children).forEach(el => {
        if (el.matches('h2.sec')) { flush(); cur = {title: cleanText(el), els: []}; }
        else if (cur) cur.els.push(el);
      });
      flush();
    } else {
      let sec = null, grp = null;
      const flushGrp = () => { if (grp) push(makeStep(n, panel, grp.title, grp.els), grp.els); grp = null; };
      Array.from(p.children).forEach(card => {
        if (card.matches('h2.sec')) { flushGrp(); sec = card; return; }
        if (!card.classList.contains('card')) return;
        const h = card.querySelector('h3');
        if (!card.querySelector('.ex[data-id]')) return;
        if (!h) {
          if (!sec) return;
          if (!grp) grp = {title: cleanText(sec).replace(/^\d+\s*·\s*/, ''), els: []};
          grp.els.push(card);
          return;
        }
        flushGrp();
        const letter = card.querySelector('.letter');
        const extra = {};
        if (letter) extra.letter = letter.textContent.trim();
        /* une carte d'un livre de grammaire complémentaire : data-gp = n° du chapitre ; data-bonus = étape facultative */
        if (card.dataset.gp) { extra.gp = card.dataset.gp; if (card.hasAttribute('data-bonus')) extra.bonus = true; }
        push(makeStep(n, panel, cleanText(h), [card], Object.keys(extra).length ? extra : null), [card]);
      });
      flushGrp();
    }
    return out;
  }

  /* Les étapes d'un panneau d'une unité, dans n'importe quel Document (résultat de DOMParser ou page vivante). */
  function stepsOfPanel(doc, unit, panel, opts) {
    const p = doc.querySelector(`.unit[data-u="${+unit}"] section.panel[data-p="${panel}"]`);
    return p ? panelSteps(+unit, panel, p, opts) : [];
  }

  /* Tout le cours. `docOrHtml` : un Document, ou une chaîne HTML. */
  function parseCourse(docOrHtml) {
    const doc = typeof docOrHtml === 'string' ? new DOMParser().parseFromString(docOrHtml, 'text/html') : docOrHtml;
    const out = {};
    const exWhere = {};
    doc.querySelectorAll('.unit[data-u]').forEach(u => {
      const n = +u.dataset.u;
      const unit = {docs: [], gram: [], voc: [], phon: [], parler: [], cahier: []};
      u.querySelectorAll('section.panel[data-p]').forEach(p => {
        const panel = p.dataset.p;
        if (!unit[panel]) return;
        p.querySelectorAll('.ex[data-id]').forEach(x => { exWhere[x.dataset.id] = {unit: n, panel}; });
        unit[panel] = panelSteps(n, panel, p);
      });
      out[n] = unit;
    });
    Object.defineProperty(out, 'exWhere', {value: exWhere, enumerable: false});
    return out;
  }

  const unitsOf = course => Object.keys(course).map(Number).sort((a, b) => a - b);

  /* Charge le cours depuis la page de révision (une seule fois : la promesse est gardée ;
     un échec n'est pas gardé, pour que « Réessayer » refasse la requête). */
  let loading = null;
  function loadCourse(force) {
    if (loading && !force) return loading;
    const p = (async () => {
      const res = await fetch(Course.COURSE_URL, {cache: 'no-cache'});
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const c = parseCourse(await res.text());
      if (!unitsOf(c).length) throw new Error('aucune unité trouvée');
      return c;
    })();
    loading = p;
    p.catch(() => { if (loading === p) loading = null; });
    return p;
  }

  /* ------------------------------ lecture de la progression ------------------------------ */
  const rec = (store, id) => store['ex_' + id] || null;
  const isDone = (store, id) => { const r = rec(store, id); return !!(r && r.tot); };
  const score = (store, id) => { const r = rec(store, id); return r && r.tot ? r.ok / r.tot : 0; };
  const isWeak = (store, id) => { const r = rec(store, id); return !!(r && r.tot && (r.stars === 1 || r.ok / r.tot < 0.6)); };
  const sig = (store, id) => { const r = rec(store, id) || {}; return [r.ok, r.tot, r.stars, r.last].join('/'); };
  const stepDone = (store, s) => s.exIds.every(id => isDone(store, id));

  /* les pistes d'une unité : la leçon (documents / vocabulaire / grammaire, phonétique intercalée), Parler, Cahier */
  function tracksOf(course, n) {
    const u = course[n];
    /* Les chapitres du livre de grammaire (étapes .gp) suivent la leçon du cours qui les précède dans le panneau :
       ils forment avec elle un seul « groupe », que rien (vocabulaire, document, phonétique) ne vient couper. */
    const gram = [];
    u.gram.forEach(s => { if (s.gp && gram.length) gram[gram.length - 1].push(s); else gram.push([s]); });
    const D = u.docs.map(s => [s]), G = [];
    for (let i = 0; i < Math.max(u.voc.length, gram.length); i++) {        // voc1, gram1, voc2, gram2…
      if (u.voc[i]) G.push([u.voc[i]]);
      if (gram[i]) G.push(gram[i]);
    }
    const learn = [], P = u.phon || [];
    let k = 0, since = 0;                                                  // une étape de phonétique toutes les 2 étapes…
    const push = g => { g.forEach(s => learn.push(s)); since += g.length; if (since >= 2 && k < P.length) { learn.push(P[k++]); since = 0; } };
    for (let i = 0; i < Math.max(D.length, G.length); i++) {              // D1, G1, D2, G2…
      if (D[i]) push(D[i]);
      if (G[i]) push(G[i]);
    }
    while (k < P.length) learn.push(P[k++]);                              // …et les restes à la fin
    const parlerEx = [];
    u.parler.forEach(s => s.exIds.forEach(id => parlerEx.push({id, sec: s.title})));
    return {learn, parlerEx, cahier: u.cahier, parler: u.parler};
  }
  function unitStats(course, store, n) {
    const t = tracksOf(course, n);
    const core = t.learn.filter(s => !s.bonus);                            // les étapes bonus ne comptent pas pour finir l'unité
    return {
      learnDone: core.filter(s => stepDone(store, s)).length, learnTot: core.length,
      parlerDone: t.parlerEx.filter(e => isDone(store, e.id)).length, parlerTot: t.parlerEx.length,
      cahierDone: t.cahier.filter(s => stepDone(store, s)).length, cahierTot: t.cahier.length,
    };
  }
  /* leçons et Parler faits (le test de fin d'unité n'est pas compté ici) */
  function unitLessonsDone(course, store, n) {
    const s = unitStats(course, store, n);
    return s.learnTot > 0 && s.learnDone === s.learnTot && s.parlerDone >= Math.ceil(0.8 * s.parlerTot);
  }
  const hasTest = n => n >= 1 && n <= TEST_MAX_UNIT;
  const testRec = (store, id) => (store.tests && store.tests[id]) || null;
  const testPassed = (store, id) => !!(testRec(store, id) && testRec(store, id).passed);
  function unitFinished(course, store, n) {
    return unitLessonsDone(course, store, n) && (!hasTest(n) || testPassed(store, String(n)));
  }

  /* ------------------------------ le parcours (path) d'une unité ------------------------------ */

  /* lien d'une étape en mode leçon : revision?u=N&tab=<panneau>&step=<rang dans le panneau>&go=<1er exercice>&mode=lesson&from=app */
  const lessonHref = (unit, panel, index, firstId) =>
    `revision?u=${unit}&tab=${panel}&step=${index}&go=${encodeURIComponent(firstId)}&mode=lesson&from=app`;

  /* Les arrêts du parcours d'une unité, dans l'ordre :
       la piste « leçon » (docs/voc/gram intercalés + phonétique toutes les 2 étapes, comme le plan) comme colonne vertébrale ;
       après chaque 2 arrêts de leçon, la prochaine étape de Parler ; après chaque 3, la prochaine étape de Cahier ;
       les restes de Parler, puis de Cahier, à la fin ; puis le test de l'unité (et le bilan après les unités 2 et 4).
     Chaque arrêt : {key, kind, panel, unit, title, letter?, exIds, est, done, weak, href, index?}. */
  function pathOf(unit, course, store) {
    unit = +unit;
    const u = course[unit];
    if (!u) return [];
    store = store || {};
    const t = tracksOf(course, unit);
    const stops = [];
    const stopOf = (s, kind) => {
      const index = u[s.panel].indexOf(s);                  // rang dans le tableau d'étapes de son panneau
      const first = s.exIds[0];
      const st = {
        key: `u${unit}-${s.panel}-${first}`, kind, panel: s.panel, unit, title: s.title,
        exIds: s.exIds.slice(), est: s.est, done: stepDone(store, s), weak: s.exIds.some(id => isWeak(store, id)),
        href: lessonHref(unit, s.panel, index, first), index,
      };
      if (s.letter) st.letter = s.letter;
      if (s.gp) st.gp = s.gp;
      if (s.bonus) st.bonus = true;
      return st;
    };
    /* « Mots de l'unité » : le vocabulaire de l'unité coupé en paquets (environ un toutes les 2 leçons, 10 à 25 mots
       chacun), répartis le long du chemin et travaillés dans Mémoire (répétition espacée). Un paquet est fait quand
       chacun de ses mots a été vu au moins une fois. */
    const L = t.learn.length;
    const packs = motsStops(unit, store, L);
    let pi = 0, ci = 0, mi = 0, n = 0;
    const nextParler = () => { if (pi < t.parler.length) stops.push(stopOf(t.parler[pi++], 'parler')); };
    const nextCahier = () => { if (ci < t.cahier.length) stops.push(stopOf(t.cahier[ci++], 'cahier')); };
    const nextMots = () => { if (mi < packs.length) stops.push(packs[mi++]); };
    t.learn.forEach((s, i) => {
      stops.push(stopOf(s, 'learn'));
      n++;
      /* un chapitre du livre de grammaire suit : rien ne s'intercale entre la leçon du cours et lui (les arrêts dus attendent) */
      const nx = t.learn[i + 1];
      if (nx && nx.gp) return;
      while (mi < Math.ceil(n * packs.length / L)) nextMots();
      while (pi < Math.floor(n / 2) && pi < t.parler.length) nextParler();
      while (ci < Math.floor(n / 3) && ci < t.cahier.length) nextCahier();
    });
    while (mi < packs.length) nextMots();
    while (pi < t.parler.length) nextParler();
    while (ci < t.cahier.length) nextCahier();

    if (hasTest(unit)) {
      stops.push({key: `u${unit}-test`, kind: 'test', panel: 'test', unit, title: 'Test de fin d\'unité', exIds: [], est: 25,
        done: testPassed(store, String(unit)), weak: false, href: `test?u=${unit}&from=app`});
      const b = BILANS[unit];
      if (b) {
        stops.push({key: `bilan-${b.id}`, kind: 'bilan', panel: 'test', unit, title: `Bilan ${b.label}`, exIds: [], est: 25,
          done: testPassed(store, b.id), weak: false, href: `test?id=${b.id}&from=app`});
      }
    }
    return stops;
  }

  /* les paquets de mots de l'unité (vocabPacks, dans vocab.js, chargé par la page — sinon pas d'arrêt « Mots ») */
  function motsStops(unit, store, nLearn) {
    if (typeof vocabPacks !== 'function') return [];
    const W = (vocabPacks(unit, 1)[0] || []).length;
    const K = Math.max(1, Math.min(Math.max(Math.ceil(nLearn / 2), Math.ceil(W / 25)), Math.ceil(W / 10)));
    const P = vocabPacks(unit, K).map(p => p.slice());
    if (!P.length) return [];
    /* + les mots que vous avez ajoutés à cette unité (« ＋ Mémoire » / 📇) : dans le dernier paquet */
    const inBook = new Set([].concat.apply([], P));
    const per = (store && store.memPerso) || {};
    Object.keys(per).forEach(k => { const w = per[k]; if (w && w.fr && String(w.u) === String(unit) && !inBook.has(k)) P[P.length - 1].push(k); });
    const mem = (store && store.memoire) || {}, now = Date.now();
    return P.map((keys, i) => {
      const seen = keys.filter(k => mem[k]).length, due = keys.filter(k => mem[k] && mem[k].due <= now).length;
      return {key: `u${unit}-mots-${i + 1}`, kind: 'mots', panel: 'mots', unit, pack: i + 1, packs: P.length,
        title: `Mots de l'unité ${i + 1}/${P.length}`, exIds: [], est: 10, done: seen === keys.length, weak: false,
        href: `memoire?u=${unit}&pack=${i + 1}&of=${P.length}&from=app`, seen, total: keys.length, due};
    });
  }

  /* le premier arrêt pas encore fait (null si tout est fait). L'arrêt « Mots de l'unité » ne compte pas : il avance au rythme
     de Mémoire (15 mots nouveaux par jour), sur plusieurs jours — il ne doit pas bloquer le reste du chemin. */
  /* Les étapes bonus (chapitres facultatifs du livre de grammaire) ne bloquent pas non plus : on peut les passer. */
  const currentStop = stops => stops.find(s => !s.done && s.kind !== 'mots' && !s.bonus) || null;
  /* {done, total, pct} sur tous les arrêts, test et bilan compris — sauf les paquets « Mots », qui avancent au rythme de
     Mémoire (15 mots nouveaux par jour) et empêcheraient l'unité d'atteindre 100 % bien après son test,
     et sauf les étapes bonus, facultatives */
  function unitProgress(stops) {
    stops = stops.filter(s => s.kind !== 'mots' && !s.bonus);
    const total = stops.length, done = stops.filter(s => s.done).length;
    return {done, total, pct: total ? Math.round(100 * done / total) : 0};
  }

  const Course = {
    LS, COURSE_URL, TEST_MAX_UNIT, BILANS, PANELS,
    readStore,
    cleanText, isGradable, makeStep, stepsOfPanel, parseCourse, unitsOf, loadCourse,
    rec, isDone, score, isWeak, sig, stepDone,
    tracksOf, unitStats, unitLessonsDone, hasTest, testRec, testPassed, unitFinished,
    lessonHref, pathOf, currentStop, unitProgress,
  };
  window.Course = Course;
})();
