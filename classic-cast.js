/*!
 * classic-cast.js — « La Troupe » : the unit leader floats on the CLASSIC revision page (Unite1_Revision.html).
 *
 *   • Classic mode only. Lesson mode (?mode=lesson) has its own cast (lesson.js), so nothing is mounted there.
 *   • Needs cast.js (window.Cast); sfx.js (window.Sfx) and nav.js (the .t-tabbar) are optional — every call is guarded.
 *   • Reads and writes NO localStorage and never touches the page's store. Only sessionStorage 'dudu-cc-collapsed'
 *     (the "small face" state, per tab).
 *
 * What it does
 *   – a small round Léa (72px; Mamie Jo in unit 2, M. Dubois in unit 3 — the same LEADER rule as app.html), bottom-right,
 *     just above nav.js's tab bar (measured, safe-area aware), re-mounted when the page switches unit (body[data-unit]);
 *   – a fold button turns her into a 44px face; tapping the face brings her back; she hides while a text field has focus;
 *   – listens to document 'dudu:checked' {id, ok, tot, kind, final?}:
 *       ex/dic ≥ 80 %  ·  spk/speak/conv ≥ 60 % (final !== false)   → happy + Sfx 'correct' + a bubble with what the voice says
 *                                                                      (« Parfait ! », « Trois d’affilée ! » on a streak…; « Bravo ! » … when Sfx is absent)
 *       below that                                                   → sad   + Sfx 'wrong'   + the spoken « Oups ! / Presque ! … » (or « Regarde la correction. »)
 *       spk turn missed (final:false)                                → brief sad + Sfx 'wrong', no bubble
 *       an exercise checked with nothing answered                    → nothing (that is not a mistake)
 *   – tap → Sfx 'mascot' (+ the spoken « Coucou ! » in the bubble); window 'dudu:speak' → she hops while her character speaks.
 *     The bubble text comes from the 'dudu:speak' event of that very Sfx.play (sent also while the sound is muted).
 *   Debug handle: window.ClassicCast {el, leader(), react(detail), unit(n)}.
 */
(function () {
  'use strict';
  if (window.ClassicCast || !window.__troupeClassic) return;
  try { if (new URLSearchParams(location.search).get('mode') === 'lesson') return; } catch (e) { /* ignore */ }

  var LEADER = { 1: 'lea', 2: 'jo', 3: 'dubois', 4: 'lea', 5: 'lea' };   // same rule as app.html
  var BG = { lea: 'var(--t-teal-l,#D4EFEA)', jo: 'var(--t-blush-l,#FDE9E2)', dubois: 'var(--t-mustard-l,#FFF0C6)' };
  var GOOD = ['Bravo !', 'Super !', 'Parfait !'];
  var BAD = ['Presque !', 'Regarde la correction.'];
  var KEY = 'dudu-cc-collapsed';
  var THRESH = { ex: 0.8, dic: 0.8, spk: 0.6, speak: 0.6, conv: 0.6 };

  function guard(f) { try { return f(); } catch (e) { return undefined; } }
  function sget() { return guard(function () { return sessionStorage.getItem(KEY); }); }
  function sset(v) { guard(function () { sessionStorage.setItem(KEY, v); }); }
  function reduced() { return !!guard(function () { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }); }
  function sfx(name, o) { guard(function () { if (window.Sfx && window.Sfx.play) window.Sfx.play(name, o); }); }
  function sfxChar(c) { return c === 'jo' ? 'mamie' : c; }

  var CSS = [
    '.cc{position:fixed;right:max(10px,env(safe-area-inset-right,0px));bottom:calc(var(--cc-b,calc(68px + env(safe-area-inset-bottom,0px))) + 8px);z-index:45;',
    '  display:flex;flex-direction:column;align-items:flex-end;gap:6px;pointer-events:none;transition:opacity .18s ease,transform .18s ease}',
    '.cc.is-away{opacity:0;transform:translateY(8px);visibility:hidden;transition:opacity .18s ease,transform .18s ease,visibility 0s .18s}',
    '.cc-wrap{position:relative;width:72px;height:72px;transition:width .2s ease,height .2s ease}',
    '.cc.is-min .cc-wrap{width:44px;height:44px}',
    '.cc-fig{display:block;width:100%;height:100%;margin:0;padding:0;border-radius:50%;overflow:hidden;cursor:pointer;pointer-events:auto;',
    '  border:2px solid var(--t-rim,#2B2230);background:var(--cc-bg,#D4EFEA);box-shadow:0 3px 0 var(--t-edge,#2B2230);',
    '  -webkit-appearance:none;appearance:none;touch-action:manipulation;-webkit-tap-highlight-color:transparent;position:relative}',
    '.cc.is-min .cc-fig{box-shadow:0 2px 0 var(--t-edge,#2B2230)}',
    '.cc-fig:active{transform:translateY(2px);box-shadow:0 1px 0 var(--t-edge,#2B2230)}',
    '.cc-fig:focus-visible,.cc-fold:focus-visible{outline:3px solid var(--t-focus,#177A77);outline-offset:2px}',
    '.cc-fig .c-svg{display:block;width:100%;height:100%;pointer-events:none}',
    '.cc-fold{position:absolute;left:-20px;top:-12px;width:26px;height:26px;margin:0;padding:0;border-radius:50%;pointer-events:auto;',
    '  display:grid;place-items:center;cursor:pointer;color:var(--t-ink-2,#675A6B);background:var(--t-paper,#FFFDF8);',
    '  border:2px solid var(--t-line,#EBDCC8);-webkit-appearance:none;appearance:none;touch-action:manipulation;-webkit-tap-highlight-color:transparent}',
    '.cc-fold::after{content:"";position:absolute;inset:-9px}',   /* 44 x 44 hit area around the 26px button */
    '.cc-fold svg{width:12px;height:12px;display:block}',
    '.cc.is-min .cc-fold{display:none}',
    '.cc-bub{max-width:min(210px,calc(100vw - 110px));box-sizing:border-box;padding:8px 13px;border:2px solid var(--t-line,#EBDCC8);',
    '  border-radius:16px 16px 4px 16px;background:var(--t-paper,#FFFDF8);color:var(--t-ink,#2B2230);font:800 14px/1.25 var(--t-font-d,"Avenir Next","Trebuchet MS",system-ui,sans-serif);',
    '  box-shadow:0 3px 0 var(--t-line,#EBDCC8);opacity:0;visibility:hidden;transform:translateY(6px) scale(.96);transform-origin:100% 100%;pointer-events:none;',
    '  transition:opacity .16s ease,transform .2s cubic-bezier(.2,.9,.3,1.2),visibility 0s .16s}',
    '.cc-bub.is-on{opacity:1;visibility:visible;transform:none;transition:opacity .16s ease,transform .2s cubic-bezier(.2,.9,.3,1.2)}',
    '.cc-bub.is-good{background:var(--t-ok-bg,#CDEFE7);color:var(--t-ok-fg,#0E5754);border-color:var(--t-teal,#177A77);box-shadow:0 3px 0 var(--t-teal-d,#0E5754)}',
    '.cc-bub.is-bad{background:var(--t-bad-bg,#FFD9CF);color:var(--t-bad-fg,#A9361F);border-color:var(--t-tomato,#E04A2F);box-shadow:0 3px 0 var(--t-tomato-d,#A9361F)}',
    '.cc.is-min .cc-bub{display:none}',
    '.cc.is-hop .cc-wrap{animation:cc-hop .56s cubic-bezier(.3,.7,.4,1) 1}',
    '.cc.is-talk .cc-wrap{animation:cc-hop .62s ease-in-out infinite}',
    '@keyframes cc-hop{0%,100%{transform:translateY(0)}35%{transform:translateY(-14px)}60%{transform:translateY(0)}78%{transform:translateY(-4px)}}',
    '@media (prefers-reduced-motion:reduce){.cc,.cc *{animation:none!important;transition:none!important}}',
    '@media print{.cc{display:none!important}}'
  ].join('\n');

  var root, fig, fold, bub;
  var leader = '', collapsed = false;
  var reactMood = '', reactTimer = 0, bubTimer = 0, hopTimer = 0, talkTimer = 0, typingTimer = 0;
  var speaking = false, nGood = 0, nBad = 0, lastSay = null;
  /* play a sound and return what is said (Sfx sends the words synchronously, muted or not) */
  function sfxSay(name, ch) { lastSay = null; sfx(name, { char: ch }); var d = lastSay; lastSay = null; return d; }

  function mood() { return reactMood || (speaking ? 'happy' : 'idle'); }
  function applyMood() {
    var g = fig && fig.querySelector('g[data-char]');
    if (g) guard(function () { Cast.setMood(g, mood()); });
  }
  function setReact(m, ms) {
    reactMood = m; applyMood();
    clearTimeout(reactTimer);
    reactTimer = setTimeout(function () { reactMood = ''; applyMood(); }, ms);
  }
  function say(text, kind, ms) {
    clearTimeout(bubTimer);
    if (!text) { bub.classList.remove('is-on'); return; }
    bub.textContent = text;
    bub.classList.remove('is-good', 'is-bad');
    bub.classList.add(kind === 'bad' ? 'is-bad' : 'is-good');
    void bub.offsetWidth;
    bub.classList.add('is-on');
    bubTimer = setTimeout(function () { bub.classList.remove('is-on'); }, ms || 2300);
  }
  function hop() {
    if (reduced()) return;
    root.classList.remove('is-hop'); void root.offsetWidth; root.classList.add('is-hop');
    clearTimeout(hopTimer);
    hopTimer = setTimeout(function () { root.classList.remove('is-hop'); }, 620);
  }

  function who() { return (window.Cast && Cast.NAMES && Cast.NAMES[leader]) || 'Léa'; }
  function labels() {
    var n = who();
    fig.setAttribute('aria-label', (collapsed ? 'Montrer ' : 'Saluer ') + n);
    fig.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    fold.setAttribute('aria-label', 'Réduire ' + n);
    fold.title = 'Réduire ' + n;
  }
  function paint() {
    root.style.setProperty('--cc-bg', BG[leader] || BG.lea);
    root.setAttribute('data-char', leader);
    guard(function () { Cast.mount(fig, { char: leader, mood: mood(), crop: 'face', label: '' }); });
    labels();
  }
  function leaderOf(unit) { return LEADER[unit] || 'lea'; }
  function currentUnit() {
    var u = parseInt(document.body.getAttribute('data-unit'), 10);
    if (u) return u;
    return guard(function () { return parseInt((JSON.parse(localStorage.getItem('dudu-a1-u1') || '{}')).unit, 10) || 1; }) || 1;
  }
  function setLeader(c) { if (c && c !== leader) { leader = c; paint(); } }
  function setCollapsed(v, persist) {
    collapsed = !!v;
    root.classList.toggle('is-min', collapsed);
    if (collapsed) { say(''); root.classList.remove('is-talk'); }
    labels();
    if (persist) sset(collapsed ? '1' : '0');
  }

  /* ---- reactions ---- */
  function untried(detail) {          // « Vérifier » pressed with nothing answered: not a mistake, no reaction
    if (detail.kind !== 'ex') return false;
    return !!guard(function () {
      var ex = document.querySelector('.ex[data-id="' + (window.CSS && CSS.escape ? CSS.escape(detail.id) : detail.id) + '"]');
      if (!ex) return false;
      var typed = [].some.call(ex.querySelectorAll('.inp[data-a]'), function (i) { return i.value.trim(); });
      var picked = [].some.call(ex.querySelectorAll('.opts'), function (g) { return g.querySelector('[data-ok]') && g.querySelector('.opt.sel'); });
      var paired = [].some.call(ex.querySelectorAll('.mitem'), function (x) { return x.dataset.pair; });
      return !(typed || picked || paired);
    });
  }
  function react(d) {
    guard(function () {
      d = d || {};
      var kind = d.kind || 'ex', tot = +d.tot, ok = +d.ok, th = THRESH[kind] || 0.8;
      if (!(tot > 0) || isNaN(ok)) return;
      var spoken = kind === 'spk' || kind === 'speak' || kind === 'conv';
      if (spoken && d.final === false) {                       // a missed turn, not the end of the exercise
        setReact('sad', 1300); sfx('wrong', { char: sfxChar(leader) }); say(''); return;
      }
      if (ok / tot >= th) {
        setReact('happy', 2800);
        var g = sfxSay('correct', sfxChar(leader)), gt = (g && g.text) || GOOD[nGood++ % GOOD.length];
        say(gt, 'good', Math.max(2300, gt.length * 75 + 1300));
      } else {
        if (untried(d)) return;
        setReact('sad', 2800);
        var b = sfxSay('wrong', sfxChar(leader)), t = (b && b.text) || BAD[nBad++ % BAD.length];
        say(t, 'bad', Math.max(t.length > 12 ? 3400 : 2300, t.length * 75 + 1300));
      }
    });
  }

  /* ---- placement above the tab bar ---- */
  var tabObs = null;
  function place() {
    var tb = document.querySelector('.t-tabbar');
    if (!tb) { root.style.removeProperty('--cc-b'); return; }
    var h = tb.getBoundingClientRect().height;
    if (h > 0) root.style.setProperty('--cc-b', Math.round(h) + 'px');
    if (!tabObs && window.ResizeObserver) { tabObs = new ResizeObserver(place); guard(function () { tabObs.observe(tb); }); }
  }

  function isField(t) {
    if (!t || !t.tagName) return false;
    var n = t.tagName.toLowerCase();
    if (n === 'textarea') return true;
    if (n === 'input') return !/^(checkbox|radio|button|submit|range|file|color|image|reset)$/i.test(t.type || 'text');
    return !!t.isContentEditable;
  }

  function build() {
    if (!document.body || !window.Cast) return;
    var st = document.createElement('style'); st.id = 'cc-css'; st.textContent = CSS; document.head.appendChild(st);
    root = document.createElement('div'); root.className = 'cc'; root.setAttribute('data-cc', '');
    root.innerHTML =
      '<div class="cc-bub" role="status" aria-live="polite"></div>' +
      '<div class="cc-wrap"><button type="button" class="cc-fig"></button>' +
      '<button type="button" class="cc-fold"><svg viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>';
    fig = root.querySelector('.cc-fig'); fold = root.querySelector('.cc-fold'); bub = root.querySelector('.cc-bub');
    document.body.appendChild(root);

    leader = leaderOf(currentUnit()); paint();
    setCollapsed(sget() === '1', false);
    place();

    fig.addEventListener('click', function () {
      if (collapsed) setCollapsed(false, true);
      var m = sfxSay('mascot', sfxChar(leader));
      hop(); setReact('happy', 1400);
      if (m && m.text && !collapsed) say(m.text, 'good', Math.max(1800, m.text.length * 75 + 1100));
    });
    fold.addEventListener('click', function () { setCollapsed(true, true); sfx('tap'); });

    document.addEventListener('dudu:checked', function (e) { react(e && e.detail); });

    window.addEventListener('dudu:speak', function (e) {
      lastSay = (e && e.detail) || null;
      guard(function () {
        var c = e && e.detail && e.detail.char; c = c === 'mamie' ? 'jo' : c;
        if (c !== leader) return;
        var ms = Math.max(500, ((e.detail.duration || 1) * 1000) + 150);
        speaking = true; applyMood();
        if (!reduced() && !collapsed) root.classList.add('is-talk');
        clearTimeout(talkTimer);
        talkTimer = setTimeout(function () { speaking = false; root.classList.remove('is-talk'); applyMood(); }, ms);
      });
    });

    /* the unit leader follows the unit the page shows (setUnit() writes body[data-unit]) */
    new MutationObserver(function () { setLeader(leaderOf(currentUnit())); }).observe(document.body, { attributes: true, attributeFilter: ['data-unit'] });

    /* never sit over the field being typed in */
    document.addEventListener('focusin', function (e) {
      if (!isField(e.target)) return;
      clearTimeout(typingTimer); root.classList.add('is-away');
    });
    document.addEventListener('focusout', function () {
      clearTimeout(typingTimer);
      typingTimer = setTimeout(function () { if (!isField(document.activeElement)) root.classList.remove('is-away'); }, 160);
    });

    window.addEventListener('resize', place);
    window.addEventListener('orientationchange', place);
    window.addEventListener('load', place);
    /* nav.js mounts the tab bar after this script: watch for it, then stop */
    if (!document.querySelector('.t-tabbar')) {
      var mo = new MutationObserver(function () { if (document.querySelector('.t-tabbar')) { mo.disconnect(); place(); } });
      mo.observe(document.body, { childList: true });
      setTimeout(function () { mo.disconnect(); place(); }, 6000);
    }

    window.ClassicCast = { el: root, leader: function () { return leader; }, react: react, unit: function (n) { setLeader(leaderOf(n)); } };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { guard(build); });
  else guard(build);
})();
