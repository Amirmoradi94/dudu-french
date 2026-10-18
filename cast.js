/*!
 * cast.js — « La Troupe » : the three characters of DuDu, as inline SVG.
 *
 *   Léa        data-char="lea"     the guide (teal top, afro, red headband)
 *   M. Dubois  data-char="dubois"  the baker (toque, moustache, baguette)
 *   Mamie Jo   data-char="jo"      the grandmother (glasses, pearls, tea cup)
 *
 * Drawn from design/dir-4.html. Self-contained: it injects ONE <style id="cast-css">
 * (all rules scoped under [data-char] / .c-svg, classes prefixed c-), so it can sit
 * next to any page without touching it. troupe.css is NOT needed.
 *
 * API (window.Cast)
 *   Cast.svg(char, {mood='idle', prop='none', id, viewBox, crop, label, cls})
 *        → markup string: <svg viewBox class="c-svg"><g data-char data-mood [data-prop] [id]>…</g></svg>
 *        char  'lea' | 'dubois' | 'jo'   ('mamie' is accepted as an alias of 'jo')
 *        mood  'idle' | 'happy' | 'sad'  (data-mood on the <g>; switch it any time)
 *        prop  Léa only: 'none' | 'dress' (red dress on a hanger) | 'notebook'
 *        crop  'face' → head-and-shoulders viewBox (for round avatars); default = full figure
 *        label aria-label (default: the character's name); label:'' → aria-hidden decoration
 *   Cast.mount(el, {char, mood, prop, …}) → renders into el (replacing its content), returns the <g>
 *   Cast.setMood(gOrEl, mood)            → sets data-mood on the <g> (or on the <g> found inside el)
 *   Cast.scan(root=document)             → fills every EMPTY <g data-char> (dir-4 style) once
 *   Cast.confetti(el, {count=40})        → fills el with falling confetti pieces (self-styled <i>); el must be
 *                                          position:absolute|relative + overflow:hidden (troupe.css .t-confetti
 *                                          is exactly that). No-op under prefers-reduced-motion.
 *   Cast.NAMES                           → {lea:'Léa', dubois:'M. Dubois', jo:'Mamie Jo'}
 *
 * Never throws: an unknown char returns '' (Cast.mount then leaves el untouched and returns null).
 */
(function () {
  'use strict';

  var K = { ink: '#2B2230', tomato: '#E04A2F', tomatoD: '#A9361F', teal: '#177A77', tealD: '#0E5754', mustard: '#F3B534', blush: '#F9CBBE', cream: '#FFF5E8' };
  var NAMES = { lea: 'Léa', dubois: 'M. Dubois', jo: 'Mamie Jo' };
  var ALIAS = { mamie: 'jo' };
  var MOODS = ['idle', 'happy', 'sad'];
  var VIEW_FULL = '-60 -20 360 330';
  var VIEW_FACE = '40 -6 160 160';

  /* ------------------------------------------------------------------ *
   * Animation CSS (injected once). Same keyframes as dir-4, scoped.
   * ------------------------------------------------------------------ */
  var CSS = [
    '.c-svg{display:block;width:100%;height:100%;overflow:visible}',
    /* only the layer that matches the current mood is shown (c-in-i / c-in-h / c-in-s) */
    '[data-char][data-mood="idle"] [class*="c-in-"]:not(.c-in-i),',
    '[data-char][data-mood="happy"] [class*="c-in-"]:not(.c-in-h),',
    '[data-char][data-mood="sad"] [class*="c-in-"]:not(.c-in-s){display:none}',
    '[data-char] .c-bob{transform-box:view-box;transform-origin:120px 300px;animation:c-breathe 3.6s ease-in-out var(--d,0s) infinite}',
    '[data-char][data-mood="happy"] .c-bob{animation:c-hop .72s ease-in-out var(--d,0s) infinite}',
    '[data-char][data-mood="sad"] .c-bob{animation:c-oops .5s ease-out 1,c-droop 3s ease-in-out .5s infinite}',
    '[data-char] .c-head{transform-box:view-box;transform-origin:120px 176px;animation:c-tilt 5.5s ease-in-out var(--d,0s) infinite}',
    '[data-char][data-mood="happy"] .c-head{animation:none}',
    '[data-char] .c-blink{transform-box:fill-box;transform-origin:center;animation:c-blink 4.4s ease-in-out var(--d,0s) infinite}',
    '[data-char] .c-sw{transform-box:view-box;transform-origin:0 0;animation:c-swing 3s ease-in-out var(--d,0s) infinite}',
    '[data-char][data-mood="happy"] .c-sw{animation-duration:.72s}',
    '[data-char] .c-wave{transform-box:view-box;transform-origin:174px 205px;animation:c-wave 1.8s ease-in-out var(--d,0s) infinite}',
    '[data-char] .c-spark{transform-box:fill-box;transform-origin:center;animation:c-spark 1.1s ease-in-out infinite}',
    '[data-char] .c-spark:nth-of-type(2n){animation-delay:.35s}',
    '[data-char] .c-spark:nth-of-type(3n){animation-delay:.7s}',
    '[data-char] .c-sweat{animation:c-drip 1.4s ease-in infinite}',
    '[data-char] .c-steam{animation:c-steam 2.4s ease-in-out infinite;transform-box:fill-box;transform-origin:center bottom}',
    '[data-char][role="button"]{cursor:pointer}',
    '@keyframes c-breathe{0%,100%{transform:scale(1,1)}50%{transform:scale(1.012,1.022)}}',
    '@keyframes c-hop{0%,100%{transform:translateY(0) scale(1.03,.97)}45%{transform:translateY(-16px) scale(.98,1.03)}}',
    '@keyframes c-oops{0%{transform:translateY(0)}20%{transform:translateX(-7px) rotate(-1.5deg)}40%{transform:translateX(6px) rotate(1.2deg)}60%{transform:translateX(-4px)}80%{transform:translateX(2px)}100%{transform:none}}',
    '@keyframes c-droop{0%,100%{transform:translateY(2px) scale(1,.99)}50%{transform:translateY(6px) scale(1,.975)}}',
    '@keyframes c-tilt{0%,100%{transform:rotate(-1.8deg)}50%{transform:rotate(1.8deg)}}',
    '@keyframes c-blink{0%,91%,100%{transform:scaleY(1)}94.5%{transform:scaleY(.08)}}',
    '@keyframes c-swing{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg)}}',
    '@keyframes c-wave{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(12deg)}}',
    '@keyframes c-spark{0%,100%{transform:scale(.2) rotate(0);opacity:.2}50%{transform:scale(1) rotate(45deg);opacity:1}}',
    '@keyframes c-drip{0%{transform:translateY(-3px);opacity:1}80%{opacity:.9}100%{transform:translateY(12px);opacity:0}}',
    '@keyframes c-steam{0%,100%{transform:translateY(0) scaleY(.8);opacity:.2}50%{transform:translateY(-5px) scaleY(1.1);opacity:.85}}',
    '@keyframes c-fall{0%{transform:translate3d(0,-30px,0) rotate(0)}100%{transform:translate3d(var(--dx,0),800px,0) rotate(var(--rot,540deg))}}',
    '@media (prefers-reduced-motion:reduce){[data-char],[data-char] *{animation:none!important;transition:none!important}}'
  ].join('\n');

  function injectCss() {
    try {
      if (!document || !document.head || document.getElementById('cast-css')) return;
      var s = document.createElement('style');
      s.id = 'cast-css';
      s.textContent = CSS;
      document.head.appendChild(s);
    } catch (e) { /* ignore */ }
  }

  /* ------------------------------------------------------------------ *
   * Drawings (lifted from dir-4.html; classes prefixed c-)
   * ------------------------------------------------------------------ */
  var star = function (x, y, r, f) {
    return '<path class="c-in-h c-spark" d="M' + x + ' ' + (y - r) + 'Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y + 'Q' + x + ' ' + y + ' ' + x + ' ' + (y + r) +
      'Q' + x + ' ' + y + ' ' + (x - r) + ' ' + y + 'Q' + x + ' ' + y + ' ' + x + ' ' + (y - r) + 'Z" fill="' + f + '"/>';
  };
  var sleeve = function (d, c, w) { return '<path d="' + d + '" fill="none" stroke="' + c + '" stroke-width="' + (w || 28) + '" stroke-linecap="round"/>'; };
  var hand = function (x, y, c, r) { return '<circle cx="' + x + '" cy="' + y + '" r="' + (r || 13) + '" fill="' + c + '"/>'; };

  function face(o) {
    o = o || {};
    var ey = 112, my = o.my || 0, br = o.brow || K.ink, bw = o.bw || 5.5, mc = '#4A1B2A', lip = o.lip || K.ink, tg = '#F0867A';
    var pup = function (x, y, r) {
      return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + K.ink + '"/><circle cx="' + (x + 2.4) + '" cy="' + (y - 2.8) + '" r="' + (r * 0.34).toFixed(1) + '" fill="#fff"/>';
    };
    var mouth = o.mouth ||
      '<path class="c-in-i" d="M106 ' + (141 + my) + 'Q120 ' + (153 + my) + ' 134 ' + (141 + my) + '" fill="none" stroke="' + lip + '" stroke-width="5" stroke-linecap="round"/>' +
      '<path class="c-in-h" d="M100 ' + (136 + my) + 'Q120 ' + (170 + my) + ' 140 ' + (136 + my) + 'Z" fill="' + mc + '"/>' +
      '<path class="c-in-h" d="M109 ' + (148 + my) + 'Q120 ' + (141 + my) + ' 131 ' + (148 + my) + 'Q120 ' + (153 + my) + ' 109 ' + (148 + my) + 'Z" fill="' + tg + '"/>' +
      '<ellipse class="c-in-s" cx="120" cy="' + (148 + my) + '" rx="7" ry="9" fill="' + mc + '"/>';
    return '<g fill="#F0867A" opacity=".5"><circle cx="82" cy="' + (ey + 22) + '" r="10"/><circle cx="158" cy="' + (ey + 22) + '" r="10"/></g>' +
      '<g class="c-in-i c-blink"><ellipse cx="100" cy="' + ey + '" rx="11" ry="13" fill="#fff"/><ellipse cx="140" cy="' + ey + '" rx="11" ry="13" fill="#fff"/>' + pup(102, ey + 2, 6.5) + pup(142, ey + 2, 6.5) + '</g>' +
      '<g class="c-in-s"><ellipse cx="100" cy="' + ey + '" rx="12.5" ry="15.5" fill="#fff"/><ellipse cx="140" cy="' + ey + '" rx="12.5" ry="15.5" fill="#fff"/>' + pup(100, ey + 1, 4) + pup(140, ey + 1, 4) + '</g>' +
      '<g class="c-in-h" fill="none" stroke="' + K.ink + '" stroke-width="5.5" stroke-linecap="round"><path d="M88 ' + (ey + 3) + 'Q100 ' + (ey - 13) + ' 112 ' + (ey + 3) + '"/><path d="M128 ' + (ey + 3) + 'Q140 ' + (ey - 13) + ' 152 ' + (ey + 3) + '"/></g>' +
      '<g fill="none" stroke="' + br + '" stroke-width="' + bw + '" stroke-linecap="round">' +
        '<g class="c-in-i"><path d="M88 ' + (ey - 24) + 'Q100 ' + (ey - 30) + ' 112 ' + (ey - 25) + '"/><path d="M128 ' + (ey - 25) + 'Q140 ' + (ey - 30) + ' 152 ' + (ey - 24) + '"/></g>' +
        '<g class="c-in-h"><path d="M88 ' + (ey - 28) + 'Q100 ' + (ey - 37) + ' 112 ' + (ey - 29) + '"/><path d="M128 ' + (ey - 29) + 'Q140 ' + (ey - 37) + ' 152 ' + (ey - 28) + '"/></g>' +
        '<g class="c-in-s"><path d="M87 ' + (ey - 22) + 'L111 ' + (ey - 33) + '"/><path d="M129 ' + (ey - 33) + 'L153 ' + (ey - 22) + '"/></g>' +
      '</g>' +
      mouth +
      '<path class="c-in-s c-sweat" d="M171 74Q180 90 171 99Q162 90 171 74Z" fill="#8FD6D0"/>';
  }

  /* the red dress on a hanger, origin = where the hand grips */
  var DRESS = '<g class="c-sw">' +
    '<path d="M0 8V-3Q0 -11 7 -11Q13 -11 13 -17Q13 -23 7 -23" fill="none" stroke="#B97E0A" stroke-width="3.2" stroke-linecap="round"/>' +
    '<path d="M-30 27L0 7L30 27" fill="none" stroke="#B97E0A" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>' +
    '<path d="M-17 22L-9 22Q0 35 9 22L17 22L21 52L48 108Q0 119 -48 108L-21 52Z" fill="#D8312B"/>' +
    '<path d="M-21 52L21 52L22.500 60L-22.500 60Z" fill="#8F1D1D"/>' +
    '<path d="M-9 62L-20 106M9 62L20 106M0 62V112" stroke="#EE5B50" stroke-width="3" stroke-linecap="round" opacity=".7" fill="none"/>' +
    '<g fill="#FFE9D6" opacity=".9"><circle cx="-27" cy="92" r="3"/><circle cx="-11" cy="99" r="3"/><circle cx="9" cy="88" r="3"/><circle cx="27" cy="98" r="3"/><circle cx="-1" cy="76" r="3"/><circle cx="-20" cy="72" r="3"/><circle cx="19" cy="70" r="3"/></g>' +
    '</g>';
  var dressAt = function (x, y, rot) { return '<g transform="translate(' + x + ' ' + y + ')' + (rot ? ' rotate(' + rot + ')' : '') + '">' + DRESS + '</g>'; };

  /* a little exercise book, held by the hand at (x,y); drawn before the hand so the fingers wrap it */
  var notebook = function (x, y, rot) {
    return '<g transform="translate(' + x + ' ' + (y - 22) + ') rotate(' + (rot || 0) + ')">' +
      '<rect x="-22" y="-30" width="44" height="58" rx="6" fill="' + K.tomato + '" stroke="' + K.ink + '" stroke-width="3"/>' +
      '<rect x="-22" y="-30" width="9" height="58" rx="4" fill="' + K.tomatoD + '"/>' +
      '<rect x="-6" y="-20" width="22" height="16" rx="3" fill="#FFFDF8"/>' +
      '<path d="M-2 -14h14M-2 -9h9" stroke="' + K.ink + '" stroke-width="2" stroke-linecap="round" opacity=".55"/>' +
      '<path d="M-17 -22v4M-17 -10v4M-17 2v4M-17 14v4" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".6"/>' +
      '</g>';
  };

  /* ---- LÉA ---- */
  function lea(prop) {
    var sk = '#A8654A', skD = '#8A4E36', hr = '#2A1B2E', sl = '#136B68', top = K.teal, d = prop === 'dress', n = prop === 'notebook';
    var afro = '<g fill="' + hr + '"><circle cx="120" cy="70" r="58"/><circle cx="68" cy="52" r="26"/><circle cx="172" cy="52" r="26"/><circle cx="94" cy="22" r="27"/><circle cx="146" cy="22" r="27"/><circle cx="120" cy="14" r="26"/><circle cx="54" cy="92" r="21"/><circle cx="186" cy="92" r="21"/></g>';
    var body = '<rect x="105" y="150" width="30" height="40" rx="12" fill="' + skD + '"/>' +
      '<path d="M52 300C50 222 72 180 120 176C168 180 190 222 188 300Z" fill="' + top + '"/>' +
      '<path d="M70 262q-4-30 6-50" stroke="#fff" stroke-width="5" opacity=".1" fill="none" stroke-linecap="round"/>' +
      '<path d="M82 178Q120 208 158 178L162 192Q120 222 78 192Z" fill="' + K.mustard + '"/>' +
      '<path d="M124 198L146 252L128 255L114 206Z" fill="' + K.mustard + '"/><path d="M130 232l14 20-16 3z" fill="#D99A1C"/>';
    var idleR, happyR, sadR;
    if (d) {
      idleR = sleeve('M174 205Q226 214 224 164', sl) + dressAt(224, 152) + hand(224, 152, sk);
      happyR = sleeve('M174 205Q234 196 224 126', sl) + dressAt(224, 116) + hand(224, 116, sk, 14);
      sadR = sleeve('M172 208Q208 228 212 196', sl) + dressAt(212, 192, -12) + hand(212, 192, sk);
    } else if (n) {
      idleR = '<g class="c-wave">' + sleeve('M174 205Q216 214 208 164', sl) + notebook(208, 152, 8) + hand(208, 152, sk, 14) + '</g>';
      happyR = sleeve('M174 205Q212 190 206 134', sl) + notebook(206, 124, 14) + hand(206, 124, sk, 14);
      sadR = sleeve('M174 205Q200 240 186 276', sl) + notebook(186, 282, -6) + hand(186, 282, sk);
    } else {
      idleR = '<g class="c-wave">' + sleeve('M174 205Q216 214 208 164', sl) + hand(208, 152, sk, 14) + '</g>';
      happyR = sleeve('M174 205Q212 190 206 134', sl) + hand(206, 124, sk, 14);
      sadR = sleeve('M174 205Q200 240 186 276', sl) + hand(186, 282, sk);
    }
    var arms =
      '<g class="c-in-i">' + sleeve('M66 205Q40 240 58 276', sl) + hand(58, 282, sk) + idleR + '</g>' +
      '<g class="c-in-h">' + sleeve('M66 205Q28 190 34 134', sl) + hand(34, 124, sk, 14) + happyR + '</g>' +
      '<g class="c-in-s">' + sleeve('M66 208Q28 196 76 158', sl) + hand(82, 152, sk) + sadR + '</g>';
    var head = '<g class="c-head">' +
      '<circle cx="68" cy="118" r="10" fill="' + sk + '"/><circle cx="172" cy="118" r="10" fill="' + sk + '"/>' +
      '<circle cx="68" cy="131" r="7" fill="none" stroke="' + K.mustard + '" stroke-width="3"/><circle cx="172" cy="131" r="7" fill="none" stroke="' + K.mustard + '" stroke-width="3"/>' +
      '<ellipse cx="120" cy="110" rx="51" ry="55" fill="' + sk + '"/>' +
      '<path d="M70 100C70 66 96 55 120 55C144 55 170 66 170 100C160 84 144 78 120 78C96 78 80 84 70 100Z" fill="' + hr + '"/>' +
      '<path d="M70 90C78 60 162 60 170 90" fill="none" stroke="' + K.tomato + '" stroke-width="10" stroke-linecap="round"/>' +
      '<path d="M116 127Q120 132 124 127" fill="none" stroke="' + skD + '" stroke-width="3" stroke-linecap="round"/>' +
      face({ brow: hr }) +
      '</g>';
    var sparks = star(24, 50, 11, K.mustard) + star(222, 38, 9, K.tomato) + star(14, 160, 8, '#fff') + star(236, 150, 10, K.mustard) + star(120, -8, 9, '#fff');
    return '<g class="c-bob">' + afro + body + arms + head + sparks + '</g>';
  }

  /* ---- M. DUBOIS ---- */
  function dubois() {
    var sk = '#F0C4A0', skD = '#D79F78', sl = '#F1E8DA';
    var baguette = function (x, y, rot) {
      return '<g transform="translate(' + x + ' ' + y + ') rotate(' + rot + ')"><rect x="-10" y="-126" width="20" height="156" rx="10" fill="#D9953F"/>' +
        '<path d="M-5 -108l10 9M-5 -80l10 9M-5 -52l10 9M-5 -24l10 9" stroke="#A8691C" stroke-width="3.2" stroke-linecap="round"/>' +
        '<rect x="-10" y="-126" width="6" height="156" rx="3" fill="#fff" opacity=".18"/></g>';
    };
    var body = '<rect x="104" y="152" width="32" height="40" rx="12" fill="' + skD + '"/>' +
      '<path d="M44 300C42 224 66 182 120 178C174 182 198 224 196 300Z" fill="#FFFDF8"/>' +
      '<path d="M44 300C44 262 50 236 62 214" stroke="#EADFCD" stroke-width="10" fill="none" opacity=".7"/>' +
      '<path d="M90 192L98 240L88 300H152L142 240L150 192" fill="none" stroke="' + K.tomato + '" stroke-width="9" stroke-linejoin="round"/>' +
      '<path d="M90 240H150L156 300H84Z" fill="' + K.tomato + '"/>' +
      '<path d="M100 178L140 178L120 206Z" fill="' + K.teal + '"/><circle cx="120" cy="190" r="5" fill="' + K.tealD + '"/>' +
      '<circle cx="108" cy="266" r="4" fill="#fff" opacity=".6"/><circle cx="134" cy="258" r="3" fill="#fff" opacity=".6"/>';
    var arms =
      '<g class="c-in-i">' + baguette(204, 300, 10) +
        sleeve('M62 208Q34 246 54 280', sl, 30) + hand(54, 286, sk) +
        sleeve('M178 208Q210 246 194 272', sl, 30) + hand(194, 274, sk) + '</g>' +
      '<g class="c-in-h">' +
        sleeve('M62 208Q22 196 30 128', sl, 30) + baguette(30, 126, -3) + hand(30, 118, sk, 14) +
        sleeve('M178 208Q222 192 212 128', sl, 30) + hand(212, 118, sk, 14) + '</g>' +
      '<g class="c-in-s">' +
        sleeve('M62 208Q28 196 76 160', sl, 30) + hand(82, 154, sk) +
        sleeve('M178 208Q212 196 164 160', sl, 30) + hand(158, 154, sk) + '</g>';
    var toque = '<g><path d="M70 66Q64 60 72 52H168Q176 60 170 66Z" fill="#fff"/><rect x="72" y="58" width="96" height="10" rx="4" fill="#EBDDC8"/>' +
      '<circle cx="86" cy="36" r="24" fill="#FFFDF8"/><circle cx="154" cy="36" r="24" fill="#FFFDF8"/><circle cx="120" cy="24" r="29" fill="#fff"/><circle cx="103" cy="40" r="22" fill="#fff"/><circle cx="137" cy="40" r="22" fill="#FFFDF8"/>' +
      '<path d="M72 52H168V60H72Z" fill="#fff"/><path d="M72 60H168V67H72Z" fill="#E9DCC6"/></g>';
    var mouth = '<path class="c-in-i" d="M108 156Q120 164 132 156" fill="none" stroke="' + K.ink + '" stroke-width="4.5" stroke-linecap="round"/>' +
      '<path class="c-in-h" d="M107 152Q120 174 133 152Z" fill="#4A1B2A"/><path class="c-in-h" d="M112 160Q120 155 128 160Q120 166 112 160Z" fill="#F0867A"/>' +
      '<ellipse class="c-in-s" cx="120" cy="158" rx="6" ry="7.500" fill="#4A1B2A"/>';
    var head = '<g class="c-head">' +
      '<circle cx="65" cy="114" r="10" fill="' + sk + '"/><circle cx="175" cy="114" r="10" fill="' + sk + '"/>' +
      '<ellipse cx="68" cy="94" rx="10" ry="16" fill="#CFC8D2"/><ellipse cx="172" cy="94" rx="10" ry="16" fill="#CFC8D2"/>' +
      '<ellipse cx="120" cy="112" rx="56" ry="56" fill="' + sk + '"/>' +
      toque +
      '<circle cx="150" cy="146" r="6" fill="#fff" opacity=".7"/><circle cx="158" cy="141" r="3" fill="#fff" opacity=".7"/>' +
      face({ brow: '#8C6A58', bw: 8.5, mouth: mouth }) +
      '<ellipse cx="120" cy="128" rx="11.500" ry="9" fill="#E3A57F"/>' +
      '<path d="M120 139C108 131 92 133 86 143C83 149 89 152 94 148C100 142 110 144 120 146C130 144 140 142 146 148C151 152 157 149 154 143C148 133 132 131 120 139Z" fill="#6B4430"/>' +
      '</g>';
    var sparks = star(20, 52, 10, K.mustard) + star(226, 50, 9, K.tomato) + star(236, 170, 9, '#fff');
    return '<g class="c-bob">' + body + arms + head + sparks + '</g>';
  }

  /* ---- MAMIE JO ---- */
  function jo() {
    var sk = '#E3B58B', skD = '#C99568', sl = '#EE8F81', ca = '#F4A79B';
    var cup = function (x, y) {
      return '<g transform="translate(' + x + ' ' + y + ')"><ellipse cx="0" cy="22" rx="27" ry="5" fill="#fff"/><path d="M-16 0H16V10A16 14 0 0 1 -16 10Z" fill="#fff"/>' +
        '<path d="M16 3H20A6 6 0 0 1 20 15H15" fill="none" stroke="#fff" stroke-width="3.500"/><ellipse cx="0" cy="1" rx="16" ry="3" fill="#7A4A2A"/>' +
        '<g fill="none" stroke="#fff" stroke-width="2.600" stroke-linecap="round"><path class="c-steam" d="M-6 -6c-4-5 4-7 0-13"/><path class="c-steam" style="animation-delay:.6s" d="M5 -6c-4-5 4-7 0-13"/></g></g>';
    };
    var pearls = '';
    for (var i = 0; i < 9; i++) { var t = i / 8; pearls += '<circle cx="' + (96 + 48 * t).toFixed(1) + '" cy="' + (184 + 24 * Math.sin(Math.PI * t)).toFixed(1) + '" r="3.600" fill="#fff"/>'; }
    var body = '<rect x="105" y="152" width="30" height="40" rx="12" fill="' + skD + '"/>' +
      '<path d="M48 300C46 224 70 182 120 178C170 182 194 224 192 300Z" fill="' + ca + '"/>' +
      '<path d="M96 180L120 238L144 180Z" fill="#FFFDF8"/>' +
      '<path d="M96 180L112 240L120 300H108C100 262 90 220 96 180ZM144 180L128 240L120 300H132C140 262 150 220 144 180Z" fill="#E8887B"/>' +
      '<circle cx="120" cy="250" r="4" fill="' + K.mustard + '"/><circle cx="120" cy="276" r="4" fill="' + K.mustard + '"/>' +
      pearls;
    var arms =
      '<g class="c-in-i">' + sleeve('M62 208Q38 252 100 268', sl, 30) + sleeve('M178 208Q202 252 140 268', sl, 30) +
        cup(120, 252) + hand(102, 268, sk) + hand(138, 268, sk) + '</g>' +
      '<g class="c-in-h">' + sleeve('M62 208Q24 196 32 132', sl, 30) + hand(32, 120, sk, 14) +
        sleeve('M178 208Q222 198 208 140', sl, 30) + cup(206, 106) + hand(206, 128, sk, 14) + '</g>' +
      '<g class="c-in-s">' + sleeve('M62 208Q28 196 76 160', sl, 30) + hand(82, 154, sk) +
        sleeve('M178 208Q212 196 164 160', sl, 30) + hand(158, 154, sk) + '</g>';
    var head = '<g class="c-head">' +
      '<circle cx="70" cy="118" r="10" fill="' + sk + '"/><circle cx="170" cy="118" r="10" fill="' + sk + '"/><circle cx="70" cy="131" r="4.500" fill="#fff"/><circle cx="170" cy="131" r="4.500" fill="#fff"/>' +
      '<circle cx="120" cy="38" r="25" fill="#D9D3DE"/><circle cx="108" cy="30" r="9" fill="#E9E4EE"/>' +
      '<ellipse cx="120" cy="110" rx="51" ry="54" fill="' + sk + '"/>' +
      '<path d="M68 104C64 58 92 46 120 46C148 46 176 58 172 104C166 80 146 66 120 66C94 66 74 80 68 104Z" fill="#D9D3DE"/>' +
      '<g fill="#D9D3DE"><circle cx="76" cy="90" r="9"/><circle cx="164" cy="90" r="9"/><circle cx="90" cy="76" r="9"/><circle cx="150" cy="76" r="9"/></g>' +
      '<path d="M78 140q-6 8 1 15M162 140q6 8-1 15" fill="none" stroke="#B88660" stroke-width="2.800" stroke-linecap="round"/>' +
      '<path d="M116 127Q120 132 124 127" fill="none" stroke="' + skD + '" stroke-width="3" stroke-linecap="round"/>' +
      face({ brow: '#9C95A3', lip: '#B03A48' }) +
      '<g fill="rgba(255,255,255,.3)" stroke="#8B2F45" stroke-width="4"><circle cx="100" cy="114" r="20"/><circle cx="140" cy="114" r="20"/></g>' +
      '<path d="M118 112Q120 108 122 112M80 110L70 106M160 110L170 106" fill="none" stroke="#8B2F45" stroke-width="3.500" stroke-linecap="round"/>' +
      '</g>';
    var sparks = star(18, 54, 10, K.mustard) + star(230, 54, 9, K.teal) + star(14, 170, 8, '#fff');
    return '<g class="c-bob">' + body + arms + head + sparks + '</g>';
  }

  var BUILD = { lea: function (p) { return lea(p); }, dubois: dubois, jo: jo };

  /* ------------------------------------------------------------------ *
   * API
   * ------------------------------------------------------------------ */
  function normChar(c) {
    c = String(c == null ? '' : c).toLowerCase();
    c = ALIAS[c] || c;
    return BUILD[c] ? c : '';
  }
  function normMood(m) { return MOODS.indexOf(m) >= 0 ? m : 'idle'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function delay() { return '--d:' + (-Math.random() * 3.5).toFixed(2) + 's'; }

  function inner(c, prop) { return BUILD[c](c === 'lea' ? prop : undefined); }

  function svg(char, o) {
    try {
      o = o || {};
      var c = normChar(char);
      if (!c) return '';
      injectCss();
      var mood = normMood(o.mood), prop = o.prop && o.prop !== 'none' ? String(o.prop) : 'none';
      var vb = o.viewBox || (o.crop === 'face' ? VIEW_FACE : VIEW_FULL);
      var label = o.label === undefined ? NAMES[c] : o.label;
      var a11y = label ? ' role="img" aria-label="' + esc(label) + '"' : ' aria-hidden="true" focusable="false"';
      return '<svg class="c-svg' + (o.cls ? ' ' + esc(o.cls) : '') + '" viewBox="' + esc(vb) + '" xmlns="http://www.w3.org/2000/svg"' + a11y + '>' +
        '<g data-char="' + c + '" data-mood="' + mood + '" data-prop="' + esc(prop) + '" data-built="1"' + (o.id ? ' id="' + esc(o.id) + '"' : '') + ' style="' + delay() + '">' +
        inner(c, prop) + '</g></svg>';
    } catch (e) { return ''; }
  }

  function mount(el, o) {
    try {
      o = o || {};
      if (!el) return null;
      var c = o.char != null ? o.char : o.name;
      var html = svg(c, o);
      if (!html) return null;
      el.innerHTML = html;
      return el.querySelector('g[data-char]');
    } catch (e) { return null; }
  }

  function findG(x) {
    if (!x) return null;
    if (x.getAttribute && x.getAttribute('data-char') !== null && x.tagName && x.tagName.toLowerCase() === 'g') return x;
    return x.querySelector ? x.querySelector('g[data-char]') : null;
  }
  function setMood(x, mood) {
    try {
      var g = findG(x);
      if (!g) return null;
      g.setAttribute('data-mood', normMood(mood));
      return g;
    } catch (e) { return null; }
  }

  /* dir-4 style: <svg viewBox="…"><g data-char="lea" data-prop="dress" data-mood="happy"></g></svg> */
  function scan(root) {
    try {
      injectCss();
      (root || document).querySelectorAll('g[data-char]').forEach(function (g) {
        if (g.getAttribute('data-built')) return;
        var c = normChar(g.getAttribute('data-char'));
        if (!c) return;
        g.setAttribute('data-char', c);
        if (!g.getAttribute('data-mood')) g.setAttribute('data-mood', 'idle');
        g.innerHTML = inner(c, g.getAttribute('data-prop'));
        g.setAttribute('data-built', '1');
        if (!g.style.getPropertyValue('--d')) g.style.setProperty('--d', (-Math.random() * 3.5).toFixed(2) + 's');
      });
    } catch (e) { /* ignore */ }
  }

  function reduced() {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  }
  function confetti(el, o) {
    try {
      if (!el) return;
      injectCss();
      el.innerHTML = '';
      if (reduced()) return;
      var n = (o && o.count) || 40, cols = (o && o.colors) || [K.tomato, K.teal, K.mustard, K.blush, '#fff', '#8FD6D0'];
      var frag = document.createDocumentFragment();
      for (var i = 0; i < n; i++) {
        var e = document.createElement('i'), w = 6 + Math.random() * 7;
        e.style.cssText = 'position:absolute;top:-24px;left:var(--x);width:var(--w);height:var(--h);background:var(--c);border-radius:var(--br);opacity:.95;animation:c-fall var(--t) linear var(--d) infinite;--x:' + (Math.random() * 100).toFixed(1) + '%;--c:' + cols[i % cols.length] + ';--w:' + w.toFixed(1) + 'px;--h:' + (w * 1.6).toFixed(1) + 'px;--t:' +
          (3.2 + Math.random() * 2.8).toFixed(2) + 's;--d:' + (-Math.random() * 5).toFixed(2) + 's;--dx:' + (Math.random() * 120 - 60).toFixed(0) + 'px;--rot:' +
          (360 + Math.random() * 540).toFixed(0) + 'deg;--br:' + (Math.random() > 0.6 ? '50%' : '2px');
        frag.appendChild(e);
      }
      el.appendChild(frag);
    } catch (e) { /* ignore */ }
  }

  window.Cast = { svg: svg, mount: mount, setMood: setMood, scan: scan, confetti: confetti, NAMES: NAMES };
  if (typeof document !== 'undefined') {
    if (document.head) injectCss();
    else document.addEventListener('DOMContentLoaded', injectCss);
  }
})();
