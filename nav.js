/*!
 * nav.js — « La Troupe » app shell for DuDu: top bar, bottom tab bar, and the Pratique / Moi sheets,
 * shared by every page (extracted from app.html in stage 2, phase A).
 *
 * PAGE REQUIREMENTS
 *   <link rel="stylesheet" href="troupe.css">          (t-topbar, t-tabbar, t-sheet, t-chip, t-iconbtn, t-mute, t-btn … and the --t-* tokens)
 *   <body class="t-page">                              (cream background, text colour, fonts)
 *   scripts, in this order, before nav.js:   sync.js · cast.js · sfx.js · [mistakes.js] · nav.js
 *     - cast.js   faces (brand, voices list). Missing → the faces are simply empty.
 *     - sfx.js    mute button + voices. Missing → every mute button and the « Son » / « Voix » parts of Moi are hidden.
 *     - sync.js   save() pushes to the account; whoami / Déconnexion in Moi. Missing → no account line, no push.
 *     - mistakes.js  optional: gives the red count on « Points faibles » (without it the count is simply not shown).
 *   course.js is NOT needed (the « Tests de fin d'unité » ticks read store.tests directly).
 *   unlock.js is optional: when the page loads it (every page except login/signup does), the tests of locked units are greyed out
 *   in « Pratique » (a tap says why). Without it the five tests are plain links (test.html checks the lock itself).
 *   nav.js injects its own <style id="nav-css"> and an icon sprite (ids n-*); all its classes are n-* / t-*.
 *
 * API (window.DuduNav)
 *   DuduNav.mount({active, title, back, topbar, tabbar})   (call once the <body> exists, e.g. from a script at the end of it)
 *       active   'parcours' | 'plan' | 'pratique' | 'carnet' | 'moi' | null   tab to highlight (aria-current)        default null
 *       title    page title, shown in the 'page' top bar                                                              default ''
 *       back     'app' (default) | <any href> | null → the « ← » button of the 'page' top bar (null = no button)
 *       topbar   'full' | 'page' | false
 *                'full' = DuDu brand (Léa's face → app) + streak chip + overall-progress chip + mute + avatar → Moi
 *                'page' = « ← » (aria-label « Retour au parcours ») + title (t-h3, ellipsis) + mute + avatar → Moi   default 'page'
 *       tabbar   true | false  — Parcours (app) · Plan (plan) · Pratique (sheet) · Carnet (carnet) · Moi (sheet)    default true
 *                (true also adds .t-has-tabbar to <body>)
 *     The top bar is inserted at the start of #app if the page has one, else at the start of <body>; the tab bar at the
 *     end of the same host; both sheets (#shPratique, #shMoi) at the end of <body>. They are always built, even with
 *     topbar:false / tabbar:false, so a page can call DuduNav.openPratique() / openMoi() itself.
 *     mount() is repeatable (it replaces what it built before). Theme: store.theme → html[data-theme] is applied at
 *     mount (idempotent with a page's own early <head> script), as is <meta name="theme-color">.
 *   DuduNav.setProgress(pct)      the % shown in the 'full' bar's progress chip (number or null → « … »); the page knows the course, nav.js does not
 *   DuduNav.refresh()             re-reads the store: streak, Pratique counts (next open), mute / theme state
 *   DuduNav.openPratique(from?) · DuduNav.openMoi(from?)
 *   DuduNav.openInstall(from?, 'ios'|'android'?)   the 3-step « add to home screen » guide (#shInstall); also in Moi → Application
 *   DuduNav.maybeShowInstall()    opens that guide once per device, on a phone/tablet, when not already opened from the home screen
 *   DuduNav.isStandalone()        true when the page runs as the installed app
 *   DuduNav.setOffline({unit, label, files})   the page offers « Hors ligne » in Moi: download that unit's audio + images
 *       (files = same-origin paths) into sw.js's caches, with progress. On Wi-Fi (navigator.connection says so — Android
 *       Chrome only; iPhone never says) it also starts by itself, but only into free room: it never pushes out a unit the
 *       student downloaded on purpose. Unite1_Revision.html calls it at mount and on every unit change.
 *   Sheets (also usable by the page for its own .t-sheet elements — structure: .t-sheet > .t-sheet__scrim[data-close] + .t-sheet__panel):
 *     DuduNav.openSheet(elOrId, fromEl?)   opens it: inert background, focus into the panel, Tab trap, Escape / [data-close] close it
 *     DuduNav.closeSheet(silent?)          closes, gives focus back to fromEl (not when silent)
 *     DuduNav.isSheetOpen()  ·  DuduNav.onSheetClose(fn(silent))  fn runs after every close
 *   DuduNav.save(mutate)          re-reads the store, runs mutate(store), writes it, then DuduSync.schedulePush(store). Returns true if saved
 *   DuduNav.readStore()           parsed store object ({} on any problem)
 *   DuduNav.setTheme('auto'|'light'|'dark')  persists store.theme, sets html[data-theme], updates theme-color
 *   DuduNav.themeMode() → 'auto'|'light'|'dark'      DuduNav.isDark() → bool
 *
 * Events (window)   'dudu:theme'  {detail:{mode, dark}}   after the theme changed (Moi sheet, another tab, or the OS in auto mode)
 *
 * Ids kept from app.html (so page scripts / tests that used them keep working):
 *   brandFace streakChip streakN pctChip pctN avatarBtn tabPratique tabMoi shPratique shMoi themeSeg voices whoLine logoutBtn …
 * Never throws: every storage / Sfx / Cast / DuduSync access is guarded.
 */
(function () {
  'use strict';

  var LS = 'dudu-a1-u1';
  var UNITS = Object.keys((window.COURSE || {}).units || {1: 1}).map(Number);   // content/meta.js
  var THEME_COLOR = { light: '#FFF5E8', dark: '#171219' };

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function sfx(n, o) { try { if (window.Sfx) window.Sfx.play(n, o); } catch (e) {} }
  function hasSfx() { return !!(window.Sfx && typeof window.Sfx.toggle === 'function'); }
  function face(char, mood) { try { return window.Cast ? window.Cast.svg(char, { crop: 'face', mood: mood || 'idle', label: '' }) : ''; } catch (e) { return ''; } }

  /* ------------------------------ store ------------------------------ */
  function readStore() {
    try {
      var o = JSON.parse(localStorage.getItem(LS) || '{}');
      if (o && typeof o === 'object' && !Array.isArray(o)) return o;
    } catch (e) {}
    return {};
  }
  /* save(mutate) relit le store juste avant d'écrire : sync.js ou Sfx ont pu le changer entre-temps. */
  function save(mutate) {
    try {
      var st = readStore();
      mutate(st);
      localStorage.setItem(LS, JSON.stringify(st));
      try { window.DuduSync && window.DuduSync.schedulePush(st); } catch (e) {}
      return true;
    } catch (e) { return false; }
  }

  /* ------------------------------ CSS + icons (injected once) ------------------------------ */
  var CSS = [
    /* top bar */
    '.n-top [hidden],.n-sheet [hidden]{display:none!important}',
    '.n-bar{display:flex;align-items:center;gap:6px;width:100%;max-width:520px;margin:0 auto}',
    '.n-brand{display:flex;align-items:center;gap:7px;min-width:0;flex:1;text-decoration:none;color:var(--t-ink)}',
    '.n-brand__face{width:36px;height:36px;border-radius:50%;border:2px solid var(--t-rim);background:var(--t-teal-l);overflow:hidden;flex:none}',
    '.n-brand__face svg{display:block;width:100%;height:100%}',
    '.n-brand__name{font:800 21px/1 var(--t-font-d);letter-spacing:-.02em}',
    '.n-top .t-chip{padding:6px 10px 6px 7px;font-size:14px}',
    '.n-top .t-chip svg{width:17px;height:17px}',
    '.n-pct{min-width:0}',
    '.n-top .t-iconbtn,.n-top .t-mute{margin:0 0 4px}',
    '.n-top{padding-bottom:6px}',
    '@media (max-width:389px){.n-brand__name{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}.n-brand{flex:0 0 auto}.n-bar{justify-content:space-between}}',
    '.n-title{flex:1;min-width:0;margin:0 0 4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.n-back svg{transform:scaleX(-1)}',
    /* sheets : contenu */
    '.n-sh-head{display:flex;align-items:flex-start;gap:12px;margin-bottom:12px}',
    '.n-sh-head>div{flex:1;min-width:0}',
    '.n-sh-sub{margin:6px 0 0}',
    '.n-list{display:grid;gap:10px;margin:12px 0 0}',
    '.n-row{display:flex;align-items:center;gap:12px;min-height:56px;padding:8px 12px;border-radius:18px;text-decoration:none;color:var(--t-ink);background:var(--t-paper);border:2px solid var(--t-line);font:inherit;cursor:pointer;width:100%;text-align:left}',
    '.n-row:active{transform:scale(.985)}',
    '.n-row__ic{width:38px;height:38px;border-radius:12px;background:var(--t-teal-l);color:var(--t-teal-ink);display:grid;place-items:center;flex:none}',
    '.n-row__ic svg{width:21px;height:21px}',
    '.n-row__tx{flex:1;min-width:0;display:grid;gap:2px}',
    '.n-row__tx b{font:800 16px/1.15 var(--t-font-d)}',
    '.n-row__tx span{font:600 13px/1.25 var(--t-font-b);color:var(--t-ink-2)}',
    '.n-row__n{font:800 14px/1 var(--t-font-d);min-width:28px;height:28px;padding:0 8px;border-radius:99px;display:inline-grid;place-items:center;background:var(--t-tomato);color:#fff}',
    '.n-row__n[hidden]{display:none}',
    '.n-row__ar{width:18px;height:18px;color:var(--t-ink-3);flex:none}',
    '.n-tests{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:10px}',
    '.n-tests a{min-height:56px;border-radius:16px;display:grid;place-items:center;align-content:center;gap:2px;text-decoration:none;font:800 18px/1 var(--t-font-d);background:var(--t-unit-l);color:var(--t-unit-ink);border:2px solid var(--t-unit)}',
    '.n-tests a small{font:800 10.5px/1 var(--t-font-d);letter-spacing:.04em}',
    '.n-tests a.ok{background:var(--t-unit);color:#2B2230}',
    '.n-tests a.is-locked{background:transparent;border-style:dashed;color:var(--t-ink-2);cursor:not-allowed}',
    '.n-tests a.is-locked .ul-ico{font-size:14px}',
    '.n-sec{margin:20px 0 0;display:block}',
    '.n-setrow{display:flex;align-items:center;gap:12px;min-height:56px}',
    '.n-setrow>div{flex:1;min-width:0}',
    '.n-setrow--wrap{flex-wrap:wrap}',
    '.n-tts{display:flex;align-items:center;gap:10px;margin-top:8px}',
    '.n-tts select{flex:1;min-width:0;min-height:46px;padding:0 12px;border:2px solid var(--t-line);border-radius:14px;background:var(--t-surface);color:var(--t-ink);font:700 15px/1.2 var(--t-font-b)}',
    '.n-setrow--wrap .n-seg{flex:1 1 100%}',
    '.n-setrow--wrap .n-seg button{flex:1}',
    '.n-setrow b{font:800 16px/1.15 var(--t-font-d);display:block}',
    '.n-seg{display:inline-flex;border:2px solid var(--t-line);border-radius:14px;overflow:hidden;background:var(--t-paper);flex:none}',
    '.n-seg button{min-width:44px;min-height:44px;padding:0 12px;border:0;background:transparent;color:var(--t-ink-2);font:800 15px/1 var(--t-font-d);cursor:pointer;touch-action:manipulation;-webkit-appearance:none;appearance:none}',
    '.n-seg button+button{border-left:2px solid var(--t-line)}',
    '.n-seg button[aria-pressed="true"]{background:var(--t-teal);color:#fff}',
    '.n-test{margin:2px 0 0}',
    '.n-test .t-btn{flex:none}',
    '.n-test-status{margin:6px 0 0;padding:10px 12px;border-radius:14px;background:var(--t-teal-l);color:var(--t-teal-ink);font:700 13.5px/1.4 var(--t-font-b)}',
    '.n-test-status.is-warn{background:var(--t-mustard-l);color:var(--t-mustard-ink)}',
    '.n-voice{display:flex;align-items:center;gap:10px;min-height:60px;padding:6px 0}',
    '.n-voice__av{width:48px;height:48px;border-radius:50%;border:2px solid var(--t-rim);background:var(--t-teal-l);overflow:hidden;flex:none}',
    '.n-voice__av svg{display:block;width:100%;height:100%}',
    '.n-voice__nm{flex:1;min-width:0;font:800 15px/1.1 var(--t-font-d)}',
    '.n-voice .t-iconbtn{border-radius:50%}',
    '.n-who{display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
    '.n-off-bar{margin:6px 0 2px}',
    '@media (prefers-reduced-motion:reduce){.n-row{transition:none}}',
    /* « DuDu sur l'écran d'accueil » : le petit tutoriel en 3 étapes */
    '.n-inst-head{display:flex;align-items:center;gap:12px;margin-bottom:14px}',
    '.n-inst-head>img{width:52px;height:52px;border-radius:14px;flex:none;border:2px solid var(--t-line)}',
    '.n-inst-head>div{flex:1;min-width:0}',
    '.n-inst-en{display:block;font:600 13px/1.35 var(--t-font-b);color:var(--t-ink-3);font-style:italic;margin-top:3px}',
    '.n-inst-step{animation:n-inst-in .32s ease-out}',
    '@keyframes n-inst-in{from{opacity:0;transform:translateX(14px)}to{opacity:1;transform:none}}',
    '.n-inst-step.is-back{animation-name:n-inst-back}',
    '@keyframes n-inst-back{from{opacity:0;transform:translateX(-14px)}to{opacity:1;transform:none}}',
    '.n-inst-n{margin:0 0 8px}',
    '.n-inst-t{font:800 20px/1.2 var(--t-font-d);margin:12px 0 0;color:var(--t-ink)}',
    '.n-inst-s{margin:8px 0 0}',
    '.n-im{background:var(--t-paper);border:2px solid var(--t-line);border-radius:22px;padding:14px;display:grid;gap:10px;min-height:138px;align-content:center}',
    '.n-im__url{display:flex;align-items:center;gap:8px;min-height:40px;padding:0 12px;border-radius:12px;background:var(--t-surface);border:2px solid var(--t-line);font:700 14px/1 var(--t-font-b);color:var(--t-ink-2)}',
    '.n-im__url span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.n-im__bar{display:flex;justify-content:space-around;align-items:center;min-height:48px}',
    '.n-im i{display:inline-grid;place-items:center;width:42px;height:42px;border-radius:12px;color:var(--t-ink-3);font-style:normal;font:800 22px/1 var(--t-font-d);flex:none}',
    '.n-im i svg{width:24px;height:24px}',
    '.n-im .is-hot{color:var(--t-teal-ink);background:var(--t-teal-l);box-shadow:0 0 0 3px var(--t-tomato);animation:n-inst-pulse 1.6s ease-in-out infinite}',
    '@keyframes n-inst-pulse{0%,100%{box-shadow:0 0 0 3px var(--t-tomato)}50%{box-shadow:0 0 0 7px color-mix(in srgb,var(--t-tomato) 35%,transparent)}}',
    '.n-im__list{display:grid;gap:6px}',
    '.n-im__li{display:flex;align-items:center;gap:10px;min-height:42px;padding:0 12px;border-radius:12px;background:var(--t-surface);font:700 14.5px/1.2 var(--t-font-b);color:var(--t-ink-3)}',
    '.n-im__li svg{width:20px;height:20px;flex:none}',
    '.n-im__li.is-hot{color:var(--t-ink);background:var(--t-teal-l);border-radius:12px}',
    '.n-im__dlg{display:grid;gap:12px;padding:12px;border-radius:16px;background:var(--t-surface)}',
    '.n-im__top{display:flex;align-items:center;justify-content:space-between;gap:8px;font:700 14px/1.2 var(--t-font-b);color:var(--t-ink-3)}',
    '.n-im__top b{color:var(--t-ink);font:800 14px/1.2 var(--t-font-d)}',
    '.n-im__app{display:flex;align-items:center;gap:10px;font:800 16px/1.2 var(--t-font-d);color:var(--t-ink)}',
    '.n-im__app img{width:40px;height:40px;border-radius:10px}',
    '.n-im__btn{display:inline-flex;align-items:center;min-height:36px;padding:0 14px;border-radius:10px;font:800 14px/1 var(--t-font-d);color:var(--t-ink-3)}',
    '.n-im__btn.is-hot{color:var(--t-teal-ink)}',
    '.n-im__btns{display:flex;justify-content:flex-end;gap:8px}',
    '.n-inst-now{margin-top:14px}',
    '.n-inst-foot{display:flex;align-items:center;gap:10px;margin-top:18px}',
    '.n-inst-foot .t-btn{flex:1}',
    '.n-inst-dots{display:flex;justify-content:center;gap:8px;margin-top:16px}',
    '.n-inst-dots span{width:9px;height:9px;border-radius:99px;background:var(--t-line);transition:width .25s,background .25s}',
    '.n-inst-dots span.is-on{width:26px;background:var(--t-tomato)}',
    '@media (prefers-reduced-motion:reduce){.n-inst-step,.n-im .is-hot{animation:none}.n-inst-dots span{transition:none}}'
  ].join('\n');

  var SPRITE = '<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false" id="nav-sprite"><defs>' +
    '<symbol id="n-flame" viewBox="0 0 24 24"><path d="M12 1.5c1.1 3.8 5.6 6 5.6 11.6A5.6 5.6 0 0 1 12 22.5a5.6 5.6 0 0 1-5.6-9.4c0-2.2 1-3.8 2.2-5 .1 2.2 1 3.3 2 3.5C10.4 8 10.2 5 12 1.5z" fill="#E04A2F"/><path d="M12 22.5a3.3 3.3 0 0 1-3.3-3.3c0-1.8 1.5-2.7 2.1-4.4 1.2 1 4.5 2.3 4.5 4.4a3.3 3.3 0 0 1-3.3 3.3z" fill="#F3B534"/></symbol>' +
    '<symbol id="n-check" viewBox="0 0 24 24"><path d="M5 12.8l4.6 4.6L19.2 7" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></symbol>' +
    '<symbol id="n-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></symbol>' +
    '<symbol id="n-arrow" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></symbol>' +
    '<symbol id="n-play" viewBox="0 0 24 24"><path d="M8 5.2 19 12 8 18.8z" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></symbol>' +
    '<symbol id="n-book" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"><rect x="5.5" y="3" width="13.5" height="18" rx="2.4"/><path d="M9 8h7M9 12h7M9 16h4"/><path d="M3 7h3M3 12h3M3 17h3"/></g></symbol>' +
    '<symbol id="n-user" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="8.2" r="3.9"/><path d="M4.5 20.5c.6-4 3.6-6 7.5-6s6.9 2 7.5 6"/></g></symbol>' +
    '<symbol id="n-pencil" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l1-4.5L16.5 4a2.1 2.1 0 0 1 3 0l.5.5a2.1 2.1 0 0 1 0 3L8.5 19z"/><path d="M14.5 6l3.5 3.5"/></g></symbol>' +
    '<symbol id="n-cal" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5.5" width="16" height="14.5" rx="3"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/></g></symbol>' +
    '<symbol id="n-route" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="4.5" r="2.2"/><path d="M8.2 18H14a3.5 3.5 0 0 0 0-7h-4a3.5 3.5 0 0 1 0-6.5h5.8"/></g></symbol>' +
    '<symbol id="n-target" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/></g><circle cx="12" cy="12" r="1.3" fill="currentColor"/></symbol>' +
    '<symbol id="n-cards" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="7.5" width="13" height="13" rx="2.6"/><path d="M8 4h11a1.5 1.5 0 0 1 1.5 1.5V16"/></g></symbol>' +
    '<symbol id="n-phones" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 15v-3a7.5 7.5 0 0 1 15 0v3"/><rect x="3.5" y="14" width="4" height="6.5" rx="1.8"/><rect x="16.5" y="14" width="4" height="6.5" rx="1.8"/></g></symbol>' +
    '</defs></svg>';
  function ic(id) { return '<svg aria-hidden="true"><use href="#n-' + id + '"/></svg>'; }

  /* ------------------------------ theme ------------------------------ */
  var mqDark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function themeMode() {
    var t = document.documentElement.getAttribute('data-theme');
    return t === 'light' || t === 'dark' ? t : 'auto';
  }
  function isDark() {
    var t = document.documentElement.getAttribute('data-theme');
    return t === 'dark' || (t !== 'light' && !!(mqDark && mqDark.matches));
  }
  function paintThemeColor() {
    var m = $('meta[name="theme-color"]:not([media])');
    if (m) m.setAttribute('content', isDark() ? THEME_COLOR.dark : THEME_COLOR.light);
  }
  function emitTheme() {
    try { window.dispatchEvent(new CustomEvent('dudu:theme', { detail: { mode: themeMode(), dark: isDark() } })); } catch (e) {}
  }
  /* store.theme → html[data-theme]; true if the attribute changed (idempotent when a page's head script did it already) */
  function applyStoreTheme() {
    var want = readStore().theme;
    want = want === 'light' || want === 'dark' ? want : null;
    var h = document.documentElement, cur = h.getAttribute('data-theme');
    var changed = (cur || null) !== want;
    if (changed) { if (want) h.setAttribute('data-theme', want); else h.removeAttribute('data-theme'); }
    paintThemeColor();
    return changed;
  }
  function setTheme(v) {
    var h = document.documentElement;
    if (v === 'light' || v === 'dark') h.setAttribute('data-theme', v); else { v = 'auto'; h.removeAttribute('data-theme'); }
    save(function (st) { if (v === 'auto') delete st.theme; else st.theme = v; });
    paintThemeColor(); syncTheme(); emitTheme();
  }
  function syncTheme() {
    var m = themeMode();
    $$('#themeSeg button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.theme === m)); });
  }
  if (mqDark && mqDark.addEventListener) mqDark.addEventListener('change', function () { if (themeMode() === 'auto') { paintThemeColor(); emitTheme(); } });

  /* ------------------------------ mute ------------------------------ */
  function syncMute() {
    var on = hasSfx(), m = on && !!window.Sfx.muted;
    $$('.n-mute').forEach(function (b) {
      b.hidden = !on;
      b.classList.toggle('is-muted', m);
      var l = m ? 'Activer le son' : 'Couper le son';
      b.setAttribute('aria-label', l); b.title = l;
    });
    var s = $('#soundSub'); if (s) s.textContent = m ? 'Son coupé (effets et voix de la troupe)' : 'Effets et voix de la troupe';
  }

  /* ------------------------------ streak 🔥 ------------------------------ */
  /* Un jour compte dès qu'on y a travaillé : store.active_days (sync.js → markActive, à chaque exercice, carte,
     test, rédaction…), plus les jours déjà notés avant (plan terminé, oral) et ceux qu'on retrouve dans les dates
     déjà enregistrées (premier essai d'un exercice, erreurs du carnet, tests, rédactions, mots ajoutés) —
     l'historique d'avant cette règle n'est donc pas perdu. Comme Duolingo : aujourd'hui pas encore fait → la
     série d'hier reste affichée ; un jour sans rien → elle repart de zéro. */
  function pad(n) { return String(n).padStart(2, '0'); }
  function dateKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  var TS_KEYS = { first: 1, last: 1, at: 1, fixed: 1, added: 1 };
  function workDays(st) {
    var set = new Set([].concat(st.active_days || [], st.plan_days || [], st.spk_days || []));
    var lo = Date.UTC(2025, 0, 1), hi = Date.now() + 864e5;
    (function walk(o, depth) {
      if (!o || typeof o !== 'object' || depth > 5) return;
      Object.keys(o).forEach(function (k) {
        var v = o[k];
        if (typeof v === 'number') { if (TS_KEYS[k] && v > lo && v < hi) set.add(dateKey(new Date(v))); }
        else if (v && typeof v === 'object') walk(v, depth + 1);
      });
    })(st, 0);
    return set;
  }
  function streakOf(st) {
    var set = workDays(st);
    var now = new Date();
    var cur = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (!set.has(dateKey(cur))) cur.setDate(cur.getDate() - 1);
    var streak = 0;
    while (set.has(dateKey(cur))) { streak++; cur.setDate(cur.getDate() - 1); }
    return streak;
  }
  function renderStreak() {
    var n = $('#streakN'), chip = $('#streakChip');
    if (!n || !chip) return;
    var streak = 0;
    try { streak = streakOf(readStore()); } catch (e) {}
    var was = +n.textContent || 0;
    n.textContent = streak;
    chip.setAttribute('aria-label', 'Série : ' + streak + ' jour' + (streak > 1 ? 's' : '') + ' de suite');
    if (streak > was && was >= 0 && chip.dataset.ready) { chip.classList.remove('t-pop'); void chip.offsetWidth; chip.classList.add('t-pop'); }
    chip.dataset.ready = '1';
  }
  function setProgress(pct) {
    var n = $('#pctN'), chip = $('#pctChip');
    if (!n || !chip) return;
    var ok = typeof pct === 'number' && isFinite(pct);
    n.textContent = ok ? pct + ' %' : '…';
    chip.setAttribute('aria-label', ok ? 'Progression totale : ' + pct + ' %' : 'Progression totale');
  }

  /* ------------------------------ sheets (one open at a time) ------------------------------ */
  var openSh = null, lastFocus = null, inerted = [], closeFns = [];
  function sheetEl(x) { return typeof x === 'string' ? document.getElementById(x) : x; }
  function setInert(on) {
    if (on) {
      inerted = [];
      Array.prototype.forEach.call(document.body.children, function (el) {
        if (/^(SCRIPT|STYLE|LINK|svg)$/.test(el.tagName) || el.classList.contains('t-sheet') || el.inert) return;
        el.inert = true; inerted.push(el);
      });
    } else { inerted.forEach(function (el) { el.inert = false; }); inerted = []; }
  }
  function closeSheet(silent) {
    if (!openSh) return;
    openSh.classList.remove('is-open'); openSh.setAttribute('aria-hidden', 'true');
    openSh = null;
    setInert(false);
    if (!silent) {
      var f = lastFocus;
      if (f && f.dataset && f.dataset.key && !f.isConnected) f = $('[data-key="' + (window.CSS && CSS.escape ? CSS.escape(f.dataset.key) : f.dataset.key) + '"]');
      try { if (f) f.focus({ preventScroll: true }); } catch (e) {}
    }
    closeFns.slice().forEach(function (fn) { try { fn(!!silent); } catch (e) {} });
  }
  function openSheet(x, from) {
    var sh = sheetEl(x);
    if (!sh) return;
    closeSheet(true);
    lastFocus = from || document.activeElement;
    sh.classList.add('is-open'); sh.setAttribute('aria-hidden', 'false');
    setInert(true);
    openSh = sh;
    sfx('pop');
    setTimeout(function () {
      var p = $('.t-sheet__panel', sh);
      var f = $('a.t-btn, .n-row, button:not([data-close])', p) || p;
      try { (f || p).focus({ preventScroll: true }); } catch (e) {}
    }, 60);
  }
  document.addEventListener('click', function (e) {
    if (openSh && e.target.closest && e.target.closest('[data-close]') && openSh.contains(e.target)) closeSheet();
  });
  document.addEventListener('keydown', function (e) {
    if (!openSh) return;
    if (e.key === 'Escape') { e.preventDefault(); closeSheet(); return; }
    if (e.key === 'Tab') {
      var f = $$('a[href], button:not([disabled]), [tabindex="0"]', openSh).filter(function (x) { return x.offsetParent !== null || x === document.activeElement; });
      if (!f.length) return;
      var a = f[0], z = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === a || document.activeElement === $('.t-sheet__panel', openSh))) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    }
  });

  /* ------------------------------ Pratique ------------------------------ */
  function testPassed(st, id) { var r = (st.tests || {})[id]; return !!(r && r.passed); }
  function paintTests(st, L) {
    var grid = $('#testsGrid'); if (!grid) return;
    grid.innerHTML = UNITS.map(function (n) {
      var ok = testPassed(st, String(n));
      if (L && L.locked(n)) {
        return '<a class="t-u' + n + ' is-locked" role="link" aria-disabled="true" tabindex="-1" data-lock-unit="' + n + '" aria-label="Test de l\'unité ' + n + ' — verrouillé : ' +
          esc(window.Unlock.lockText(n).fr.replace(/^Verrouillée · /, '')) + '">' + window.Unlock.lockIcon() + n + '<small>UNITÉ</small></a>';
      }
      return '<a class="t-u' + n + (ok ? ' ok' : '') + '" href="test?u=' + n + '" aria-label="Test de l\'unité ' + n + (ok ? ', réussi' : '') + '">' +
        (ok ? '<svg class="t-icon" style="width:16px;height:16px" aria-hidden="true"><use href="#n-check"/></svg>' : '') + n + '<small>UNITÉ</small></a>';
    }).join('');
    if (!grid._ulBound) {
      grid._ulBound = true;
      grid.addEventListener('click', function (e) {
        var a = e.target.closest && e.target.closest('[data-lock-unit]'); if (!a) return;
        e.preventDefault(); if (window.Unlock) window.Unlock.notice(+a.getAttribute('data-lock-unit'));
      });
    }
  }
  function openPratique(from) {
    var sh = $('#shPratique'); if (!sh) return;
    var st = readStore();
    var nm = 0, due = 0;
    var LK = window.Unlock ? window.Unlock.state(st) : null;                       // les erreurs d'une unité verrouillée ne comptent pas (comme dans faibles.html)
    try { nm = window.DuduMistakes.list(st, { open: true, maxUnit: LK ? LK.frontier : null }).length; } catch (e) {}
    try { var now = Date.now(); due = Object.values(st.memoire || {}).filter(function (c) { return c && c.due <= now; }).length; } catch (e) {}
    var fN = $('#faiblesN'); fN.hidden = !nm; fN.textContent = nm;
    $('#faiblesSub').textContent = nm ? nm + ' erreur' + (nm > 1 ? 's' : '') + ' à revoir' : 'Rien à revoir pour l\'instant';
    var mN = $('#memoireN'); mN.hidden = !due; mN.textContent = due;
    $('#memoireSub').textContent = due ? due + ' carte' + (due > 1 ? 's' : '') + ' due' + (due > 1 ? 's' : '') + ' aujourd\'hui' : 'Les cartes de vocabulaire';
    paintTests(st, window.Unlock ? window.Unlock.state(st) : null);
    /* Les tests des unités verrouillées (unlock.js, chargé par chaque page) sont grisés. Sans carte exercice → unité en cache,
       on dessine d'abord sans verrou puis on redessine dès que le cours est lu (test.html vérifie de toute façon). */
    if (window.Unlock && !window.Unlock.state(st)) window.Unlock.ready(st).then(function (l) { paintTests(st, l); });
    openSheet(sh, from || $('#tabPratique'));
  }

  /* ------------------------------ Moi ------------------------------ */
  var VOICE_ROWS = [['lea', 'lea'], ['dubois', 'dubois'], ['mamie', 'jo']];
  function castName(c) { try { return (window.Cast && window.Cast.NAMES && window.Cast.NAMES[c]) || c; } catch (e) { return c; } }
  function buildVoices() {
    var host = $('#voices'); if (!host) return;
    var picks = hasSfx() ? window.Sfx.voicePicks : {};
    host.innerHTML = VOICE_ROWS.map(function (r) {
      var key = r[0], cast = r[1], nm = esc(castName(cast));
      return '<div class="n-voice" data-char="' + key + '">' +
        '<span class="n-voice__av" data-react aria-hidden="true">' + face(cast) + '</span>' +
        '<span class="n-voice__nm">' + nm + '</span>' +
        '<span class="n-seg" role="group" aria-label="Voix de ' + nm + '">' + [['B', 'Voix 1'], ['C', 'Voix 2']].map(function (L) { return '<button type="button" data-l="' + L[0] + '" aria-pressed="' + (picks[key] === L[0]) + '">' + L[1] + '</button>'; }).join('') + '</span>' +
        '<button class="t-iconbtn" type="button" data-play aria-label="Écouter ' + nm + '">' + ic('play') + '</button>' +
        '</div>';
    }).join('');
  }
  /* Voix de prononciation (synthèse du navigateur) — même réglage store.ttsVoice que le panneau 🔊 de la page d'unité.
     Les voix dépendent de l'appareil ; même classement que la page d'unité : premium > France > voix « sérieuses ». */
  var TTS_NOVELTY = /^(Eddy|Flo|Grandma|Grandpa|Reed|Rocko|Sandy|Shelley|Bubbles|Jester|Superstar|Trinoids|Whisper|Wobble|Bahh|Boing|Bells|Organ|Cellos|Zarvox)\b/i;
  var TTS_PREMIUM = /premium|enhanced|améliorée?|amelioree?|siri/i;
  var TTS_SAMPLE = "Bonjour ! Je voudrais un kilo de pommes, s'il vous plaît.";
  function ttsVoices() {
    if (!('speechSynthesis' in window)) return [];
    var rank = function (v) {
      return (TTS_PREMIUM.test(v.name) ? 200 : 0) + ((v.lang || '').toLowerCase() === 'fr-fr' ? 100 : 0)
        + (/thomas|audrey|am[ée]lie|marie|virginie|jacques|chantal|nicolas|aurélie/i.test(v.name) ? 20 : 0) + (v.localService ? 10 : 0);
    };
    return speechSynthesis.getVoices()
      .filter(function (v) { return (v.lang || '').toLowerCase().indexOf('fr') === 0 && !TTS_NOVELTY.test(v.name); })
      .sort(function (a, b) { return rank(b) - rank(a); });
  }
  function buildTts() {
    var block = $('#ttsBlock'), sel = $('#ttsSel'); if (!block || !sel) return;
    var vs = ttsVoices();
    block.hidden = !vs.length;
    if (!vs.length) return;
    var cur = readStore().ttsVoice;
    if (!vs.some(function (v) { return v.voiceURI === cur; })) cur = vs[0].voiceURI;
    sel.innerHTML = vs.map(function (v) {
      var lang = (v.lang || '').toLowerCase(), pays = lang === 'fr-ca' ? ' · Canada' : lang === 'fr-be' ? ' · Belgique' : lang === 'fr-ch' ? ' · Suisse' : '';
      var nm = v.name.replace(/\s*\(French \([^)]+\)\)/, '').trim();
      return '<option value="' + esc(v.voiceURI) + '"' + (v.voiceURI === cur ? ' selected' : '') + '>' + (TTS_PREMIUM.test(v.name) ? '★ ' : '') + esc(nm) + pays + '</option>';
    }).join('');
  }
  function ttsSpeak() {
    var sel = $('#ttsSel'); if (!sel) return;
    var v = ttsVoices().filter(function (x) { return x.voiceURI === sel.value; })[0]; if (!v) return;
    var st = readStore();
    try {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(TTS_SAMPLE);
      u.voice = v; u.lang = v.lang || 'fr-FR';
      if (st.ttsRate) u.rate = +st.ttsRate;
      if (st.ttsPitch) u.pitch = +st.ttsPitch;
      speechSynthesis.speak(u);
    } catch (e) {}
  }
  /* ------------------------------ Hors ligne : « Télécharger l'unité » ------------------------------
     La page (Unite1_Revision.html) donne la liste des fichiers de l'unité affichée ; on les demande un par un à sw.js
     avec l'en-tête X-Dudu-Warm (voir prefetch() dans sw.js) : le service worker les range dans SES caches, avec SES
     plafonds (trim()), et répond par une réponse vide. Rien ne passe par /api. Sans service worker qui contrôle la
     page (premier chargement, navigateur privé…), on ne fait rien : le serveur renverrait les fichiers à la page
     pour rien. */
  /* Les caches AUDIO et IMAGES de sw.js — et ceux d'un nom d'avant un renommage, que sw.js reprend au fil de l'eau. */
  var OFF_CACHES = /-(audio|images)$/;
  var offUnit = null, offJob = null, offTimer = 0, offTried = {};
  function offController() { try { return navigator.serviceWorker && navigator.serviceWorker.controller; } catch (e) { return null; } }
  function offEl(id) { return document.getElementById(id); }
  function offSay(msg, warn) { var p = offEl('offStatus'); if (!p) return; p.hidden = !msg; p.textContent = msg || ''; p.classList.toggle('is-warn', !!warn); }
  function offBar(done, total) {
    var b = offEl('offBar'), f = offEl('offFill'); if (!b || !f) return;
    b.hidden = total == null; if (total) f.style.setProperty('--v', Math.round(done / total * 100) + '%');
  }
  function offMo(bytes) { return (bytes / 1048576).toFixed(bytes < 10485760 ? 1 : 0).replace('.', ',') + ' Mo'; }
  /* Combien de fichiers de l'unité sont déjà dans les caches de sw.js (lecture seule : ne change pas leur ordre). */
  function offCount(files) {
    if (!('caches' in window)) return Promise.resolve(0);
    return caches.keys().then(function (names) {
      return Promise.all(names.filter(function (n) { return OFF_CACHES.test(n); }).map(function (n) { return caches.open(n); }));
    }).then(function (open) {
      return Promise.all(files.map(function (f) {
        return Promise.all(open.map(function (k) { return k.match(f); }))
          .then(function (r) { return r.some(Boolean); }, function () { return false; });
      }));
    }).then(function (r) { return r.filter(Boolean).length; }, function () { return 0; });
  }
  function offPaint() {
    var blk = offEl('offlineBlock'); if (!blk) return;
    blk.hidden = !offUnit || !('serviceWorker' in navigator);
    if (blk.hidden) return;
    offEl('offTitle').textContent = (offJob ? offJob.unit : offUnit).label;
    var btn = offEl('offBtn');
    if (offJob) { btn.textContent = 'Arrêter'; btn.disabled = false; return; }
    btn.textContent = 'Télécharger';
    var u = offUnit;
    offCount(u.files).then(function (have) {
      if (offUnit !== u || offJob) return;
      var n = u.files.length;
      offEl('offSub').textContent = have >= n ? '✓ Prête hors ligne (ready offline) · ' + n + ' fichiers' : 'Sur l\'appareil : ' + have + ' / ' + n + ' fichiers';
      btn.disabled = have >= n;
    });
  }
  function offWarm(file, mode) {
    return fetch(file, { headers: { 'X-Dudu-Warm': mode }, cache: 'no-store', credentials: 'same-origin' }).then(function (r) {
      return { status: r.status, cached: r.headers.get('X-Dudu-Cached') === '1', size: +r.headers.get('X-Dudu-Size') || 0 };
    }, function () { return { status: 503, cached: false, size: 0 }; });
  }
  /* auto = le téléchargement tout seul sur Wi-Fi : mode 'fill' (jamais au prix d'une autre unité), sans message. */
  function offRun(auto) {
    if (offJob || !offUnit) return;
    if (!offController()) { if (!auto) offSay('Pas encore prêt : recharge la page une fois avec Internet, puis réessaie. (Reload once online, then try again.)', true); return; }
    if (navigator.onLine === false) { if (!auto) offSay('Pas d\'Internet : le téléchargement a besoin du réseau. (Needs internet.)', true); return; }
    var job = offJob = { unit: offUnit, auto: !!auto, stop: false };
    if (!auto) try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {}); } catch (e) {}
    var files = job.unit.files, n = files.length, done = 0, bytes = 0, missing = [], failed = 0, full = {};
    var kind = function (f) { return /_Audio\//.test(f) ? 'audio' : 'images'; };   // un plafond par cache dans sw.js
    offPaint(); offSay(''); if (!auto) offBar(0, n);
    var end = function (msg, warn) {
      offJob = null; offBar(null, null);
      if (!auto) offSay(msg, warn);
      offPaint();
    };
    var i = 0;
    // 1. ce qui est déjà là passe en dernier dans le cache (le plus récent) : le plafond enlèvera d'abord les autres unités.
    var touch = function () {
      if (job.stop) return end('Arrêté. (Stopped.)');
      if (i >= n) { i = 0; return get(); }
      var f = files[i++];
      (auto ? offCount([f]).then(function (h) { return { status: 204, cached: h > 0, size: 0 }; }) : offWarm(f, 'touch')).then(function (r) {
        if (r.cached) { done++; bytes += r.size; offBar(auto ? null : done, auto ? null : n); } else missing.push(f);
        touch();
      });
    };
    // 2. le reste, un fichier à la fois
    var get = function () {
      if (job.stop) return end('Arrêté. (Stopped.)');
      if (i >= missing.length) {
        return failed ? end(failed + ' fichier(s) introuvable(s) sur le serveur, le reste est prêt hors ligne.', true)
          : end('✓ ' + job.unit.label + ' : prête hors ligne (' + offMo(bytes) + '). Ready offline.');
      }
      var f = missing[i++];
      if (full[kind(f)]) return get();
      offWarm(f, auto ? 'fill' : 'get').then(function (r) {
        if (r.status === 401) return end('Session expirée : reconnecte-toi, puis réessaie. (Please log in again.)', true);
        if (r.status === 503) return end('Le réseau a coupé : ' + done + ' / ' + n + ' fichiers sont prêts. Touche « Télécharger » pour finir. (Connection lost.)', true);
        if (r.status === 507) { full[kind(f)] = true; return get(); }   // 'fill' : plus de place dans ce cache sans enlever une autre unité
        if (r.status >= 400) failed++; else { done++; bytes += r.size; }
        if (!auto) offBar(done, n);
        var sub = offEl('offSub'); if (sub) sub.textContent = 'Téléchargement… ' + done + ' / ' + n + ' fichiers · ' + offMo(bytes);
        get();
      });
    };
    touch();
  }
  /* Wi-Fi seulement si le navigateur le dit (Android Chrome) ; « économie de données » → jamais. */
  function offOnWifi() {
    try { var c = navigator.connection; return !!c && (c.type === 'wifi' || c.type === 'ethernet') && !c.saveData; } catch (e) { return false; }
  }
  function setOffline(o) {
    var files = o && o.files ? o.files.filter(function (f, i, a) { return f && a.indexOf(f) === i; }) : [];
    var same = offUnit && o && offUnit.unit === o.unit;
    offUnit = files.length ? { unit: o.unit, label: o.label || ('Unité ' + o.unit), files: files } : null;
    if (same) return;                                   // la page rappelle aussi à chaque changement de section : rien à refaire
    if (!offJob) { offSay(''); offPaint(); }
    if (!offUnit) return;
    clearTimeout(offTimer);
    // Une fois par unité et par chargement de page, quelques secondes après l'affichage (la page charge d'abord ce qu'elle montre).
    offTimer = setTimeout(function () {
      if (!offUnit || offJob || offTried[offUnit.unit] || !offOnWifi() || navigator.onLine === false || !offController()) return;
      offTried[offUnit.unit] = true;
      offRun(true);
    }, 5000);
  }

  function openMoi(from) {
    var sh = $('#shMoi'); if (!sh) return;
    buildVoices(); buildTts(); syncTheme(); syncMute(); offPaint();
    openSheet(sh, from || $('#tabMoi') || $('#avatarBtn'));
  }

  /* ------------------------------ markup ------------------------------ */
  function topbarHtml(o) {
    var mute = '<button class="t-mute n-mute" type="button" aria-label="Couper le son" title="Son"></button>';
    var avatar = '<button class="t-iconbtn t-iconbtn--round" id="avatarBtn" type="button" aria-haspopup="dialog" aria-label="Moi : réglages" title="Moi">' + ic('user') + '</button>';
    if (o.topbar === 'full') {
      return '<div class="n-bar">' +
        '<a class="n-brand" href="app" aria-label="DuDu — Parcours"><span class="n-brand__face" id="brandFace" aria-hidden="true">' + face('lea', 'happy') + '</span><span class="n-brand__name">DuDu</span></a>' +
        '<span class="t-chip t-chip--fire" id="streakChip" title="Jours de suite où vous avez travaillé" aria-label="Série : 0 jour">' + ic('flame') + '<span id="streakN">0</span></span>' +
        '<span class="t-chip t-chip--ok n-pct" id="pctChip" title="Progression sur tout le parcours" aria-label="Progression totale">' + ic('route') + '<span id="pctN">…</span></span>' +
        mute + avatar + '</div>';
    }
    var back = o.back === null || o.back === false ? '' :
      '<a class="t-iconbtn n-back" id="navBack" href="' + esc(o.back == null || o.back === '' ? 'app' : o.back) + '" aria-label="Retour au parcours" title="Retour">' + ic('arrow') + '</a>';
    return '<div class="n-bar">' + back + '<div class="t-h3 n-title" id="navTitle">' + esc(o.title) + '</div>' + mute + avatar + '</div>';
  }
  function tabbarHtml(active) {
    function cur(n, kind) { return active === n ? (kind === 'link' ? ' aria-current="page"' : ' aria-current="true"') : ''; }
    return '<a class="t-tab" href="app"' + cur('parcours', 'link') + '><span class="t-tab__ic">' + ic('route') + '</span>Parcours</a>' +
      '<a class="t-tab" href="plan"' + cur('plan', 'link') + '><span class="t-tab__ic">' + ic('cal') + '</span>Plan</a>' +
      '<button class="t-tab" type="button" id="tabPratique" aria-haspopup="dialog"' + cur('pratique') + '><span class="t-tab__ic">' + ic('target') + '</span>Pratique</button>' +
      '<a class="t-tab" href="carnet"' + cur('carnet', 'link') + '><span class="t-tab__ic">' + ic('book') + '</span>Carnet</a>' +
      '<button class="t-tab" type="button" id="tabMoi" aria-haspopup="dialog"' + cur('moi') + '><span class="t-tab__ic">' + ic('user') + '</span>Moi</button>';
  }
  var SHEETS_HTML =
    '<div class="t-sheet n-sheet" id="shPratique" aria-hidden="true" data-nav>' +
      '<div class="t-sheet__scrim" data-close></div>' +
      '<div class="t-sheet__panel" role="dialog" aria-modal="true" aria-labelledby="praTitle" tabindex="-1">' +
        '<span class="t-sheet__grip"></span>' +
        '<div class="n-sh-head"><div><h2 class="t-h2" id="praTitle">Pratique</h2><p class="t-small n-sh-sub">Travailler un point précis, hors du parcours.</p></div>' +
          '<button class="t-iconbtn" type="button" data-close aria-label="Fermer">' + ic('x') + '</button></div>' +
        '<div class="n-list">' +
          '<a class="n-row" href="faibles" id="rowFaibles"><span class="n-row__ic">' + ic('target') + '</span><span class="n-row__tx"><b>Points faibles</b><span id="faiblesSub">Ce que tu rates le plus</span></span><span class="n-row__n" id="faiblesN" hidden>0</span><svg class="n-row__ar" aria-hidden="true"><use href="#n-arrow"/></svg></a>' +
          '<a class="n-row" href="memoire" id="rowMemoire"><span class="n-row__ic">' + ic('cards') + '</span><span class="n-row__tx"><b>Mémoire</b><span id="memoireSub">Les cartes de vocabulaire</span></span><span class="n-row__n" id="memoireN" hidden style="background:var(--t-teal)">0</span><svg class="n-row__ar" aria-hidden="true"><use href="#n-arrow"/></svg></a>' +
          '<a class="n-row" href="ecoute"><span class="n-row__ic">' + ic('phones') + '</span><span class="n-row__tx"><b>Écoute</b><span>Écouter et comprendre</span></span><svg class="n-row__ar" aria-hidden="true"><use href="#n-arrow"/></svg></a>' +
          '<a class="n-row" href="atelier"><span class="n-row__ic">' + ic('pencil') + '</span><span class="n-row__tx"><b>Atelier d\'écriture</b><span>Écrire, corriger, réécrire</span></span><svg class="n-row__ar" aria-hidden="true"><use href="#n-arrow"/></svg></a>' +
        '</div>' +
        '<span class="t-label n-sec">Tests de fin d\'unité</span>' +
        '<div class="n-tests" id="testsGrid"></div>' +
      '</div>' +
    '</div>' +
    '<div class="t-sheet n-sheet" id="shMoi" aria-hidden="true" data-nav>' +
      '<div class="t-sheet__scrim" data-close></div>' +
      '<div class="t-sheet__panel" role="dialog" aria-modal="true" aria-labelledby="moiTitle" tabindex="-1">' +
        '<span class="t-sheet__grip"></span>' +
        '<div class="n-sh-head"><div><h2 class="t-h2" id="moiTitle">Moi</h2></div>' +
          '<button class="t-iconbtn" type="button" data-close aria-label="Fermer">' + ic('x') + '</button></div>' +
        '<div class="n-setrow" id="soundRow"><div><b>Son</b><span class="t-small" id="soundSub">Effets et voix de la troupe</span></div><button class="t-mute n-mute" type="button" aria-label="Couper le son" title="Son"></button></div>' +
        '<div class="n-setrow n-test" id="testRow"><div><b>Tester les sons</b><span class="t-small">Un petit tour des effets et des voix</span></div><button class="t-btn t-btn--secondary t-btn--sm" type="button" id="testBtn">Tester</button></div>' +
        '<p class="n-test-status" id="testStatus" role="status" aria-live="polite" hidden></p>' +
        '<span class="t-label n-sec">Thème</span>' +
        '<div class="n-setrow n-setrow--wrap"><div><span class="t-small">Clair, sombre ou comme ton téléphone</span></div>' +
          '<div class="n-seg" role="group" aria-label="Thème" id="themeSeg">' +
            '<button type="button" data-theme="auto" aria-pressed="false">Auto</button><button type="button" data-theme="light" aria-pressed="false">Clair</button><button type="button" data-theme="dark" aria-pressed="false">Sombre</button>' +
          '</div></div>' +
        '<div id="voicesBlock">' +
          '<span class="t-label n-sec">Voix de la troupe</span>' +
          '<p class="t-small n-sh-sub">Choisis la voix de chacun : Voix 1 ou Voix 2.</p>' +
          '<div id="voices" data-react></div>' +
        '</div>' +
        '<div id="ttsBlock" hidden>' +
          '<span class="t-label n-sec">Voix de prononciation</span>' +
          '<p class="t-small n-sh-sub">La voix qui lit le français : 🔈 Écouter, les phrases, les exemples. Les voix ★ sont les plus naturelles.</p>' +
          '<div class="n-tts"><select id="ttsSel" aria-label="Voix de prononciation"></select>' +
          '<button class="t-iconbtn" type="button" id="ttsPlay" aria-label="Écouter un exemple">' + ic('play') + '</button></div>' +
        '</div>' +
        '<div id="installBlock" hidden>' +
          '<span class="t-label n-sec">Application</span>' +
          '<div class="n-setrow"><div><b>Sur l\'écran d\'accueil</b><span class="t-small">Ouvrir DuDu comme une vraie app</span></div><button class="t-btn t-btn--secondary t-btn--sm" type="button" id="installBtn">Voir comment</button></div>' +
        '</div>' +
        '<div id="offlineBlock" hidden>' +
          '<span class="t-label n-sec">Hors ligne</span>' +
          '<div class="n-setrow"><div><b id="offTitle">Cette unité</b><span class="t-small" id="offSub">Audio et images, pour le métro</span></div>' +
            '<button class="t-btn t-btn--secondary t-btn--sm" type="button" id="offBtn">Télécharger</button></div>' +
          '<div class="t-progress t-progress--sm t-progress--teal n-off-bar" id="offBar" hidden><i id="offFill"></i></div>' +
          '<p class="n-test-status" id="offStatus" role="status" aria-live="polite" hidden></p>' +
          '<p class="t-small n-sh-sub">Les enregistrements et les images de l\'unité restent sur l\'appareil : on les écoute sans réseau (métro, avion). ' +
            'Environ 50 Mo, une seule unité à la fois : la suivante prend la place de la précédente.' +
            '<span class="n-inst-en">Saves this unit\'s recordings (enregistrements) and pictures on the device, for no signal. One unit at a time.</span></p>' +
        '</div>' +
        '<span class="t-label n-sec">Compte</span>' +
        '<div class="n-who" style="margin-top:8px">' +
          '<span class="t-small" id="whoLine" hidden></span>' +
          '<button class="t-btn t-btn--secondary t-btn--sm" type="button" id="logoutBtn" hidden>Déconnexion</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  /* ------------------------------ « DuDu sur l'écran d'accueil » ------------------------------
     Un tutoriel en 3 étapes (Retour / Suivant / Terminé) qui montre comment ajouter le site à l'écran d'accueil, pour
     l'ouvrir comme une app (manifest.webmanifest : display standalone). Il s'ouvre tout seul une seule fois par appareil,
     sur iPhone / iPad / Android, quand la page n'est pas déjà ouverte depuis l'écran d'accueil (maybeShowInstall,
     appelé par app.html). On peut le revoir depuis Moi → Application. Le « déjà vu » reste sur l'appareil (hors du store
     synchronisé) : un nouveau téléphone doit l'afficher aussi. Sur Android, si Chrome propose l'installation
     (beforeinstallprompt), un bouton « Installer maintenant » fait tout en un geste. */
  var INST_SEEN = 'dudu-install-seen';
  var instPrompt = null, instStep = 0, instPlat = '';
  var SVG_SHARE = '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5"/><path d="M8.5 10H6.5A1.5 1.5 0 0 0 5 11.5v8A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-8a1.5 1.5 0 0 0-1.5-1.5h-2"/></g></svg>';
  var SVG_PLUS = '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8.5v7M8.5 12h7"/></g></svg>';
  var SVG_DOTS = '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="currentColor"><circle cx="12" cy="5" r="2.1"/><circle cx="12" cy="12" r="2.1"/><circle cx="12" cy="19" r="2.1"/></g></svg>';
  var SVG_LINE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
  var APP_IMG = '<img src="icons/v4/icon-192.png" alt="">';

  function instPlatform() {
    try {
      var ua = navigator.userAgent || '';
      if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
      if (/Android/i.test(ua)) return 'android';
    } catch (e) {}
    return '';
  }
  function isStandalone() {
    try {
      if (navigator.standalone === true) return true;
      return window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches;
    } catch (e) { return false; }
  }
  function instSeen() { try { return localStorage.getItem(INST_SEEN) === '1'; } catch (e) { return true; } }
  function instMarkSeen() { try { localStorage.setItem(INST_SEEN, '1'); } catch (e) {} }

  /* les maquettes : ce que la personne va voir à l'écran, avec le bon bouton qui clignote (.is-hot) */
  function instMock(id) {
    var host = esc(location.host || 'dudu');
    var url = '<div class="n-im__url"><span>' + host + '</span></div>';
    switch (id) {
      case 'ios-bar': return '<div class="n-im">' + url + '<div class="n-im__bar"><i>‹</i><i>›</i><i class="is-hot">' + SVG_SHARE + '</i><i>' + ic('book') + '</i><i>' + ic('cards') + '</i></div></div>';
      case 'ios-menu': return '<div class="n-im"><div class="n-im__list">' +
        '<div class="n-im__li">' + ic('cards') + 'Copier</div>' +
        '<div class="n-im__li">' + ic('book') + 'Ajouter un signet</div>' +
        '<div class="n-im__li is-hot">' + SVG_PLUS + 'Sur l\'écran d\'accueil</div></div></div>';
      case 'ios-add': return '<div class="n-im"><div class="n-im__dlg">' +
        '<div class="n-im__top"><span>Annuler</span><b>Sur l\'écran d\'accueil</b><span class="n-im__btn is-hot">Ajouter</span></div>' +
        '<div class="n-im__app">' + APP_IMG + 'DuDu</div></div></div>';
      case 'and-bar': return '<div class="n-im"><div class="n-im__bar" style="gap:8px"><div class="n-im__url" style="flex:1"><span>' + host + '</span></div><i class="is-hot">' + SVG_DOTS + '</i></div></div>';
      case 'and-menu': return '<div class="n-im"><div class="n-im__list">' +
        '<div class="n-im__li">' + SVG_LINE + 'Nouvel onglet</div>' +
        '<div class="n-im__li">' + SVG_LINE + 'Historique</div>' +
        '<div class="n-im__li is-hot">' + SVG_PLUS + 'Ajouter à l\'écran d\'accueil</div></div></div>';
      case 'and-add': return '<div class="n-im"><div class="n-im__dlg">' +
        '<div class="n-im__top"><b>Installer l\'application ?</b></div>' +
        '<div class="n-im__app">' + APP_IMG + 'DuDu</div>' +
        '<div class="n-im__btns"><span class="n-im__btn">Annuler</span><span class="n-im__btn is-hot">Installer</span></div></div></div>';
    }
    return '';
  }
  /* t / en : le titre en français + sa traduction ; s / sen : le détail + sa traduction */
  var INST_STEPS = {
    ios: [
      { mock: 'ios-bar', t: 'Touche le bouton <b>Partager</b>', en: 'Tap the Share button',
        s: 'Il est en bas de Safari (en haut sur iPad). Tu ne le vois pas ? Touche d\'abord <b>•••</b>.', sen: 'It\'s at the bottom of Safari (at the top on iPad). Can\'t see it? Tap ••• first.' },
      { mock: 'ios-menu', t: 'Choisis <b>Sur l\'écran d\'accueil</b>', en: 'Choose “Add to Home Screen”',
        s: 'Tu ne le vois pas ? Touche d\'abord <b>Afficher plus</b>, ou fais glisser la liste vers le haut.', sen: 'Can\'t see it? Tap “View More” first, or swipe the list up.' },
      { mock: 'ios-add', t: 'Touche <b>Ajouter</b>', en: 'Tap “Add”',
        s: 'C\'est fini ! Ouvre maintenant DuDu avec la nouvelle icône sur ton écran d\'accueil.', sen: 'All done! Now open DuDu from the new icon on your home screen.' }
    ],
    android: [
      { mock: 'and-bar', t: 'Touche le menu <b>⋮</b>', en: 'Tap the ⋮ menu',
        s: 'Les trois points, en haut à droite de Chrome.', sen: 'The three dots, at the top right of Chrome.' },
      { mock: 'and-menu', t: 'Choisis <b>Ajouter à l\'écran d\'accueil</b>', en: 'Choose “Add to Home screen”',
        s: 'Parfois, c\'est écrit <b>Installer l\'application</b>.', sen: 'Sometimes it says “Install app”.' },
      { mock: 'and-add', t: 'Touche <b>Installer</b>', en: 'Tap “Install”',
        s: 'C\'est fini ! Ouvre maintenant DuDu avec la nouvelle icône sur ton écran d\'accueil.', sen: 'All done! Now open DuDu from the new icon on your home screen.' }
    ]
  };
  var INSTALL_HTML =
    '<div class="t-sheet n-sheet" id="shInstall" aria-hidden="true" data-nav>' +
      '<div class="t-sheet__scrim" data-close></div>' +
      '<div class="t-sheet__panel" role="dialog" aria-modal="true" aria-labelledby="instTitle" tabindex="-1">' +
        '<span class="t-sheet__grip"></span>' +
        '<div class="n-inst-head">' + APP_IMG +
          '<div><h2 class="t-h3" id="instTitle">DuDu, comme une vraie app</h2>' +
          '<span class="n-inst-en">Use DuDu like a real app — 3 quick steps</span></div>' +
          '<button class="t-iconbtn" type="button" data-close aria-label="Fermer">' + ic('x') + '</button></div>' +
        '<div id="instBody" aria-live="polite"></div>' +
        '<button class="t-btn t-btn--teal t-btn--block t-btn--sm n-inst-now" type="button" id="instNow" hidden>Installer maintenant</button>' +
        '<div class="n-inst-dots" id="instDots" aria-hidden="true"><span></span><span></span><span></span></div>' +
        '<div class="n-inst-foot">' +
          '<button class="t-btn t-btn--secondary t-btn--sm" type="button" id="instBack">Plus tard</button>' +
          '<button class="t-btn t-btn--sm" type="button" id="instNext">Suivant</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  function instRender(dir) {
    var steps = INST_STEPS[instPlat] || INST_STEPS.ios, s = steps[instStep], last = instStep === steps.length - 1;
    var body = $('#instBody'); if (!body) return;
    body.innerHTML = '<div class="n-inst-step' + (dir < 0 ? ' is-back' : '') + '">' +
      '<p class="t-label n-inst-n">Étape ' + (instStep + 1) + ' sur ' + steps.length + '</p>' +
      instMock(s.mock) +
      '<p class="n-inst-t">' + s.t + '<span class="n-inst-en">' + esc(s.en) + '</span></p>' +
      '<p class="t-small n-inst-s">' + s.s + '<span class="n-inst-en">' + esc(s.sen) + '</span></p>' +
    '</div>';
    $$('#instDots span').forEach(function (d, i) { d.classList.toggle('is-on', i === instStep); });
    var back = $('#instBack'), next = $('#instNext');
    if (back) back.textContent = instStep === 0 ? 'Plus tard' : 'Retour';
    if (next) next.textContent = last ? 'Terminé' : 'Suivant';
    var now = $('#instNow'); if (now) now.hidden = !(instPrompt && instPlat === 'android');
  }
  function instGo(d) {
    var n = (INST_STEPS[instPlat] || INST_STEPS.ios).length;
    if (d > 0 && instStep >= n - 1) { sfx('tap'); closeSheet(); return; }
    if (d < 0 && instStep === 0) { closeSheet(); return; }
    instStep = Math.max(0, Math.min(n - 1, instStep + d));
    sfx('tap');
    instRender(d);
  }
  /* openInstall(from?, platform?) — platform 'ios' | 'android' force l'une des deux versions (sinon : celle de l'appareil, iPhone par défaut) */
  function openInstall(from, plat) {
    var sh = $('#shInstall'); if (!sh) return;
    instPlat = plat === 'ios' || plat === 'android' ? plat : (instPlatform() || 'ios');
    instStep = 0;
    instMarkSeen();
    instRender(0);
    openSheet(sh, from);
  }
  /* la première fois sur un téléphone, hors écran d'accueil : on attend un peu que la page soit posée, et qu'aucune autre feuille ne soit ouverte */
  function maybeShowInstall() {
    if (!instPlatform() || isStandalone() || instSeen()) return;
    var tries = 0;
    (function tryOpen() {
      if (instSeen() || isStandalone()) return;
      if ((openSh || document.hidden) && tries++ < 20) { setTimeout(tryOpen, 1500); return; }
      if (openSh) return;
      openInstall(null);
    })();
  }
  try {
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault(); instPrompt = e;
      var now = $('#instNow'); if (now && instPlat === 'android') now.hidden = false;
    });
    window.addEventListener('appinstalled', function () {
      instPrompt = null; instMarkSeen();
      var sh = $('#shInstall'); if (sh && openSh === sh) closeSheet();
      var b = $('#installBlock'); if (b) b.hidden = true;
    });
  } catch (e) {}
  function wireInstall() {
    var b = $('#installBlock'); if (b) b.hidden = !instPlatform() || isStandalone();
    var ib = $('#installBtn'); if (ib) ib.addEventListener('click', function () { sfx('tap'); openInstall($('#tabMoi') || $('#avatarBtn')); });
    var nx = $('#instNext'); if (nx) nx.addEventListener('click', function () { instGo(1); });
    var bk = $('#instBack'); if (bk) bk.addEventListener('click', function () { instGo(-1); });
    var now = $('#instNow'); if (now) now.addEventListener('click', function () {
      if (!instPrompt) return;
      var p = instPrompt; instPrompt = null; now.hidden = true;
      try { p.prompt(); p.userChoice.then(function (r) { if (r && r.outcome === 'accepted') closeSheet(); }, function () {}); } catch (e) {}
    });
  }

  /* ------------------------------ tab bar : toujours collée en bas ------------------------------
     Sur iPhone, après être sorti d'une leçon (page à overflow:hidden) puis avoir fait défiler, la barre « fixed; bottom:0 »
     s'est retrouvée posée ~115 pt trop haut, du contenu visible dessous : iOS l'a placée en bas d'un viewport de mise en
     page périmé, plus court que l'écran. On compare donc le bas de la barre au bas de la zone réellement visible
     (visualViewport) et on la redescend de l'écart. Cas normal : écart nul, aucun transform. Zoom au pincement : on ne
     touche à rien (le visualViewport ne représente plus l'écran). */
  var pinRaf = 0;
  function pinTabbar() {
    pinRaf = 0;
    var bar = $('.t-tabbar'), vv = window.visualViewport;
    if (!bar || !vv) return;
    if (Math.abs(vv.scale - 1) > 0.01) { bar.style.transform = ''; return; }
    var cur = parseFloat(bar.dataset.pinY || '0') || 0;
    var gap = (vv.offsetTop + vv.height) - (bar.getBoundingClientRect().bottom - cur);
    var y = gap > 2 ? Math.round(gap) : 0;      // jamais vers le haut : clavier ouvert, la barre reste derrière lui
    if (y === cur) return;
    bar.dataset.pinY = String(y);
    bar.style.transform = y ? 'translateY(' + y + 'px)' : '';
  }
  function schedulePin() { if (!pinRaf) pinRaf = requestAnimationFrame(pinTabbar); }

  /* ------------------------------ mount ------------------------------ */
  var built = [];          // nodes added by the last mount()
  var addedTabbarCls = false;   // true when mount() put .t-has-tabbar on <body> (unmount takes it off again)
  var wired = false;       // listeners on window/document are registered once
  function unmount() {
    if (openSh) closeSheet(true);
    built.forEach(function (n) { if (n.parentNode) n.parentNode.removeChild(n); });
    built = [];
    if (addedTabbarCls) { document.body.classList.remove('t-has-tabbar'); addedTabbarCls = false; }
  }
  function add(parent, node, first) {
    if (first) parent.insertBefore(node, parent.firstChild); else parent.appendChild(node);
    built.push(node);
    return node;
  }
  function mount(opts) {
    if (!document.body) { document.addEventListener('DOMContentLoaded', function () { mount(opts); }); return; }
    var o = { active: null, title: '', back: 'app', topbar: 'page', tabbar: true };
    for (var k in (opts || {})) if (Object.prototype.hasOwnProperty.call(opts, k) && opts[k] !== undefined) o[k] = opts[k];
    unmount();
    if (!$('#nav-css')) { var st = document.createElement('style'); st.id = 'nav-css'; st.textContent = CSS; document.head.appendChild(st); }
    if (!$('#nav-sprite')) { var sp = document.createElement('div'); sp.innerHTML = SPRITE; document.body.appendChild(sp.firstChild); }
    var host = document.getElementById('app') || document.body;
    applyStoreTheme();

    if (o.topbar === 'full' || o.topbar === 'page') {
      var hd = document.createElement('header');
      hd.className = 't-topbar t-topbar--sticky n-top';
      hd.innerHTML = topbarHtml(o);
      add(host, hd, true);
    }
    if (o.tabbar) {
      var nv = document.createElement('nav');
      nv.className = 't-tabbar'; nv.setAttribute('aria-label', 'Navigation');
      nv.innerHTML = tabbarHtml(o.active);
      add(host, nv, false);
      if (!document.body.classList.contains('t-has-tabbar')) { document.body.classList.add('t-has-tabbar'); addedTabbarCls = true; }
    }
    var wrap = document.createElement('div');
    wrap.innerHTML = SHEETS_HTML + INSTALL_HTML;
    while (wrap.firstChild) add(document.body, wrap.firstChild, false);

    $$('a.t-tab').forEach(function (a) { a.addEventListener('click', function () { sfx('tap'); }); });
    var tp = $('#tabPratique'); if (tp) tp.addEventListener('click', function () { openPratique(tp); });
    var tm = $('#tabMoi'); if (tm) tm.addEventListener('click', function () { openMoi(tm); });
    var av = $('#avatarBtn'); if (av) av.addEventListener('click', function () { openMoi(av); });
    $$('.n-mute').forEach(function (b) { b.addEventListener('click', function () { if (!hasSfx()) return; window.Sfx.toggle(); syncMute(); if (!window.Sfx.muted) sfx('tap'); }); });
    $('#themeSeg').addEventListener('click', function (e) { var b = e.target.closest('[data-theme]'); if (b) { sfx('tap'); setTheme(b.dataset.theme); } });
    $('#voices').addEventListener('click', function (e) {
      var row = e.target.closest('.n-voice'); if (!row) return;
      var key = row.dataset.char;
      var lb = e.target.closest('[data-l]');
      if (lb) {
        if (hasSfx()) window.Sfx.setVoice(key, lb.dataset.l);
        $$('[data-l]', row).forEach(function (b) { b.setAttribute('aria-pressed', String(b === lb)); });
        return;
      }
      if (e.target.closest('[data-play]')) sfx('hello', { char: key });
    });

    /* voix de prononciation : choisir l'enregistre et la fait entendre ; les pages ouvertes en sont prévenues */
    var ttsSel = $('#ttsSel');
    if (ttsSel) ttsSel.addEventListener('change', function () {
      var uri = ttsSel.value;
      save(function (st) { st.ttsVoice = uri; });
      try { window.dispatchEvent(new CustomEvent('dudu:ttsvoice', { detail: uri })); } catch (e) {}
      ttsSpeak();
    });
    var ttsPlay = $('#ttsPlay'); if (ttsPlay) ttsPlay.addEventListener('click', ttsSpeak);
    if ('speechSynthesis' in window) try { speechSynthesis.addEventListener('voiceschanged', function () { if (openSh) buildTts(); }); } catch (e) {}

    /* Sfx absent → no son, no voix */
    if (!hasSfx()) { var sr = $('#soundRow'), vb = $('#voicesBlock'), tr = $('#testRow'); if (sr) sr.hidden = true; if (vb) vb.hidden = true; if (tr) tr.hidden = true; }

    /* « Tester les sons » : un petit tour des sons + l'état de l'audio (utile sur iPhone : mode silencieux, son coupé…) */
    var testBtn = $('#testBtn'), testSt = $('#testStatus');
    function testSay(msg, warn) { if (!testSt) return; testSt.hidden = false; testSt.textContent = msg; testSt.classList.toggle('is-warn', !!warn); }
    var HINT = ' Vérifie que l’iPhone n’est pas en mode silencieux (bouton sur le côté) et que le son n’est pas coupé dans l’app.';
    if (testBtn) testBtn.addEventListener('click', function () {
      if (!hasSfx() || typeof window.Sfx.test !== 'function') return;
      if (window.Sfx.muted) { testSay('Le son est coupé dans l’app : touche le haut-parleur (« Son ») pour le remettre, puis réessaie.', true); return; }
      testBtn.disabled = true;
      testSay('Test en cours… écoute : un clic, une bonne réponse, une erreur, une série, la fin d’une leçon.');
      window.Sfx.test().then(function (d) {
        testBtn.disabled = false;
        d = d || {};
        if (d.state !== 'running') testSay('L’audio n’est pas démarré (état : ' + (d.state || 'inconnu') + '). Touche « Tester » encore une fois.' + HINT, true);
        else if (!d.buffersLoaded) testSay('Audio actif, mais aucun son n’est chargé pour l’instant (sons de secours seulement).' + HINT, true);
        else testSay('Audio actif · ' + d.buffersLoaded + ' sons prêts. Rien entendu ?' + HINT);
      }, function () { testBtn.disabled = false; });
    });

    /* compte */
    var logoutBtn = $('#logoutBtn');
    logoutBtn.addEventListener('click', function () { try { window.DuduSync.logout('/login'); } catch (e) { location.href = '/login'; } });
    try {
      if (window.DuduSync && typeof window.DuduSync.whoami === 'function') {
        window.DuduSync.whoami().then(function (u) {
          if (!u) return;
          var w = $('#whoLine'); if (!w) return;
          w.hidden = false; w.textContent = 'Connecté : ' + u;
          logoutBtn.hidden = false;
        });
      }
    } catch (e) {}

    wireInstall();
    var offBtn = $('#offBtn'); if (offBtn) offBtn.addEventListener('click', function () {
      sfx('tap');
      if (offJob) { offJob.stop = true; offBtn.disabled = true; } else offRun(false);
    });
    offPaint();

    renderStreak(); syncMute(); syncTheme();
    schedulePin();
    if (!wired) {
      wired = true;
      /* la barre du bas recalée sur la zone visible (voir pinTabbar) */
      window.addEventListener('scroll', schedulePin, { passive: true });
      window.addEventListener('resize', schedulePin);
      window.addEventListener('load', schedulePin);
      window.addEventListener('pageshow', schedulePin);
      window.addEventListener('orientationchange', schedulePin);
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', schedulePin);
        window.visualViewport.addEventListener('scroll', schedulePin);
      }
      window.addEventListener('storage', function (e) {
        if (e.key !== LS && e.key !== null) return;
        if (applyStoreTheme()) { syncTheme(); emitTheme(); }
        syncMute(); renderStreak();
      });
      document.addEventListener('visibilitychange', function () { if (!document.hidden) refresh(); });
      window.addEventListener('pageshow', function (e) { if (e.persisted) refresh(); });
    }
  }
  function refresh() { renderStreak(); syncMute(); syncTheme(); }

  /* Hors ligne : sw.js garde l'application sur l'appareil (voir l'en-tête de sw.js). Enregistré d'ici parce que
     nav.js n'est chargé que par les pages derrière le mot de passe — jamais par /login ni /signup.
     updateViaCache 'none' : le navigateur revérifie sw.js à chaque fois, sans passer par son cache HTTP. */
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    var regSw = function () { try { navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(function () {}); } catch (e) {} };
    if (document.readyState === 'complete') regSw(); else window.addEventListener('load', regSw);
  }

  window.DuduNav = {
    version: 1,
    mount: mount, unmount: unmount, refresh: refresh, setProgress: setProgress,
    openPratique: openPratique, openMoi: openMoi,
    openInstall: openInstall, maybeShowInstall: maybeShowInstall, isStandalone: isStandalone,
    setOffline: setOffline,
    openSheet: openSheet, closeSheet: closeSheet,
    isSheetOpen: function () { return !!openSh; },
    onSheetClose: function (fn) { if (typeof fn === 'function') closeFns.push(fn); },
    save: save, readStore: readStore,
    setTheme: setTheme, themeMode: themeMode, isDark: isDark
  };
})();
