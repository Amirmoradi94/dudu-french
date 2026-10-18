/* ============================================================
   LESSON — le « mode leçon » de Unite1_Revision.html (La Troupe).

   Ne fait STRICTEMENT rien si l'adresse n'a pas  mode=lesson  : la page classique
   ne charge ni feuille de style, ni script, ni calque (aucun coût).

   Adresse :  revision?u=N&tab=<panneau>&step=<rang>&go=<1er exercice>&mode=lesson&from=app

   Principe : une « étape » du cours (un document, une carte de grammaire, un jeu de
   tuiles…) est découpée en ÉCRANS — des écrans de cours (la leçon, comment faire,
   à retenir…) et UN écran par exercice. Un lecteur plein écran (barre du haut :
   ✕ · progression · son · Léa ; bouton « Vérifier / Continuer » en bas ; feuille
   de correction ; écran « Bravo ») se pose par-dessus la page classique.

   Les vrais éléments de la page ne sont JAMAIS copiés ni reconstruits : ils
   restent à leur place dans le DOM (unité → panneau → carte → exercice), et on
   n'affiche que ceux de l'écran courant (classes lp-show / lp-path, voir le CSS).
   C'est ce qui garde intacts tous les écouteurs ET tout ce que la page calcule à
   partir de sa structure (updateProgress() → store.resume, stepOf() → le carnet
   d'erreurs, closest('.card'), renderSpkProgress…). Seule la balise <main> est
   déplacée, en bloc, dans la zone de défilement du lecteur.

   UNE QUESTION PAR ÉCRAN : un exercice qui compte au moins deux « questions » (une
   ligne à trous, un groupe de choix, un jeu d'associations…) se présente question
   par question. « Vérifier » juge la question seule (judge() de la page, data-ok,
   data-key), montre la bonne réponse si besoin ; après la dernière question, le vrai
   bouton « Vérifier » de l'exercice est cliqué : le carnet, la progression, le store
   et l'événement dudu:checked sont donc EXACTEMENT ceux de la page classique.

   Dépend de troupe.css, cast.js, sfx.js, course.js, puis troupe-widgets.css/.js
   (chargés ici, dans cet ordre, et seulement en mode leçon ; les widgets sont
   facultatifs). Cast et Sfx sont facultatifs (le lecteur marche sans), Course est
   indispensable : sans lui on reste sur la page classique.
   ============================================================ */
(function () {
  'use strict';

  var Q;
  try { Q = new URLSearchParams(location.search); } catch (e) { return; }
  if (Q.get('mode') !== 'lesson') return;
  if (window.__ulRedirect) return;        // unité verrouillée : la page classique est en train de rediriger (voir unlock.js) — aucune leçon ne démarre

  /* ------------------------------ petits outils ------------------------------ */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function guard(fn) { try { return fn(); } catch (e) { return undefined; } }
  /* anti-flash : la page garde <html class="lp-boot"> (invisible, fond papier) tant que le lecteur n'est pas posé — voir le <head> de Unite1_Revision.html.
     Appelé quand le lecteur est prêt, ou dès qu'on y renonce (page classique de secours, erreur) ; le <head> a de toute façon un filet de sécurité (4 s). */
  function reveal() {
    window.__lpWorking = false;
    guard(function () { if (window.__lpBootDone) window.__lpBootDone(); else document.documentElement.classList.remove('lp-boot'); });
  }
  window.addEventListener('error', function (e) { if (e && e.filename && /lesson\.js/.test(e.filename)) reveal(); });
  function reduced() { return guard(function () { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }) === true; }

  var IC = {
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.2 9a2.9 2.9 0 1 1 4.1 2.6c-.8.4-1.3 1-1.3 1.9"/><circle cx="12" cy="17.3" r=".6" fill="currentColor"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 16h5"/></svg>',
    flame: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M12.6 2.2c.5 3.3 4.9 5.4 4.9 10.3a5.5 5.5 0 0 1-11 0c0-2.2 1-3.7 2.2-4.8.1 1.9.9 3.2 2.1 3.6-.6-3.2-.3-6.3 1.8-9.1z"/></svg>'
  };
  /* le chef de classe de chaque unité (comme app.html / classic-cast.js) ; 'jo' = Mamie Jo (clé de Cast) */
  var LEADER = { 1: 'lea', 2: 'jo', 3: 'dubois', 4: 'lea', 5: 'lea' };

  /* ------------------------------ chargement des ressources ------------------------------ */
  function loadCss(href, id) {
    return new Promise(function (res) {
      var l = document.createElement('link'), done = false;
      function fin() { if (!done) { done = true; res(); } }
      l.rel = 'stylesheet'; l.href = href; l.id = id || 'lp-troupe-css';
      l.onload = fin; l.onerror = fin;
      document.head.appendChild(l);
      setTimeout(fin, 3500);                     // hors ligne, l'@import des polices ne doit pas bloquer le lecteur
    });
  }
  function loadScript(src) {
    return new Promise(function (res) {
      var s = document.createElement('script');
      s.src = src; s.async = false;
      s.onload = function () { res(true); };
      s.onerror = function () { res(false); };
      document.head.appendChild(s);
    });
  }

  /* ------------------------------ le lecteur ------------------------------ */
  var STYLE = [
    /* ---- la page classique s'efface, le lecteur prend toute la place ---- */
    'html.lp-on,html.lp-on body{height:100%;overflow:hidden;overscroll-behavior:none}',
    'html.lp-on .stickytop,html.lp-on #unitMenu,html.lp-on #sectionMenu,html.lp-on body>footer,html.lp-on .plan-pill{display:none!important}',
    '#lessonRoot{position:fixed;inset:0;z-index:100;display:flex;flex-direction:column;overflow:hidden}',
    '#lessonRoot [hidden]{display:none!important}',
    /* barre du haut */
    '#lessonRoot .lp-top{flex:none;padding-bottom:6px;width:100%;max-width:672px;margin:0 auto}',
    '#lessonRoot .lp-top .t-progress{height:16px}',
    '#lessonRoot .lp-face{width:44px;height:44px;flex:none;border-radius:50%;border:2px solid var(--t-rim);background:var(--t-paper);overflow:hidden}',
    '#lessonRoot .lp-face svg{display:block;width:100%;height:100%}',
    '#lessonRoot .lp-titlebar{flex:none;display:flex;align-items:center;gap:10px;padding:0 16px 8px;width:100%;max-width:672px;margin:0 auto}',
    '#lessonRoot .lp-titlebar .t-pill{flex:none}',
    '#lessonRoot .lp-title{flex:1;min-width:0;font:800 17px/1.2 var(--t-font-d);color:var(--t-ink);margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
    '#lessonRoot .lp-letter{display:inline-grid;place-items:center;width:26px;height:26px;border-radius:8px;margin-right:7px;vertical-align:1px;background:var(--t-unit);color:#2B2230;font:800 15px/1 var(--t-font-d)}',
    '#lessonRoot .lp-titlebar .t-iconbtn{width:44px;height:44px}',
    /* zone de défilement */
    '#lessonRoot .lp-stage{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:4px 16px 28px;outline:none;scroll-behavior:auto}',
    '#lessonRoot .lp-stage.lp-fb{padding-bottom:calc(250px + env(safe-area-inset-bottom,0px))}',
    '#lessonRoot .lp-in{max-width:640px;margin:0 auto}',
    '#lessonRoot main{max-width:none!important;margin:0!important;padding:0!important;display:block}',
    '#lessonRoot .lp-path>:not(.lp-path):not(.lp-show){display:none!important}',
    '#lessonRoot .lp-collapsed{display:none!important}',
    '#lessonRoot .panel{animation:none}',
    '#lessonRoot .lp-path.card{background:none;border:0;box-shadow:none;padding:0;margin:0;border-radius:0}',
    '#lessonRoot .lp-path>.lp-show{margin-left:0;margin-right:0}',
    /* personnage + bulle (écrans de cours) */
    '#lessonRoot .lp-intro{display:flex;align-items:flex-end;gap:10px;margin:2px 0 16px}',
    '#lessonRoot .lp-intro[hidden]{display:none}',
    '#lessonRoot .lp-who{flex:none;width:88px;height:88px}',
    '#lessonRoot .lp-who svg{display:block;width:100%;height:100%;overflow:visible}',
    '#lessonRoot .lp-intro .t-bubble{flex:1;margin-bottom:16px;font:800 20px/1.15 var(--t-font-d);letter-spacing:-.01em;padding:12px 16px}',
    '#lessonRoot .lp-intro .t-bubble small{display:block;margin-top:3px;font:600 13.5px/1.35 var(--t-font-b);color:var(--t-ink-2);letter-spacing:0}',
    '#lessonRoot .lp-intro .t-bubble--l::before{top:auto;bottom:16px}',
    /* document replié / déplié (exercices) */
    '#lessonRoot .lp-doc{margin:0 0 14px}',
    '#lessonRoot .lp-doc button{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:8px 14px;border-radius:14px;border:2px solid var(--t-line);background:var(--t-paper);color:var(--t-teal-ink);font:800 14.5px/1 var(--t-font-d);cursor:pointer}',
    '#lessonRoot .lp-doc button svg{width:20px;height:20px}',
    '#lessonRoot .lp-doc button[aria-expanded="true"]{border-color:var(--t-teal)}',
    '#lessonRoot .lp-doc .lp-chev{display:inline-block;transition:transform .2s}',
    '#lessonRoot .lp-doc button[aria-expanded="true"] .lp-chev{transform:rotate(180deg)}',
    /* blocs de cours = cartes */
    '#lessonRoot .lp-show{margin:0 0 16px!important;max-width:100%}',
    '#lessonRoot .lp-show.lesson,#lessonRoot .lp-show.howto,#lessonRoot .lp-show.recap,#lessonRoot .lp-show.box,#lessonRoot .lp-show.ex,#lessonRoot .lp-show.audio,#lessonRoot .lp-show.rtext,#lessonRoot .lp-show.card,#lessonRoot .lp-show.conj{',
    '  background:var(--t-paper);border:2px solid var(--t-rim);border-radius:22px;box-shadow:0 4px 0 var(--t-edge);padding:16px;color:var(--t-ink)}',
    '#lessonRoot .lp-show.lesson{border-left-width:2px;background:var(--t-paper)}',
    '#lessonRoot .lp-show.box.tip{background:var(--t-mustard-l)}',
    '#lessonRoot .lp-show.box.comm{background:var(--t-teal-l)}',
    '#lessonRoot .lp-show.box.warn{background:var(--t-tomato-l)}',
    '#lessonRoot .lp-show.howto{background:var(--t-mustard-l)}',
    '#lessonRoot .lp-show.recap{background:var(--t-unit-l,var(--t-teal-l))}',
    '#lessonRoot .lp-show.ex.spk-flash{animation:none}',
    '#lessonRoot .lesson>h4,#lessonRoot .howto>h4,#lessonRoot .recap>h4,#lessonRoot .box>h4{display:inline-block;margin:0 0 12px;padding:6px 10px;border-radius:99px;font:800 12px/1.2 var(--t-font-d);letter-spacing:.1em;text-transform:uppercase;background:var(--t-teal-l);color:var(--t-teal-ink)}',
    '#lessonRoot .howto>h4{background:var(--t-paper);color:var(--t-mustard-ink)}',
    '#lessonRoot .recap>h4{background:var(--t-paper);color:var(--t-unit-ink,var(--t-teal-ink))}',
    '#lessonRoot .box.tip>h4{background:var(--t-paper);color:var(--t-mustard-ink)}',
    '#lessonRoot .box.warn>h4{background:var(--t-paper);color:var(--t-tomato-ink)}',
    '#lessonRoot .lesson p,#lessonRoot .howto li,#lessonRoot .recap li,#lessonRoot .box p,#lessonRoot .box li{font-size:16px;line-height:1.55}',
    '#lessonRoot .lesson .kp{display:block;margin:10px 0;padding:10px 12px;background:var(--t-surface);border:2px solid var(--t-line);border-radius:14px;font-size:16px}',
    '#lessonRoot .lesson .kp b,#lessonRoot .conj b{color:var(--t-tomato-ink)}',
    '#lessonRoot .howto ol,#lessonRoot .recap ul{padding-left:22px}',
    '#lessonRoot .conj .c{background:var(--t-surface);border:2px solid var(--t-line);border-radius:14px}',
    '#lessonRoot .conj .c h5{background:var(--t-teal)}',
    '#lessonRoot .imgbox{border:2px solid var(--t-line);border-radius:16px;background:var(--t-surface)}',
    '#lessonRoot .imgbox{float:none!important;margin:0 auto 14px!important;max-width:min(100%,360px)!important}',
    '#lessonRoot .scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}',
    '#lessonRoot table.t th{background:var(--t-teal);color:#fff}',
    '#lessonRoot table.t th,#lessonRoot table.t td{border-color:var(--t-line)}',
    '#lessonRoot .sms .b{background:var(--t-surface);border-color:var(--t-line)}',
    /* exercices : cibles de 44 px, texte ≥ 16 px (pas de zoom iOS) */
    '#lessonRoot .ex .qn{font:800 17px/1.35 var(--t-font-d);align-items:flex-start;margin-bottom:12px}',
    '#lessonRoot .ex .qn .num{background:var(--t-unit,var(--t-mustard));color:#2B2230;border-radius:9px;min-width:28px;height:28px;font:800 14px/1 var(--t-font-d)}',
    '#lessonRoot .ex .inp{min-height:44px;font-size:16px;border:2px solid var(--t-line);background:var(--t-surface);color:var(--t-ink);border-radius:12px;padding:8px 12px}',
    '#lessonRoot .ex .inp:focus{border-color:var(--t-teal);box-shadow:0 0 0 4px var(--t-teal-l);background:var(--t-surface)}',
    '#lessonRoot .ex .inp.ok{border-color:var(--t-teal);background:var(--t-ok-bg)}',
    '#lessonRoot .ex .inp.no{border-color:var(--t-tomato);background:var(--t-bad-bg)}',
    '#lessonRoot .ex .inp.near{border-color:var(--t-mustard-d);background:var(--t-mustard-l)}',
    '#lessonRoot .ex .inp.w-l{max-width:100%}',
    '#lessonRoot .ex .opts{gap:10px}',
    '#lessonRoot .ex .opts.col{align-items:stretch}',
    '#lessonRoot .ex .opt{min-height:48px;padding:10px 14px;font-size:16px;border:2px solid var(--t-line);background:var(--t-surface);color:var(--t-ink);border-radius:14px;box-shadow:0 3px 0 var(--t-line)}',
    '#lessonRoot .ex .opt.sel{border-color:var(--t-teal);background:var(--t-teal-l);color:var(--t-teal-ink)}',
    '#lessonRoot .ex .opt.ok{border-color:var(--t-teal);background:var(--t-ok-bg);color:var(--t-ok-fg)}',
    '#lessonRoot .ex .opt.no{border-color:var(--t-tomato);background:var(--t-bad-bg);color:var(--t-bad-fg)}',
    '#lessonRoot .ex .mitem{min-height:48px;padding:10px 38px 10px 12px;font-size:16px;border:2px solid var(--t-line);background:var(--t-surface);color:var(--t-ink);border-radius:14px}',
    '#lessonRoot .ex .mitem.armed{border-color:var(--t-teal);box-shadow:0 0 0 3px var(--t-teal-l)}',
    '#lessonRoot .ex .mitem.ok{border-color:var(--t-teal)}',
    '#lessonRoot .ex .mitem.no{border-color:var(--t-tomato)}',
    '#lessonRoot .ex .match{gap:10px 12px}',
    '#lessonRoot .ex .exbar{margin-top:12px;gap:8px}',
    '#lessonRoot .ex .exbar .check{display:none!important}',
    '#lessonRoot .ex .exbar .reveal{min-height:44px}',
    '#lessonRoot .ex .hint.show{background:var(--t-surface);border-left:4px solid var(--t-mustard);border-radius:0 12px 12px 0;color:var(--t-ink)}',
    '#lessonRoot .ex .score{font:800 14px/1.2 var(--t-font-d)}',
    /* une question à la fois : les autres questions, la barre « Réponses » et l'indice restent cachés ; la question jugée est verrouillée */
    '#lessonRoot .lp-ihide{display:none!important}',
    '#lessonRoot .lp-ilock .inp,#lessonRoot .lp-ilock .opt,#lessonRoot .lp-ilock .mitem{pointer-events:none}',      // la traduction « EN » de la phrase reste cliquable
    '#lessonRoot .lp-bar .lp-primary.lp-shake{animation:lp-shake .4s}',
    '@keyframes lp-shake{0%,100%{transform:none}20%{transform:translateX(-7px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(3px)}}',
    '#lessonRoot .t-feedback.lp-near{background:var(--t-mustard-l);color:var(--t-mustard-ink)}',
    '#lessonRoot .t-feedback.lp-near .t-btn:not(.t-btn--secondary){--bg:var(--t-mustard);--edge:var(--t-mustard-d);--fg:#2B2230}',
    '#lessonRoot .t-feedback__text em+em{margin-left:4px}',
    '#lessonRoot .lp-fb-hint{margin:8px 0 0;font:600 13.5px/1.4 var(--t-font-b);color:inherit}',
    '#lessonRoot .lp-fb-hint em{font-style:normal;font-weight:800}',
    '#lessonRoot .btn,#lessonRoot .mini,#lessonRoot .speak-rec,#lessonRoot .spk-start,#lessonRoot .au-tools .mini{min-height:44px}',
    '#lessonRoot .btn{border-radius:14px;padding:9px 16px;font-size:15px}',
    '#lessonRoot .mini{padding:6px 12px;font-size:13px;border-radius:12px}',
    '#lessonRoot .enbtn,#lessonRoot button.speak{position:relative}',
    '#lessonRoot .enbtn::after,#lessonRoot button.speak::after{content:"";position:absolute;inset:-9px -7px}',
    '#lessonRoot .enbtn{font-size:11px;padding:3px 7px;margin-left:8px}',
    '#lessonRoot .en{font-size:15px}',
    '#lessonRoot .audio{background:var(--t-surface);border:2px solid var(--t-line);border-radius:18px;box-shadow:none}',
    '#lessonRoot .lp-show.audio{background:var(--t-paper);border:2px solid var(--t-rim);box-shadow:0 4px 0 var(--t-edge)}',
    '#lessonRoot .au-play{width:48px;height:48px}',
    '#lessonRoot .au-bar{height:10px}',
    '#lessonRoot .rtext{font-size:17px;line-height:1.6}',
    '#lessonRoot .rd-gloss{margin-top:10px}',
    /* barre d'action du bas */
    '#lessonRoot .lp-bar{flex:none;position:relative;z-index:50;display:flex;align-items:center;gap:10px;padding:12px 16px calc(12px + env(safe-area-inset-bottom,0px));',
    '  background:var(--t-cream);border-top:2px solid var(--t-line)}',
    '#lessonRoot .lp-bar .lp-bar-in{max-width:640px;width:100%;margin:0 auto;display:flex;align-items:center;gap:10px}',
    '#lessonRoot .lp-bar .t-btn{margin:0 0 5px;flex:1 1 auto}',
    '#lessonRoot .lp-bar .t-btn--secondary{flex:0 0 auto}',
    '#lessonRoot .lp-bar .t-iconbtn{flex:none;margin-bottom:5px}',
    '#lessonRoot .lp-bar .t-iconbtn[disabled]{opacity:.4;cursor:default}',
    '#lessonRoot .lp-bar .lp-primary{--bg:var(--t-teal);--edge:var(--t-teal-d)}',
    '#lessonRoot .lp-bar .lp-primary.is-check{--bg:var(--t-tomato);--edge:var(--t-tomato-d)}',
    '#lessonRoot.is-fb .lp-bar{visibility:hidden}',
    /* feuille de correction + confirmation */
    '#lessonRoot .t-feedback__row{grid-column:1/-1;display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:10px;margin-top:8px}',
    '#lessonRoot .t-feedback__row .t-btn{margin-top:0}',
    '#lessonRoot .t-feedback .t-btn--secondary{--bg:var(--t-paper);--fg:var(--t-bad-fg);--edge:var(--t-line)}',
    '#lessonRoot .t-feedback--ok .t-btn:not(.t-btn--secondary){--bg:var(--t-teal);--edge:var(--t-teal-d)}',
    '#lessonRoot .t-feedback--bad .t-btn:not(.t-btn--secondary){--bg:var(--t-tomato);--edge:var(--t-tomato-d)}',
    '#lessonRoot .t-feedback__text{font-weight:700}',
    '#lessonRoot .lp-sheet-t{margin:6px 0 4px}',
    '#lessonRoot .lp-sheet-btns{display:grid;gap:10px;margin-top:18px}',
    '#lessonRoot .lp-sheet-btns .t-btn{margin:0 0 5px}',
    /* le personnage « débarque » avec sa bulle : le texte de la bulle est exactement ce que dit la voix */
    '#lessonRoot .t-feedback__char.lp-pop{animation:lp-pop .55s cubic-bezier(.2,1.5,.4,1) .08s both}',
    '@keyframes lp-pop{0%{transform:scale(.2) rotate(-14deg);opacity:0}55%{opacity:1}100%{transform:none;opacity:1}}',
    '#lessonRoot .lp-say{display:inline-block;max-width:100%;padding:8px 14px;border-radius:18px;box-shadow:0 3px 0 var(--t-edge);font:800 20px/1.15 var(--t-font-d);letter-spacing:-.01em;color:var(--t-ink)}',
    '#lessonRoot .lp-say::before{left:-9px;top:50%;margin-top:-8px}',
    '#lessonRoot .lp-say.lp-pop{transform-origin:0 60%;animation:lp-say .42s cubic-bezier(.2,1.4,.4,1) .2s both}',
    '@keyframes lp-say{0%{transform:scale(.4);opacity:0}100%{transform:none;opacity:1}}',
    '#lessonRoot .t-feedback__body{display:grid;gap:6px;justify-items:start}',
    '#lessonRoot .lp-streak{flex:none;display:block;max-width:0;margin-left:-12px;opacity:0;overflow:hidden;white-space:nowrap;transition:max-width .35s cubic-bezier(.2,1.2,.4,1),margin .35s,opacity .25s;pointer-events:none}',
    '#lessonRoot .lp-streak.is-on{max-width:140px;margin-left:0;opacity:1}',
    '#lessonRoot .lp-streak .t-chip{padding:6px 10px 6px 7px;font-size:13px}',
    '#lessonRoot .lp-streak svg{width:16px;height:16px;flex:none}',
    '#lessonRoot .lp-streak.is-on .t-chip{animation:lp-chip .5s cubic-bezier(.2,1.5,.4,1) both}',
    '@keyframes lp-chip{0%{transform:scale(.5)}100%{transform:none}}',
    '#lessonRoot .lp-sayline.lp-pop{animation:lp-say .4s cubic-bezier(.2,1.4,.4,1) both}',
    '#lessonRoot .lp-sayline{margin:-4px 0 0;min-height:1.4em;font:800 17px/1.3 var(--t-font-d);color:var(--t-ink-2)}',
    /* écran Bravo */
    '#lessonRoot .lp-bravo{position:relative;flex:1;min-height:0;overflow-y:auto;padding:8px 16px calc(24px + env(safe-area-inset-bottom,0px))}',
    '#lessonRoot .lp-bravo-in{position:relative;z-index:2;max-width:560px;margin:0 auto;min-height:100%;display:flex;flex-direction:column;align-items:center;text-align:center;gap:14px}',
    '#lessonRoot .lp-bravo .t-confetti{position:fixed;inset:0;z-index:1}',
    '#lessonRoot .lp-score{display:grid;place-items:center;gap:6px;margin-top:6px}',
    '#lessonRoot .lp-pct{font:800 64px/1 var(--t-font-d);letter-spacing:-.03em;color:var(--t-unit-ink,var(--t-tomato-ink))}',
    '#lessonRoot .lp-stars{font-size:38px;line-height:1;letter-spacing:6px;color:var(--t-mustard)}',
    '#lessonRoot .lp-stars i{font-style:normal;color:var(--t-track)}',
    '#lessonRoot .lp-troupe{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;width:100%;margin:6px 0 2px}',
    '#lessonRoot .lp-troupe figure{margin:0;display:grid;justify-items:center;gap:2px}',
    '#lessonRoot .lp-troupe .lp-c{width:min(120px,28vw);aspect-ratio:360/330}',
    '#lessonRoot .lp-troupe figcaption{font:800 13px/1 var(--t-font-d);color:var(--t-ink-2)}',
    '#lessonRoot .lp-calm-who{width:min(190px,52vw);aspect-ratio:360/330;margin:18px 0 4px}',
    '#lessonRoot .lp-calm-who svg{display:block;width:100%;height:100%;overflow:visible}',
    '#lessonRoot .lp-bravo-btns{width:100%;display:grid;gap:12px;margin-top:auto;padding-top:10px}',
    '#lessonRoot .lp-bravo-btns .t-btn{margin:0 0 5px}',
    '#lessonRoot.is-bravo .lp-stage,#lessonRoot.is-bravo .lp-bar,#lessonRoot.is-bravo .lp-titlebar{display:none}',
    '#lessonRoot:not(.is-bravo) .lp-bravo{display:none}',
    '@media (min-width:700px){#lessonRoot .lp-stage{padding-top:10px}#lessonRoot .lp-who{width:104px;height:104px}}',
    '@media (prefers-reduced-motion:reduce){#lessonRoot *{animation:none!important;transition:none!important}}'
  ].join('\n');

  var TOAST_CSS = [
    '.lp-toast{position:fixed;left:50%;bottom:calc(20px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:300;max-width:min(92vw,420px);',
    '  background:#2B2230;color:#FFF5E8;border-radius:16px;padding:12px 16px;font:700 14.5px/1.35 system-ui,-apple-system,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.3);text-align:center}',
  ''].join('\n');

  /* texte, poids d'un bloc (sans les traductions « EN ») */
  function weight(node) {
    var c = node.cloneNode(true);
    $$('.en,.enbtn', c).forEach(function (x) { x.remove(); });
    return c.textContent.replace(/\s+/g, ' ').trim().length + 260 * $$('img', node).length + 120 * $$('.audio', node).length;
  }

  /* ---- classement des éléments d'une étape ---- */
  var SPECIAL = '.dic, .spk, .speak-q, .conv';
  function kindOf(e) {
    if (e.matches('.ex')) return 'ex';
    if (e.matches('.doc-head, h3, p.sub')) return 'head';
    if (e.matches('.lesson')) return 'lesson';
    if (e.matches('.howto')) return 'howto';
    if (e.matches('.recap')) return 'recap';
    if (e.matches('.box.comm')) return 'comm';
    if (e.matches('.box.warn')) return 'warn';
    if (e.matches('.box.tip')) return 'tip';
    if (e.matches('.conj')) return 'conj';
    if (e.matches('.audio, .imgbox, .sms, .rtext, .rd-gloss, .exbar')) return 'media';
    if (e.matches('.grid')) return e.querySelector('.audio, .imgbox, .sms, .rtext') ? 'media' : 'words';
    if (e.matches('.card')) return 'practice';
    if (e.matches('.box')) return 'passage';
    if (e.matches('.scroll, table, h5')) return 'table';
    if (e.matches('h4, p, .note')) return 'lead';
    if (e.matches('.fc-tools, .fcgrid')) return 'cards';
    if (e.matches('details, textarea')) return 'extra';
    return 'teach';
  }
  /* éléments qu'on ne montre jamais (rien d'utile en mode leçon) */
  function skippable(e) { return !!e.querySelector('.parler-cta') && !e.querySelector('.ex') && !e.matches('.ex'); }

  /* l'étape, aplatie : les cartes et conteneurs d'exercices sont ouverts, l'ordre du document est gardé */
  function flatten(els, out) {
    els.forEach(function (e) {
      if (e.nodeType !== 1) return;
      if (!e.matches('.ex') && e.querySelector('.ex')) flatten(Array.prototype.slice.call(e.children), out);
      else out.push(e);
    });
    return out;
  }

  var LABEL = {
    lesson: ['lea', 'La leçon'], howto: ['lea', 'Comment faire'], recap: ['jo', 'À retenir'], comm: ['jo', 'À toi !'],
    tip: ['dubois', 'Astuce'], warn: ['dubois', 'Attention !'], conj: ['dubois', 'La conjugaison'], table: ['dubois', 'Le tableau'],
    cards: ['dubois', 'Cartes à retourner'], media: ['lea', 'Le document'], lead: ['lea', 'À toi !'], passage: ['lea', 'Le texte'], read: ['lea', 'Lis le texte'],
    extra: ['lea', 'À toi !'], teach: ['lea', 'Regarde'], practice: ['lea', 'On s’entraîne'], words: ['lea', 'Les mots'], end: ['lea', 'Pour finir']
  };
  var SUB = {
    lesson: 'Lis, puis écoute avec 🔈.', howto: 'Suis les étapes, dans l’ordre.', recap: 'Les points importants.',
    comm: 'Parle ou écris à ton tour.', cards: 'Touche une carte pour la retourner.', words: 'Touche 🔈 pour écouter la liste.',
    practice: 'Écoute, puis répète à voix haute.', read: 'Écoute avec 🔈, puis réponds.'
  };
  var TEACH_LIMIT = 850;

  /* l'étape → la liste des écrans */
  function buildScreens(step) {
    var items = flatten(step.els.slice(), []);
    var screens = [], buf = [], ctx = [], ctxShown = false;

    function newTeach(kind) {
      if (kind === 'words' && step.panel !== 'voc') kind = 'teach';
      var l = LABEL[kind] || LABEL.teach; return { type: 'teach', nodes: [], weight: 0, blocks: 0, kind: kind, char: l[0], label: l[1], sub: SUB[kind] || '' }; }

    /* items sans exercice → écrans de cours ; le groupe final avant un exercice (titres, consignes, textes) revient à l'exercice */
    function flush(nextIsEx) {
      var list = buf.filter(function (e) { return kindOf(e) !== 'head' && !skippable(e); });
      buf = [];
      var ts = list.length;
      if (nextIsEx) {
        while (ts > 0 && /^(lead|passage|media)$/.test(kindOf(list[ts - 1]))) ts--;
      }
      var lead = list.slice(ts), body = list.slice(0, ts);
      var cur = null, pend = [];
      body.forEach(function (e) {
        var k = kindOf(e);
        if (k === 'media') { pend.push(e); return; }
        var w = weight(e);
        var alone = k === 'cards';
        if (k === 'words' && step.panel !== 'voc') k = 'teach';
        if (!cur || alone || cur.kind === 'cards' || k === 'recap' || cur.weight + w > TEACH_LIMIT || cur.blocks >= 3) {
          if (cur) screens.push(cur);
          cur = newTeach(k === 'extra' || k === 'teach' ? (pend.length ? 'media' : k) : k);
        }
        if (pend.length) { Array.prototype.push.apply(cur.nodes, pend); pend = []; }
        cur.nodes.push(e); cur.weight += w; cur.blocks++;
      });
      if (cur) screens.push(cur);
      if (pend.length) {                                    // des médias sans cours derrière
        if (nextIsEx) lead = pend.concat(lead); else { var m = newTeach('media'); m.nodes = pend; screens.push(m); }
        if (!nextIsEx) pend = [];
      }
      /* médias du groupe courant (les suivants remplacent les précédents) */
      var media = lead.filter(function (e) { var k = kindOf(e); return k === 'media' || k === 'passage'; });
      var anyMedia = body.some(function (e) { return kindOf(e) === 'media'; }) || media.length;
      var readScreen = false;
      if (nextIsEx && media.some(function (m) { return m.matches('.rtext'); })) {      // une lecture : le texte d'abord, seul
        var rd = newTeach('read'); rd.nodes = media.slice(); screens.push(rd); readScreen = true;
      }
      if (anyMedia) {
        var bodyMedia = body.filter(function (e) { return kindOf(e) === 'media'; });
        ctx = bodyMedia.concat(media);
        ctxShown = (bodyMedia.length > 0 && !media.length) || readScreen;      // déjà montré en entier par un écran de cours → replié ensuite
      }
      return lead.filter(function (e) { var k = kindOf(e); return k !== 'media' && k !== 'passage'; });
    }

    items.forEach(function (e) {
      if (kindOf(e) !== 'ex') { buf.push(e); return; }
      var lead = flush(true);
      var special = e.matches(SPECIAL);
      var id = e.dataset.id || '';
      var sc = {
        type: 'ex', ex: e, id: id, special: special,
        gradable: !special && !!e.querySelector('.check, .inp, .opt, .mitem'),
        lead: lead, ctx: ctx.slice(), ctxFirst: !ctxShown
      };
      if (ctx.length) ctxShown = true;
      var nodes = ctx.concat(lead);
      nodes.push(e);
      /* ordre du DOM : on trie par position pour que l'affichage suive le document */
      nodes.sort(function (a, b) { return a === b ? 0 : (a.compareDocumentPosition(b) & 4) ? -1 : 1; });
      sc.nodes = nodes;
      screens.push(sc);
    });
    flush(false);
    /* les écrans « Regarde » après le dernier exercice : une conclusion */
    var lastEx = -1;
    screens.forEach(function (sc, i) { if (sc.type === 'ex') lastEx = i; });
    screens.forEach(function (sc, i) { if (i > lastEx && sc.type === 'teach' && sc.kind === 'teach') { sc.char = LABEL.end[0]; sc.label = LABEL.end[1]; sc.sub = ''; } });
    return screens;
  }

  /* ------------------------------ les « questions » d'un exercice ------------------------------
     Une question = ce que la page juge d'un coup, de façon naturelle pour l'élève :
       · une ligne / phrase / ligne de tableau / paragraphe avec un ou plusieurs champs  (.inp[data-a])
       · un groupe de choix  (.opts qui contient un [data-ok]) avec sa phrase
       · un bloc d'associations (.match)
     Les champs et groupes qui partagent le même <li>, <tr> ou <p> forment UNE question.
     Les autres éléments de l'exercice (consigne .qn, audio, image, notes, en-tête de tableau)
     restent visibles autour de la question ; la consigne affichée est la dernière .qn qui précède.
     Moins de deux questions → null : l'exercice garde son comportement « tout d'un coup ». */
  function ptext(n) {
    if (!n) return '';
    var c = n.cloneNode(true);
    $$('.enbtn, .en, .tagn, .hint', c).forEach(function (x) { x.remove(); });
    return c.textContent.replace(/\s+/g, ' ').trim();
  }
  function hostOf(ex, el) {
    var h = el.closest('li, tr');
    if (h && h !== ex && ex.contains(h)) return h;
    h = el.closest('p');
    if (h && h !== ex && ex.contains(h)) return h;
    return el;
  }
  function extractItems(ex) {
    var graded = $$('.inp[data-a], .opts, .match', ex).filter(function (e) {
      if (e.matches('.opts')) return !!e.querySelector('[data-ok]');
      if (e.matches('.match')) return !!e.querySelector('.mcol .mitem');
      return true;
    });
    var items = [];
    graded.forEach(function (e) {
      var h = hostOf(ex, e), it = null;
      for (var k = 0; k < items.length; k++) if (items[k].host === h) { it = items[k]; break; }
      if (!it) { it = { host: h, inps: [], groups: [], matches: [], label: null, group: null, gset: false }; items.push(it); }
      if (e.matches('.match')) it.matches.push(e); else if (e.matches('.opts')) it.groups.push(e); else it.inps.push(e);
    });
    /* un hôte qui en contient un autre : on fusionne */
    for (var again = true; again;) {
      again = false;
      outer: for (var a = 0; a < items.length; a++) for (var b = 0; b < items.length; b++) {
        if (a !== b && items[a].host.contains(items[b].host)) {
          items[a].inps = items[a].inps.concat(items[b].inps); items[a].groups = items[a].groups.concat(items[b].groups); items[a].matches = items[a].matches.concat(items[b].matches);
          items.splice(b, 1); again = true; break outer;
        }
      }
    }
    /* une question « déjà faite » dans le texte (exemple : champ ou choix grisé) reste visible comme exemple, mais n'est pas posée ;
       la correction de la page la compte quand même, comme avant */
    items = items.filter(function (it) {
      var given = !it.matches.length &&
        it.inps.every(function (i) { return i.disabled; }) &&
        it.groups.every(function (g) { var o = $$('.opt', g); return o.length && o.every(function (x) { return x.disabled; }); });
      return !given;
    });
    if (items.length < 2) return null;
    /* la phrase d'un groupe de choix posé directement dans l'exercice (« a. se présentent. » + Vrai / Faux) */
    items.forEach(function (it) {
      var h = it.host, pv = h.matches('.opts') ? h.previousElementSibling : null;
      if (pv && pv.matches('p') && !pv.matches('.qn, .note') && !pv.querySelector('.inp, .opts, .match') &&
          !items.some(function (o) { return o.host === pv; })) it.label = pv;
    });
    /* l'exercice à plat, dans l'ordre du document : questions, consignes, autres éléments */
    var units = [], curQn = null;
    function itemOf(c) { for (var k = 0; k < items.length; k++) if (items[k].host === c || items[k].label === c) return k; return -1; }
    (function walk(node) {
      Array.prototype.forEach.call(node.children, function (c) {
        var k = itemOf(c);
        if (k >= 0) { if (!items[k].gset) { items[k].gset = true; items[k].group = curQn; } units.push({ el: c, item: k }); return; }
        if (items.some(function (it) { return c.contains(it.host); })) { walk(c); return; }
        if (c.matches('.exbar, .hint')) { units.push({ el: c, item: -1, hide: true }); return; }
        if (c.matches('.audio')) { units.push({ el: c, item: -1 }); return; }      // l'audio reste là pendant toutes les questions
        if (c.matches('.qn')) { curQn = c; units.push({ el: c, item: -1, qn: true }); return; }
        units.push({ el: c, item: -1, group: curQn });
      });
    })(ex);
    return { items: items, units: units };
  }

  /* ------------------------------ le lecteur ------------------------------ */
  function start() {
    var unit = parseInt(Q.get('u'), 10) || (typeof U !== 'undefined' ? U : 1);
    var tab = Q.get('tab') || 'docs';
    var stepIdx = parseInt(Q.get('step'), 10);
    var goId = Q.get('go');

    function fallback(msg) {
      var st = el('style'); st.textContent = TOAST_CSS; document.head.appendChild(st);
      var t = el('div', 'lp-toast', esc(msg));
      t.setAttribute('role', 'status');
      document.body.appendChild(t);
      setTimeout(function () { t.remove(); }, 6000);
      reveal();
    }

    if (!window.Course || !Course.stepsOfPanel) { fallback('La leçon n’a pas pu démarrer : voici la page classique.'); return; }

    var steps = guard(function () { return Course.stepsOfPanel(document, unit, tab, { keepEls: true }); }) || [];
    var step = steps[stepIdx];
    if (!step || (goId && step.exIds[0] !== goId)) {
      var found = null;
      if (goId) {
        found = steps.filter(function (s) { return s.exIds[0] === goId; })[0] || steps.filter(function (s) { return s.exIds.indexOf(goId) >= 0; })[0] || null;
      }
      step = found || (goId ? null : step);
    }
    if (!step || !step.els) { fallback('Cette leçon est introuvable : voici la page classique.'); return; }

    var screens = buildScreens(step);
    if (!screens.length) { fallback('Cette leçon est vide : voici la page classique.'); return; }

    /* les exercices à plusieurs questions se présentent question par question (voir extractItems) */
    screens.forEach(function (sc) {
      if (sc.type !== 'ex' || !sc.gradable) return;
      var d = guard(function () { return extractItems(sc.ex); });
      if (d) { sc.items = d.items; sc.units = d.units; }
    });
    var before = [], totalUnits = 0;       // la barre de progression compte les questions
    screens.forEach(function (sc, i) { before[i] = totalUnits; totalUnits += sc.items ? sc.items.length : 1; });

    /* la page classique est déjà sur la bonne unité / le bon panneau (lien profond) ; on s'en assure */
    guard(function () { if (typeof U !== 'undefined' && U !== unit && typeof setUnit === 'function') setUnit(unit, true); });
    guard(function () { if (typeof go === 'function') go(tab, true); });

    /* thème : le CSS classique ne suit que data-theme, troupe.css suit aussi l'OS → on aligne les deux */
    var rootEl = document.documentElement;
    if (!rootEl.getAttribute('data-theme')) {
      var dark = guard(function () { return window.matchMedia('(prefers-color-scheme: dark)').matches; });
      rootEl.setAttribute('data-theme', dark ? 'dark' : 'light');
    }

    var css = el('style'); css.id = 'lp-css'; css.textContent = STYLE; document.head.appendChild(css);
    rootEl.classList.add('lp-on');

    /* ---------- DOM du lecteur ---------- */
    var root = el('div', 'lp t-scope t-dotted t-u' + unit);
    root.id = 'lessonRoot';
    root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Leçon : ' + step.title);
    root.innerHTML =
      '<header class="t-topbar lp-top">' +
        '<button type="button" class="t-iconbtn lp-close" aria-label="Quitter la leçon">' + IC.close + '</button>' +
        '<div class="t-progress t-progress--unit" role="progressbar" aria-label="Progression de la leçon" aria-valuemin="0" aria-valuemax="' + screens.length + '" aria-valuenow="0"><i></i></div>' +
        '<span class="lp-streak" role="status" aria-live="polite"><span class="t-chip t-chip--fire">' + IC.flame + '<b></b></span></span>' +
        '<button type="button" class="t-mute" aria-label="Couper le son"></button>' +
        '<div class="lp-face"></div>' +
      '</header>' +
      '<div class="lp-titlebar"><span class="t-pill t-pill--unit">Unité ' + unit + '</span>' +
        '<h1 class="lp-title"></h1>' +
        '<button type="button" class="t-iconbtn lp-help" aria-label="Poser une question au tuteur" title="Poser une question au tuteur">' + IC.help + '</button></div>' +
      '<div class="lp-stage" tabindex="-1"><div class="lp-in"><div class="lp-intro" hidden></div><div class="lp-doc" hidden></div></div></div>' +
      '<div class="lp-bar"><div class="lp-bar-in">' +
        '<button type="button" class="t-iconbtn lp-prev" aria-label="Écran précédent">' + IC.back + '</button>' +
        '<button type="button" class="t-btn t-btn--secondary t-btn--sm lp-second" hidden></button>' +
        '<button type="button" class="t-btn t-btn--block lp-primary">Continuer</button>' +
      '</div></div>' +
      '<section class="lp-bravo" aria-live="polite"></section>' +
      '<div class="t-sr lp-live" aria-live="polite"></div>' +
      '<div class="t-feedback" role="status" aria-live="polite"><div class="t-feedback__in">' +
        '<div class="t-feedback__char"></div>' +
        '<div class="t-feedback__body"><div class="t-feedback__title t-bubble t-bubble--l lp-say"></div><p class="t-feedback__text"></p></div>' +
        '<div class="t-feedback__row"></div></div></div>' +
      '<div class="t-sheet" aria-hidden="true"><div class="t-sheet__scrim"></div>' +
        '<div class="t-sheet__panel" role="dialog" aria-modal="true" aria-labelledby="lpQuitT"><span class="t-sheet__grip"></span>' +
          '<h2 class="t-h2 lp-sheet-t" id="lpQuitT">Quitter la leçon ?</h2>' +
          '<p class="t-body">Ta progression est enregistrée.</p>' +
          '<div class="lp-sheet-btns"><button type="button" class="t-btn t-btn--teal t-btn--block lp-stay">Continuer la leçon</button>' +
          '<button type="button" class="t-btn t-btn--secondary t-btn--block lp-leave">Quitter</button></div>' +
        '</div></div>';
    document.body.appendChild(root);

    var stage = $('.lp-stage', root), inner = $('.lp-in', root);
    var intro = $('.lp-intro', root), docBar = $('.lp-doc', root);
    var bar = $('.lp-primary', root), second = $('.lp-second', root), prevBtn = $('.lp-prev', root);
    var fb = $('.t-feedback', root), fbChar = $('.t-feedback__char', root), fbTitle = $('.t-feedback__title', root), fbText = $('.t-feedback__text', root), fbRow = $('.t-feedback__row', root);
    var sheet = $('.t-sheet', root), muteBtn = $('.t-mute', root), faceEl = $('.lp-face', root);
    var progFill = $('.t-progress > i', root), progEl = $('.t-progress', root);

    /* la page classique (déjà construite et branchée) vient dans la zone de défilement, en bloc */
    var main = $('main');
    if (main) inner.appendChild(main);

    /* titre */
    var titleEl = $('.lp-title', root);
    var ttl = String(step.title || '').replace(/^\s*\d+\s*·\s*/, '');
    titleEl.innerHTML = (step.letter ? '<span class="lp-letter" aria-hidden="true">' + esc(step.letter) + '</span>' : '') + esc(ttl);
    /* description (page, piste…) en infobulle */
    var meta = guard(function () { var m = step.els[0] && step.els[0].querySelector('.doc-head .meta, :scope > p.sub'); return m ? m.textContent.replace(/\s+/g, ' ').trim() : ''; });
    if (meta) titleEl.title = meta;

    /* personnages (facultatifs) */
    var hasCast = !!(window.Cast && Cast.svg);
    var face = null;
    var leaderKey = LEADER[unit] || 'lea';               // clé de Cast ; Sfx accepte aussi 'jo'
    if (hasCast) face = guard(function () { return Cast.mount(faceEl, { char: leaderKey, mood: 'idle', crop: 'face' }); });
    function faceMood(m) { if (face && hasCast) guard(function () { Cast.setMood(face, m); }); }
    function sfx(name, o) { if (window.Sfx && Sfx.play) guard(function () { Sfx.play(name, o); }); }

    /* son : état + bouton */
    function syncMute() {
      var m = !!(window.Sfx && Sfx.muted);
      muteBtn.classList.toggle('is-muted', m);
      muteBtn.setAttribute('aria-pressed', m ? 'true' : 'false');
      muteBtn.setAttribute('aria-label', m ? 'Remettre le son' : 'Couper le son');
    }
    muteBtn.addEventListener('click', function () {
      if (window.Sfx && Sfx.toggle) {
        guard(function () { Sfx.toggle(); });
        /* Sfx écrit dans localStorage ; le store de la page, en mémoire, doit suivre sinon son prochain save() l'écraserait */
        guard(function () { store.sfxMuted = Sfx.muted; save(); });
        if (!Sfx.muted) sfx('tap');
      }
      syncMute();
    });
    syncMute();
    guard(function () { if (window.Sfx && Sfx.resetStreak) Sfx.resetStreak(); });      // une leçon commence une nouvelle série

    /* ---------- la troupe réagit : qui parle, la bulle, la série ---------- */
    var others = ['lea', 'dubois', 'jo'].filter(function (c) { return c !== leaderKey; });
    var otherN = 0, mistakes = 0, lastSay = null, chipT = 0;
    window.addEventListener('dudu:speak', function (e) { lastSay = (e && e.detail) || null; });
    /* le chef de classe parle presque toujours ; un autre membre de la troupe « débarque » sur une série (3, 5, 10 de suite) et de temps en temps */
    function speakerFor(name) {
      var other = others[otherN % others.length];
      if (name === 'correct' && window.Sfx && Sfx.nextIsMilestone) { otherN++; return other; }
      if (name === 'correct' && Math.random() < 0.15) { otherN++; return other; }
      return leaderKey;
    }
    /* joue le son et renvoie ce qui est dit : Sfx envoie le texte même quand le son est coupé (la bulle s'affiche toujours) */
    function say(name, o) {
      lastSay = null;
      sfx(name, o);
      var d = lastSay; lastSay = null;
      return d;
    }
    function popIn(nodes) {
      nodes.forEach(function (x) { x.classList.remove('lp-pop'); void x.offsetWidth; x.classList.add('lp-pop'); });
    }
    /* le visage du personnage qui parle + sa bulle (le titre de la feuille) */
    function showSpeaker(ch, mood, d, fallback) {
      if (hasCast) guard(function () { Cast.mount(fbChar, { char: ch, mood: mood, crop: 'face' }); });
      fbTitle.textContent = (d && d.text) || fallback;
      fbChar.setAttribute('data-who', ch);
      popIn([fbChar, fbTitle]);
    }
    /* petite pastille de série dans l'en-tête : « 3 d'affilée ! » */
    var chip = $('.lp-streak', root);
    function streakChip(d) {
      if (d && d.kind === 'wrong' && !d.streak) { clearTimeout(chipT); chip.classList.remove('is-on'); return; }   // la série est coupée
      if (!d || d.kind !== 'streak' || !d.streak) return;
      $('b', chip).textContent = d.streak + ' d’affilée !';
      chip.classList.add('is-on');
      clearTimeout(chipT);
      chipT = setTimeout(function () { chip.classList.remove('is-on'); }, 2600);
    }
    /* choisir une réponse : un petit « pop » */
    stage.addEventListener('click', function (e) {
      var t = e.target;
      if (t && t.closest && t.closest('.ex .opt, .ex .mitem')) sfx('select');
    });

    /* ---------- état ---------- */
    var idx = 0, cur = null, marks = [], fbOpen = false, fbKind = '', done = false;
    var skey = 'lp:' + unit + ':' + tab + ':' + (step.exIds[0] || '');
    function saveIdx() { guard(function () { sessionStorage.setItem(skey, String(idx)); }); }
    function clearIdx() { guard(function () { sessionStorage.removeItem(skey); }); }
    /* REPRISE — une étape à moitié faite s'ouvre sur le premier exercice pas encore fait (les écrans déjà faits restent derrière la flèche ←,
       en « révision »), sans refaire le cours d'introduction ni les questions déjà répondues. Même définition de « fait » que le parcours :
       Course.isDone (tot > 0) / Course.stepDone. Étape toute faite (« Refaire ») ou pas commencée : on part du début.
       « go= » nomme le 1er exercice de l'étape (lien du parcours) ; un « go= » sur un AUTRE exercice de l'étape = un lien vers cet exercice. */
    var st0 = Course.readStore(), sig0 = {}, resumed = false;
    step.exIds.forEach(function (id) { sig0[id] = Course.sig(st0, id); });
    (function () {
      var target = -1, k;
      if (goId && goId !== step.exIds[0] && step.exIds.indexOf(goId) >= 0) {
        for (k = 0; k < screens.length; k++) if (screens[k].type === 'ex' && screens[k].id === goId) { target = k; break; }
      }
      if (target < 0 && step.exIds.some(function (id) { return Course.isDone(st0, id); }) && !Course.stepDone(st0, step)) {
        for (k = 0; k < screens.length; k++) {
          var s0 = screens[k];
          if (s0.type === 'ex' && step.exIds.indexOf(s0.id) >= 0 && !Course.isDone(st0, s0.id)) { target = k; resumed = true; break; }
        }
      }
      if (target > 0) idx = target;
    })();
    /* un rechargement dans le même onglet reprend là où l'élève en était : cela passe avant la reprise ci-dessus */
    guard(function () { var v = parseInt(sessionStorage.getItem(skey), 10); if (v > 0 && v < screens.length) idx = v; });

    var fromMap = { app: 'app', plan: 'plan', faibles: 'faibles' };
    var backUrl = fromMap[Q.get('from')] || 'app';
    var nextUrl = 'app?from=lesson&u=' + unit + '#next';

    function exDone(sc) { var s = Course.readStore(); return !!(sc.id && Course.isDone(s, sc.id)); }

    /* ---------- affichage d'un écran ---------- */
    function clearMarks() {
      marks.forEach(function (n) { n.classList.remove('lp-show', 'lp-path', 'lp-collapsed'); });
      marks = [];
    }
    function mark(n, c) { if (!n.classList.contains(c)) { n.classList.add(c); marks.push(n); } }

    function setProgress() {
      var inItems = !!(cur && cur.itemFlow && !done);
      var pos = done ? totalUnits : (before[idx] || 0) + (inItems ? cur.itemIdx + (cur.itemFb ? 1 : 0) : 0);
      var v = Math.round(100 * pos / totalUnits);
      progFill.parentNode.style.setProperty('--v', v + '%');
      progEl.setAttribute('aria-valuemax', String(totalUnits));
      progEl.setAttribute('aria-valuenow', String(pos));
      var txt = (inItems ? 'Question ' + (cur.itemIdx + 1) + ' sur ' + cur.items.length + ' · ' : '') + 'Écran ' + Math.min(idx + 1, screens.length) + ' sur ' + screens.length;
      progEl.setAttribute('aria-valuetext', txt);
      var lv = $('.lp-live', root); if (lv) lv.textContent = done ? 'Leçon terminée' : txt;
    }

    function whoSvg(ch, prop) {
      if (!hasCast) return '';
      return Cast.svg(ch, { mood: 'idle', prop: prop || 'none', label: '' });
    }

    function renderIntro(sc) {
      intro.innerHTML = '';
      docBar.innerHTML = ''; docBar.hidden = true;
      if (sc.type === 'teach') {
        var who = el('div', 'lp-who');
        who.innerHTML = whoSvg(sc.char, sc.char === 'lea' ? 'notebook' : 'none');
        var b = el('div', 't-bubble t-bubble--l', esc(sc.label) + (sc.sub ? '<small>' + esc(sc.sub) + '</small>' : ''));
        intro.appendChild(who); intro.appendChild(b);
        intro.hidden = false;
      } else {
        intro.hidden = true;
        /* un document (images, conversation, texte) à replier ; le lecteur audio, lui, reste toujours visible.
           Déplié d'office s'il n'a pas encore été vu sur un écran de cours (p. ex. un texte à lire). */
        var coll = [];
        sc.ctx.forEach(function (n) {
          if (n.matches('.audio')) return;
          if (n.querySelector('.audio')) $$('.imgbox, .sms, .rtext', n).forEach(function (x) { coll.push(x); });
          else coll.push(n);
        });
        if (coll.length) {
          var open = sc.ctxFirst;
          var btn = el('button', '', IC.doc + '<span>Le document</span><span class="lp-chev" aria-hidden="true">▾</span>');
          btn.type = 'button';
          var apply = function () {
            btn.setAttribute('aria-expanded', open ? 'true' : 'false');
            coll.forEach(function (n) { if (open) n.classList.remove('lp-collapsed'); else mark(n, 'lp-collapsed'); });
          };
          btn.addEventListener('click', function () { open = !open; apply(); sfx('tap'); });
          docBar.appendChild(btn); docBar.hidden = false;
          apply();
        }
      }
    }

    function updateBar() {
      var sc = cur;
      if (!sc) return;
      prevBtn.disabled = idx === 0;
      second.hidden = true; second.onclick = null;
      bar.classList.remove('is-check');
      bar.textContent = 'Continuer';
      bar.onclick = next;
      if (sc.type === 'ex' && sc.itemFlow) {
        bar.textContent = 'Vérifier'; bar.classList.add('is-check'); bar.onclick = verifyItem;
        second.hidden = false; second.textContent = 'Passer'; second.onclick = skipItem;
      } else if (sc.type === 'ex' && sc.gradable) {
        var restored = !sc.touched && exDone(sc);
        if (restored) {
          second.hidden = false; second.textContent = 'Vérifier'; second.onclick = verify;
        } else {
          bar.textContent = 'Vérifier'; bar.classList.add('is-check'); bar.onclick = verify;
          second.hidden = false; second.textContent = 'Passer'; second.onclick = next;
        }
      }
    }

    /* on quitte un écran : plus de son ni de micro qui continuent derrière (comme le fait go() entre deux onglets) */
    function hush() {
      guard(function () { if (typeof ALL_AUDIO !== 'undefined') ALL_AUDIO.forEach(function (a) { a.pause(); }); });
      guard(function () { if (typeof stopSay === 'function') stopSay(); });
      guard(function () { if (typeof micState !== 'undefined' && micState === 'recording' && typeof micStop === 'function') micStop(true); });
    }

    function show(i, dir) {
      hush();
      closeFeedback(true);
      itemEnd();
      clearMarks();
      idx = Math.max(0, Math.min(screens.length - 1, i));
      cur = screens[idx];
      cur.touched = false;
      cur.itemFlow = !!(cur.items && !exDone(cur));      // un exercice déjà fait se « revoit » en entier, comme avant
      cur.nodes.forEach(function (n) {
        mark(n, 'lp-show');
        for (var p = n.parentElement; p && p !== inner; p = p.parentElement) mark(p, 'lp-path');
      });
      renderIntro(cur);
      updateBar();
      setProgress();
      saveIdx();
      stage.scrollTop = 0;
      faceMood('idle');
      if (dir) { try { stage.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
      /* un exercice rouvert : on ne montre pas les correction d'une session précédente, mais on suit les saisies */
      if (cur.type === 'ex') {
        var ex = cur.ex, sc = cur;
        if (!ex.__lpTouch) {
          ex.__lpTouch = true;
          var touch = function () { if (cur && cur.ex === ex && !cur.touched) { cur.touched = true; updateBar(); } };
          ex.addEventListener('input', touch, true);
          ex.addEventListener('click', function (e) { if (!e.target.closest('.speak, .enbtn, .au-tools, .audio')) touch(); }, true);
        }
        void sc;
        if (cur.itemFlow) itemBegin(cur);
      }
    }

    function next() { if (idx >= screens.length - 1) finish(); else { sfx('whoosh'); show(idx + 1, 1); } }
    function prev() { if (idx > 0) { sfx('whoosh'); show(idx - 1, -1); } }
    prevBtn.addEventListener('click', prev);

    function verify() {
      if (!cur || cur.type !== 'ex') return;
      var ex = cur.ex, b = ex.querySelector('.check');
      cur.touched = true;
      if (b) b.click(); else if (typeof check === 'function') guard(function () { check(ex); });
      updateBar();
    }

    /* ---------- feuille de correction ---------- */
    function fmt(x) { return String(Math.round(x * 10) / 10).replace('.', ','); }
    function openFeedback(d) {
      var sc = cur;
      var special = d.kind === 'spk' || d.kind === 'conv' || d.kind === 'speak';
      var pct = d.tot ? d.ok / d.tot : 0;
      var good = pct >= (special ? 0.6 : 0.8);
      fb.classList.toggle('t-feedback--ok', good);
      fb.classList.toggle('t-feedback--bad', !good);
      fbKind = good ? 'ok' : 'bad';
      var title, text;
      if (good) {
        title = pct >= 1 ? 'Parfait !' : ['Bravo !', 'Super !', 'Très bien !'][Math.floor(Math.random() * 3)];
        text = special ? 'Bien dit !' : fmt(d.ok) + ' sur ' + d.tot + (pct >= 1 ? ' — tout est juste.' : ' — continue comme ça.');
      } else {
        title = 'Presque !';
        text = special ? 'Tu peux réessayer plus tard.' : fmt(d.ok) + ' sur ' + d.tot + '. Regarde les corrections en rouge.';
      }
      var sp = speakerFor(good ? 'correct' : 'wrong');
      if (!good) mistakes++;
      var said = say(good ? 'correct' : 'wrong', { char: sp });
      fbText.textContent = text;
      showSpeaker(sp, good ? 'happy' : 'sad', said, title);
      streakChip(said);
      faceMood(good ? 'happy' : 'sad');
      fbRow.innerHTML = '';
      var retry = !good && (d.kind === 'ex' || d.kind === 'dic');
      if (retry) {
        var r = el('button', 't-btn t-btn--secondary', 'Réessayer'); r.type = 'button';
        r.addEventListener('click', retryNow); fbRow.appendChild(r);
      }
      var c = el('button', 't-btn lp-fb-next', 'Continuer'); c.type = 'button';
      c.addEventListener('click', function () { closeFeedback(); next(); });
      fbRow.appendChild(c);
      fbRow.style.gridAutoColumns = retry ? '1fr' : '1fr';
      stage.classList.add('lp-fb'); root.classList.add('is-fb');
      fb.classList.add('is-open'); fbOpen = true;
      /* les corrections de la page restent visibles au-dessus de la feuille */
      setTimeout(function () {
        var t = sc.ex.querySelector('.hint.show, .inp.no, .opt.no, .mitem.no, .dic-res:not([hidden])') || sc.ex;
        t.style.scrollMarginBottom = '260px'; t.style.scrollMarginTop = '24px';
        guard(function () { t.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' }); });
        c.focus({ preventScroll: true });
      }, 60);
    }
    function closeFeedback(quiet) {
      if (!fbOpen) return;
      fb.classList.remove('is-open', 'lp-near'); fbOpen = false;
      stage.classList.remove('lp-fb'); root.classList.remove('is-fb'); stage.style.paddingBottom = '';
      $$('.lp-fb-hint', fb).forEach(function (x) { x.remove(); });
      if (!quiet) faceMood('idle');
    }
    function retryNow() {
      var sc = cur;
      closeFeedback();
      if (!sc || sc.type !== 'ex') return;
      var t = sc.ex.querySelector('.inp.no, .inp.near, .dic-in') || sc.ex.querySelector('.opt.no, .mitem.no');
      if (t) {
        if (/^(INPUT|TEXTAREA)$/.test(t.tagName)) { guard(function () { t.focus({ preventScroll: true }); t.select && t.select(); }); }
        guard(function () { t.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' }); });
      }
      sc.touched = true; updateBar();
    }

    document.addEventListener('dudu:checked', function (e) {
      var d = e.detail || {};
      if (done || !cur || cur.type !== 'ex' || d.id !== cur.id) return;
      if (cur.itemFlow) { if (cur.finalPending) cur.finalD = d; return; }      // question par question : la feuille de chaque question a déjà parlé
      if (d.final === false) {               // tour de « répétez » raté : un petit son, Léa fait la moue, pas de feuille
        sfx('wrong'); faceMood('sad');
        setTimeout(function () { if (!fbOpen) faceMood('idle'); }, 1400);
        return;
      }
      cur.touched = true;
      openFeedback(d);
    });

    /* ---------- exercices : une question à la fois ---------- */
    var viewSc = null;                      // l'écran dont la vue « une question » est active (pour la défaire en le quittant)
    function itemAnswered(it) {
      return it.inps.some(function (i) { return i.value.trim(); }) ||
        it.groups.some(function (g) { return !!g.querySelector('.opt.sel'); }) ||
        it.matches.some(function (m) { return !!m.querySelector('.mitem[data-pair]'); });
    }
    function itemEnd() {
      var sc = viewSc; viewSc = null;
      if (!sc) return;
      sc.units.forEach(function (u) { u.el.classList.remove('lp-ihide'); });
      sc.items.forEach(function (it) {
        it.host.classList.remove('lp-ilock'); if (it.label) it.label.classList.remove('lp-ilock');
        it.inps.forEach(function (i) { if (i.__lpRO) { i.readOnly = false; i.__lpRO = false; } });
      });
      if (sc.counterEl) { sc.counterEl.style.counterSet = ''; sc.counterEl = null; }
    }
    function itemBegin(sc) {
      viewSc = sc; sc.itemIdx = 0; sc.itemFb = false; sc.graded = false; sc.finalD = null;
      var ex = sc.ex;
      if (!ex.__lpItemKeys) {
        ex.__lpItemKeys = true;
        /* Entrée dans un champ : la page classique corrigerait TOUT l'exercice → on la remplace (champ suivant, puis « Vérifier ») */
        ex.addEventListener('keydown', function (e) {
          if (!cur || cur.ex !== ex || !cur.itemFlow || e.key !== 'Enter' || e.isComposing) return;
          if (!e.target.matches || !e.target.matches('.inp')) return;
          e.preventDefault(); e.stopPropagation();
          if (fbOpen) { var n = $('.lp-fb-next', fb); if (n) n.click(); return; }
          var f = cur.items[cur.itemIdx].inps, k2 = f.indexOf(e.target);
          if (k2 >= 0 && k2 < f.length - 1) f[k2 + 1].focus(); else verifyItem();
        }, true);
        /* une question jugée ne se modifie plus (clavier compris) */
        ex.addEventListener('click', function (e) {
          if (cur && cur.ex === ex && cur.itemFlow && e.target.closest && e.target.closest('.lp-ilock .opt, .lp-ilock .mitem, .lp-ilock.opt, .lp-ilock.mitem')) { e.stopPropagation(); e.preventDefault(); }
        }, true);
      }
      itemRender();
    }
    function itemRender() {
      var sc = cur, k = sc.itemIdx, it = sc.items[k], g = it.group;
      sc.units.forEach(function (u) {
        var hide = u.hide || (u.item >= 0 ? u.item !== k : u.qn ? u.el !== g : !!(u.group && u.group !== g));
        u.el.classList.toggle('lp-ihide', !!hide);
      });
      /* une liste numérotée (ol) perd son rang quand les autres lignes sont cachées */
      if (sc.counterEl) { sc.counterEl.style.counterSet = ''; sc.counterEl = null; }
      var h = it.host;
      if (h.tagName === 'LI' && h.parentElement && h.parentElement.tagName === 'OL') {
        var n = 1; for (var p = h.previousElementSibling; p; p = p.previousElementSibling) if (p.tagName === 'LI') n++;
        h.style.counterSet = 'list-item ' + n; sc.counterEl = h;
      }
      sc.itemFb = false;
      stage.scrollTop = 0;
      updateBar(); setProgress();
      var lv = $('.lp-live', root); if (lv) lv.textContent = 'Question ' + (k + 1) + ' sur ' + sc.items.length;
      /* sur ordinateur, le curseur est déjà dans le premier champ ; sur téléphone on laisse le clavier fermé */
      if (it.inps[0] && guard(function () { return window.matchMedia('(pointer: fine)').matches; })) {
        setTimeout(function () { if (cur === sc && sc.itemIdx === k && !fbOpen) guard(function () { it.inps[0].focus({ preventScroll: true }); }); }, 40);
      }
    }
    function lockItem(it) {
      it.host.classList.add('lp-ilock'); if (it.label) it.label.classList.add('lp-ilock');
      it.inps.forEach(function (i) { if (!i.readOnly) { i.readOnly = true; i.__lpRO = true; } });
      guard(function () { var a = document.activeElement; if (a && a.blur && it.host.contains(a)) a.blur(); });
    }
    /* même verdict que check() de la page, pour UNE question, sans rien écrire (ni valeur, ni store, ni carnet) */
    function judgeItem(it) {
      var sum = 0, tot = 0, zero = false, near = false, ans = [];
      it.inps.forEach(function (i) {
        var r = typeof judge === 'function' ? judge(i.value, i.dataset.a) : 0;
        i.classList.remove('ok', 'no', 'near'); i.classList.add(r === 2 ? 'ok' : r === 1 ? 'near' : 'no');
        tot++; sum += r === 2 ? 1 : r === 1 ? 0.5 : 0;
        if (r === 0) zero = true; else if (r === 1) near = true;
        if (r < 2) ans.push(i.dataset.a.split('|')[0].trim());
      });
      it.groups.forEach(function (g) {
        var sel = g.querySelector('.opt.sel'), good = g.querySelector('[data-ok]'), isOk = !!(sel && sel.hasAttribute('data-ok'));
        g.querySelectorAll('.opt').forEach(function (o) {
          o.classList.remove('ok', 'no');
          if (o.hasAttribute('data-ok')) o.classList.add('ok'); else if (o === sel) o.classList.add('no');
        });
        tot++; if (isOk) sum++; else { zero = true; ans.push(ptext(good)); }
      });
      it.matches.forEach(function (m) {
        var items = $$('.mitem', m), left = $$('.mitem', $$('.mcol', m)[0]);
        items.forEach(function (x) { x.classList.remove('ok', 'no'); });
        left.forEach(function (l) {
          var p = l.dataset.pair, partner = p ? items.filter(function (x) { return x !== l && x.dataset.pair === p; })[0] : null;
          var good = !!(partner && partner.dataset.key === l.dataset.key);
          l.classList.add(good ? 'ok' : 'no'); if (partner) partner.classList.add(good ? 'ok' : 'no');
          tot++; if (good) sum++;
          else {
            zero = true;
            var right = items.filter(function (x) { return x !== l && x.dataset.key === l.dataset.key && x.parentElement !== l.parentElement; })[0];
            ans.push(ptext(l) + ' → ' + ptext(right));
          }
        });
      });
      return { state: !zero && !near ? 'ok' : !zero ? 'near' : 'bad', sum: sum, tot: tot, ans: ans };
    }
    /* la VRAIE correction de la page, une seule fois, après la dernière question (store, carnet, progression, dudu:checked) */
    function gradeEx(sc) {
      if (sc.graded) return sc.finalD;
      sc.graded = true; sc.finalD = null; sc.finalPending = true;
      try {
        var b = sc.ex.querySelector('.check');
        if (b) b.click(); else if (typeof check === 'function') check(sc.ex);
      } catch (e) { if (window.console) console.error('[lesson]', e); }
      sc.finalPending = false;
      return sc.finalD;
    }
    function nudge() {
      bar.classList.remove('lp-shake'); void bar.offsetWidth; bar.classList.add('lp-shake');
      bar.textContent = 'Réponds d’abord';
      setTimeout(function () { bar.classList.remove('lp-shake'); if (cur && cur.itemFlow && !fbOpen) bar.textContent = 'Vérifier'; }, 1100);
      var lv = $('.lp-live', root); if (lv) lv.textContent = 'Réponds d’abord, ou touche Passer.';
    }
    function verifyItem() {
      var sc = cur;
      if (!sc || sc.type !== 'ex' || !sc.itemFlow || fbOpen) return;
      var it = sc.items[sc.itemIdx];
      if (!itemAnswered(it)) { nudge(); return; }
      sc.touched = true;
      var res = judgeItem(it);
      lockItem(it);
      var last = sc.itemIdx === sc.items.length - 1;
      var d = last ? gradeEx(sc) : null;
      sc.itemFb = true; setProgress();
      openItemFeedback(sc, it, res, last, d);
    }
    function skipItem() {
      var sc = cur;
      if (!sc || sc.type !== 'ex' || !sc.itemFlow || fbOpen) return;
      if (sc.itemIdx >= sc.items.length - 1) {
        if (sc.items.some(itemAnswered)) gradeEx(sc);      // comme la page : rien de répondu → rien n'est noté
        next(); return;
      }
      sfx('whoosh');
      sc.itemIdx++; itemRender();
    }
    function itemAdvance() {
      var sc = cur;
      if (!sc || !sc.itemFlow) return;
      if (sc.itemIdx >= sc.items.length - 1) { next(); return; }
      sfx('whoosh');
      sc.itemIdx++; itemRender();
    }
    function openItemFeedback(sc, it, res, last, d) {
      var ok = res.state === 'ok', near = res.state === 'near';
      fb.classList.toggle('t-feedback--ok', ok); fb.classList.toggle('t-feedback--bad', res.state === 'bad'); fb.classList.toggle('lp-near', near);
      fbKind = ok ? 'ok' : near ? 'near' : 'bad';
      var ans = res.ans.map(function (a) { return '<em>' + esc(a) + '</em>'; }).join(' ');
      var title, text;
      if (ok) { title = ['Bien !', 'Super !', 'Exact !', 'Très bien !'][Math.floor(Math.random() * 4)]; text = 'Continue comme ça !'; }
      else if (near) { title = 'Presque !'; text = 'Regarde l’orthographe : ' + ans; }
      else { title = 'Pas tout à fait'; text = 'La bonne réponse : ' + ans; }
      if (last && d && d.tot) text += '<br>Exercice terminé : ' + fmt(d.ok) + ' sur ' + d.tot + '.';
      var sp = speakerFor(res.state === 'bad' || near ? 'wrong' : 'correct');
      if (res.state !== 'ok') mistakes++;
      var said = say(res.state === 'ok' ? 'correct' : 'wrong', { char: sp, near: near });
      fbText.innerHTML = text;
      var body = $('.t-feedback__body', fb);
      $$('.lp-fb-hint', fb).forEach(function (x) { x.remove(); });
      if (res.state === 'bad') {
        var h = sc.ex.querySelector('.hint');
        if (h) {
          var c = h.cloneNode(true); $$('.enbtn, .en', c).forEach(function (x) { x.remove(); });
          var t = c.textContent.replace(/\s+/g, ' ').trim();
          if (t) { var hp = el('p', 'lp-fb-hint'); if (t.length <= 220) hp.innerHTML = c.innerHTML.replace(/<br\s*\/?>/gi, ' '); else hp.textContent = t.slice(0, 200).replace(/\s+\S*$/, '') + ' …'; body.appendChild(hp); }
        }
      }
      showSpeaker(sp, res.state === 'bad' ? 'sad' : 'happy', said, title);
      streakChip(said);
      faceMood(res.state === 'bad' ? 'sad' : 'happy');
      fbRow.innerHTML = '';
      var cb = el('button', 't-btn lp-fb-next', 'Continuer'); cb.type = 'button';
      cb.addEventListener('click', function () { closeFeedback(); itemAdvance(); });
      fbRow.appendChild(cb);
      stage.classList.add('lp-fb'); root.classList.add('is-fb');
      fb.classList.add('is-open'); fbOpen = true;
      stage.style.paddingBottom = (fb.offsetHeight + 24) + 'px';
      /* exercice parfait : un petit « bravo » de foule après le son de la dernière question (sans second « bravo » dit) */
      if (last && d && d.tot && d.ok >= d.tot) setTimeout(function () { if (cur === sc && !done) sfx('cheer'); }, 650);
      setTimeout(function () {
        var t = it.host;
        t.style.scrollMarginBottom = (fb.offsetHeight + 12) + 'px'; t.style.scrollMarginTop = '24px';
        guard(function () { t.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' }); });
        cb.focus({ preventScroll: true });
      }, 60);
    }

    /* ---------- quitter ---------- */
    function openSheet() { sheet.classList.add('is-open'); sheet.setAttribute('aria-hidden', 'false'); var s = $('.lp-stay', root); setTimeout(function () { s.focus(); }, 60); }
    function closeSheet() { if (!sheet.classList.contains('is-open')) return false; sheet.classList.remove('is-open'); sheet.setAttribute('aria-hidden', 'true'); return true; }
    $('.lp-close', root).addEventListener('click', function () { if (done) { clearIdx(); location.href = nextUrl; } else openSheet(); });
    $('.lp-stay', root).addEventListener('click', closeSheet);
    $('.t-sheet__scrim', root).addEventListener('click', closeSheet);
    $('.lp-leave', root).addEventListener('click', function () { clearIdx(); location.href = backUrl; });

    /* le tuteur (facultatif) : la page le garde caché, ce bouton le rouvre */
    $('.lp-help', root).addEventListener('click', function () {
      var tb = document.getElementById('tutorBtn');
      if (tb) tb.click();
    });

    /* ---------- clavier ---------- */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { if (closeSheet()) e.preventDefault(); return; }
      if (e.key !== 'Enter' || e.defaultPrevented || e.isComposing) return;
      var t = e.target, tag = t && t.tagName;
      if (/^(TEXTAREA|INPUT|SELECT|BUTTON|A|SUMMARY)$/.test(tag) || (t && t.isContentEditable)) return;
      if (sheet.classList.contains('is-open') || done) return;
      e.preventDefault();
      if (fbOpen) { var n = $('.lp-fb-next', fb); if (n) n.click(); return; }
      bar.click();
    });

    /* ---------- fin : écran Bravo ---------- */
    function finish() {
      hush();
      done = true; closeFeedback(true); itemEnd(); clearMarks(); clearIdx();
      guard(function () { if (window.DuduSync) DuduSync.flush(); });   // l'étape part sur le compte maintenant, pas dans 1,5 s
      var st = Course.readStore(), ok = 0, tot = 0;
      step.exIds.forEach(function (id) { var r = Course.rec(st, id); if (r && r.tot) { ok += r.ok || 0; tot += r.tot; } });
      /* rien de noté (tous les exercices passés) : une fin calme, sans confettis ni étoiles ni XP ni son de réussite.
         Une étape sans exercice à noter (cours seul) garde le Bravo habituel. */
      var gradedAny = step.exIds.some(function (id) { return Course.isDone(st, id); });
      /* étape reprise : si rien n'a été noté pendant CETTE visite (tout le reste passé), les exercices faits avant ne font pas un « Bravo » */
      var idle = resumed && !step.exIds.some(function (id) { return Course.sig(st, id) !== sig0[id]; });
      if (step.exIds.length && (!gradedAny || idle)) { finishCalm(); return; }
      var pct = tot ? Math.round(100 * ok / tot) : 0;
      var stars = pct >= 90 ? 3 : pct >= 70 ? 2 : 1;
      var xp = Math.round(ok * 10);
      var starsHtml = '';
      for (var s = 1; s <= 3; s++) starsHtml += s <= stars ? '★' : '<i>★</i>';
      var br = $('.lp-bravo', root);
      br.innerHTML =
        '<div class="t-confetti" aria-hidden="true"></div>' +
        '<div class="lp-bravo-in">' +
          '<h2 class="t-h1">' + (pct >= 70 ? 'Bravo !' : 'Leçon terminée !') + '</h2>' +
          '<div class="lp-score"><div class="lp-pct" aria-label="' + pct + ' pour cent">' + pct + ' %</div>' +
            '<div class="lp-stars" role="img" aria-label="' + stars + ' étoile' + (stars > 1 ? 's' : '') + ' sur 3">' + starsHtml + '</div></div>' +
          '<span class="t-chip t-chip--xp">+' + xp + ' XP</span>' +
          '<p class="t-small">' + (tot ? fmt(ok) + ' sur ' + tot + ' bonnes réponses' : 'Aucune réponse notée cette fois') + '</p>' +
          '<p class="lp-sayline" aria-hidden="true"></p>' +
          '<div class="lp-troupe">' +
            ['lea', 'dubois', 'jo'].map(function (c) { return '<figure><div class="lp-c" data-c="' + c + '">' + (hasCast ? Cast.svg(c, { mood: 'happy', label: '' }) : '') + '</div><figcaption>' + (hasCast ? esc(Cast.NAMES[c]) : '') + '</figcaption></figure>'; }).join('') +
          '</div>' +
          '<div class="lp-bravo-btns"><button type="button" class="t-btn t-btn--teal t-btn--block lp-go">Continuer</button>' +
            '<button type="button" class="t-btn t-btn--secondary t-btn--block lp-again">Revoir la leçon</button></div>' +
        '</div>';
      root.classList.add('is-bravo');
      if (hasCast) guard(function () { Cast.confetti($('.t-confetti', br)); });
      setProgress();
      faceMood('happy');
      /* les trois personnages sautent quand ils parlent (ils sont « calmes » sinon) */
      var calm = function () { $$('.lp-c', br).forEach(function (c) { guard(function () { Cast.setMood(c, 'idle'); }); }); };
      calm();
      var timers = {}, sayEl = $('.lp-sayline', br);
      window.addEventListener('dudu:speak', function (ev) {
        if (ev.detail && ev.detail.text && sayEl) { sayEl.textContent = ev.detail.text; sayEl.classList.remove('lp-pop'); void sayEl.offsetWidth; sayEl.classList.add('lp-pop'); }
        var ch = ev.detail && ev.detail.char; ch = ch === 'mamie' ? 'jo' : ch;
        var c = $('.lp-c[data-c="' + ch + '"]', br);
        if (!c) return;
        guard(function () { Cast.setMood(c, 'happy'); });
        clearTimeout(timers[ch]);
        timers[ch] = setTimeout(function () { guard(function () { Cast.setMood(c, 'idle'); }); }, Math.max(400, ((ev.detail && ev.detail.duration) || 1) * 1000 + 150));
      });
      /* zéro faute dans cette leçon : « perfect » ; sinon « complete » (le chef de classe parle, un autre membre lui répond) */
      var perfect = mistakes === 0 && tot > 0 && pct >= 100;
      say(perfect ? 'perfect' : 'complete', { char: leaderKey });
      /* les chiffres montent d'un coup (un seul petit son « xp »), sauf si on préfère moins de mouvement */
      var pctEl = $('.lp-pct', br), xpEl = $('.t-chip--xp', br);
      if (pctEl && xpEl && !reduced()) {
        pctEl.textContent = '0 %'; xpEl.textContent = '+0 XP';
        setTimeout(function () {
          if (!done || !br.isConnected) return;
          if (xp > 0) sfx('xp');
          var t0 = Date.now(), D = 900;
          (function tick() {
            var k = Math.min(1, (Date.now() - t0) / D), e = 1 - Math.pow(1 - k, 3);
            pctEl.textContent = Math.round(pct * e) + ' %'; xpEl.textContent = '+' + Math.round(xp * e) + ' XP';
            if (k < 1) requestAnimationFrame(tick);
          })();
        }, 650);
      }
      $('.lp-go', br).addEventListener('click', function () { sfx('tap'); location.href = nextUrl; });
      $('.lp-again', br).addEventListener('click', function () {
        var p = new URLSearchParams(location.search); p.delete('mode');
        location.href = location.pathname + '?' + p.toString();
      });
      guard(function () { $('.lp-go', br).focus({ preventScroll: true }); });
    }

    function finishCalm() {
      var br = $('.lp-bravo', root);
      br.innerHTML =
        '<div class="lp-bravo-in">' +
          '<h2 class="t-h1">Pas encore fini</h2>' +
          '<p class="t-body">Tu as passé les exercices. Reviens quand tu veux !</p>' +
          '<div class="lp-calm-who">' + (hasCast ? Cast.svg('lea', { mood: 'idle', prop: 'notebook', label: '' }) : '') + '</div>' +
          '<div class="lp-bravo-btns"><button type="button" class="t-btn t-btn--teal t-btn--block lp-go">Retour au parcours</button>' +
            '<button type="button" class="t-btn t-btn--secondary t-btn--block lp-again">Revoir la leçon</button></div>' +
        '</div>';
      root.classList.add('is-bravo');
      setProgress();
      var lv = $('.lp-live', root); if (lv) lv.textContent = 'Leçon passée, aucun exercice noté';
      faceMood('idle');
      $('.lp-go', br).addEventListener('click', function () { sfx('tap'); location.href = nextUrl; });
      $('.lp-again', br).addEventListener('click', function () {
        var p = new URLSearchParams(location.search); p.delete('mode');
        location.href = location.pathname + '?' + p.toString();
      });
      guard(function () { $('.lp-go', br).focus({ preventScroll: true }); });
    }

    /* petit accès pour les tests / le débogage */
    window.Lesson = {
      get screens() { return screens; }, get index() { return idx; }, get current() { return cur; }, step: step,
      show: show, next: next, prev: prev, finish: finish, verify: verify, get root() { return root; },
      verifyItem: verifyItem, skipItem: skipItem, get total() { return totalUnits; },
      _build: buildScreens, _weight: weight, _extract: extractItems
    };

    show(idx, 0);
    reveal();
    document.dispatchEvent(new CustomEvent('lesson:ready', { detail: { screens: screens.length } }));
  }

  /* ------------------------------ démarrage : on attend que la page ait fini de se construire ------------------------------ */
  function whenBooted(cb) {
    var tries = 0;
    (function poll() {
      var booted = typeof exs !== 'undefined' && exs && exs.length && typeof go === 'function' && typeof setUnit === 'function';
      if (booted || tries++ > 40) cb(); else setTimeout(poll, 50);
    })();
  }
  function init() {
    window.__lpWorking = true;          // le <head> n'abandonne pas l'écran d'attente à 4 s tant que les ressources du lecteur se chargent (12 s au plus)
    var base = loadCss('troupe.css');
    base.then(function () { return loadScript('cast.js'); })
      .then(function () { return loadScript('sfx.js'); })
      .then(function () { return loadScript('course.js'); })
      .then(function () { return loadCss('troupe-widgets.css', 'lp-widgets-css'); })      // facultatifs : un 404 est toléré
      .then(function () { return loadScript('troupe-widgets.js'); })
      .then(function () { whenBooted(function () { try { start(); } catch (e) { if (window.console) console.error('[lesson]', e); document.documentElement.classList.remove('lp-on'); reveal(); } }); })
      .catch(function (e) { if (window.console) console.error('[lesson]', e); reveal(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
