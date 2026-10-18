/*!
 * troupe-widgets.js — decoration for the special tools of Unite1_Revision.html (pairs with troupe-widgets.css)
 *
 *   1. Léa's face on the tutor's side of every chat: the tutor conversation and mini-dialogues (.spk-bubble.tutor) and the
 *      tutor side panel (#tutorBody .msg.bot, plus a bigger one in the panel header).
 *   2. Mustard SVG stars: the page writes stars as emoji text ('⭐⭐☆'); this only adds data-n="2" to the .spk-stars element
 *      so the CSS can draw them. The text itself is never touched (layout and screen readers keep it).
 *
 * Presentation only. It never reads or changes what the page's own code depends on: it only appends one decorative,
 * aria-hidden <span class="tw-ava"> (absolutely positioned — it does not take part in the text flow) to a bubble that the page
 * has already filled, and sets one data attribute. Safe to load in any order, at any time, twice: it waits for Cast (cast.js)
 * if it is not there yet and shows an « L » until then. Without it, troupe-widgets.css still works (emoji stars, no avatar).
 *
 * Loaded in the classic page (body.troupe-skin) and in lesson mode (html.lp-on).
 */
(function () {
  'use strict';
  if (window.__troupeWidgets) return;
  window.__troupeWidgets = true;

  var BUBBLES = '.spk-bubble.tutor, #tutorBody .msg.bot';
  var STARS = '.spk-stars';

  function faceMarkup() {
    try {
      if (window.Cast && typeof window.Cast.svg === 'function') {
        var s = window.Cast.svg('lea', { crop: 'face', label: '' });
        if (s) return s;
      }
    } catch (e) {}
    return '';
  }

  function paintAva(span) {
    var m = faceMarkup();
    if (m) { span.innerHTML = m; span.removeAttribute('data-fallback'); return true; }
    span.innerHTML = '<b>L</b>'; span.setAttribute('data-fallback', '1');
    return false;
  }

  /* ---- 1. avatars ---- */
  function decorateBubble(b) {
    if (!b || b.nodeType !== 1 || b.__tw) return;
    if (b.matches('.err, .dots')) return;
    b.__tw = true;
    for (var i = 0; i < b.children.length; i++) if (b.children[i].classList.contains('tw-ava')) return;
    var s = document.createElement('span');
    s.className = 'tw-ava';
    s.setAttribute('aria-hidden', 'true');
    paintAva(s);
    b.appendChild(s);
    if (s.hasAttribute('data-fallback')) waitForCast();
  }

  function decorateHead() {
    var h = document.querySelector('aside.tutor .tutor-head');
    if (!h || h.__tw) return;
    h.__tw = true;
    var s = document.createElement('span');
    s.className = 'tw-ava tw-ava--head tw-ava--live';
    s.setAttribute('aria-hidden', 'true');
    paintAva(s);
    h.insertBefore(s, h.firstChild);
    if (s.hasAttribute('data-fallback')) waitForCast();
  }

  /* ---- 2. stars ---- */
  function starCount(t) { var m = String(t || '').match(/⭐/g); return m ? m.length : 0; }
  function decorateStars(el) {
    if (!el || el.nodeType !== 1) return;
    var n = Math.min(3, starCount(el.textContent));
    if (el.getAttribute('data-n') !== String(n)) el.setAttribute('data-n', String(n));
  }

  /* ---- scan helpers ---- */
  function scan(root) {
    if (!root || root.nodeType !== 1) return;
    try {
      if (root.matches(BUBBLES)) decorateBubble(root);
      if (root.matches(STARS)) decorateStars(root);
      var bs = root.querySelectorAll(BUBBLES); for (var i = 0; i < bs.length; i++) decorateBubble(bs[i]);
      var ss = root.querySelectorAll(STARS); for (var j = 0; j < ss.length; j++) decorateStars(ss[j]);
    } catch (e) {}
  }

  /* Cast may arrive after us (lesson mode loads it itself): upgrade the « L » placeholders when it does */
  var castTimer = null;
  function waitForCast() {
    if (castTimer) return;
    var tries = 0;
    castTimer = setInterval(function () {
      tries++;
      if (faceMarkup()) {
        clearInterval(castTimer); castTimer = null;
        var ph = document.querySelectorAll('.tw-ava[data-fallback]');
        for (var i = 0; i < ph.length; i++) paintAva(ph[i]);
      } else if (tries > 60) { clearInterval(castTimer); castTimer = null; }
    }, 400);
  }

  function onMutations(list) {
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (m.type === 'characterData') {
        var p = m.target.parentElement, st = p && p.closest && p.closest(STARS);
        if (st) decorateStars(st);
        continue;
      }
      var t = m.target;
      if (t && t.nodeType === 1 && t.closest && t.closest(STARS)) decorateStars(t.closest(STARS));
      for (var k = 0; k < m.addedNodes.length; k++) scan(m.addedNodes[k]);
    }
    if (!document.querySelector('aside.tutor .tutor-head .tw-ava')) decorateHead();
  }

  function start() {
    scan(document.body);
    decorateHead();
    try {
      new MutationObserver(onMutations).observe(document.body, { childList: true, subtree: true, characterData: true });
    } catch (e) {}
  }

  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);
})();
