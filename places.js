/* places.js — one illustrated Paris place per unit, in the « La Troupe » style.
 *
 *   Places.svg(unit, {variant:'banner'|'stop', dark:false, fit:'slice'|'meet', title})  -> SVG markup string
 *   Places.name(unit)                                                                   -> French place name
 *   Places.info(unit)                                                                   -> {unit, name, topic, tag}
 *
 * unit 1 « Le café des langues »          (présentations, nationalités)
 * unit 2 « L'immeuble de Mamie Jo »       (maison, famille, métiers)
 * unit 3 « La boulangerie de M. Dubois »  (magasins, repas)
 * unit 4 « La station de métro »          (ville, transports, directions)
 * unit 5 « La friperie »                  (vêtements, météo, avis)
 * (the topic shown with each place is the unit's title in content/meta.js)
 *
 * variant 'banner' : viewBox 360x200, a full scene to use as a unit header. No width/height attributes:
 *                    it fills its container's width and keeps the 9:5 ratio. If you force a fixed height
 *                    on a wide container, preserveAspectRatio is "xMidYMid slice" (sides/top are cropped,
 *                    never stretched) — the story of each scene lives in x 20..340, y 24..186.
 *                    Pass {fit:'meet'} to never crop.
 * variant 'stop'   : viewBox 96x96 rounded tile (rx 22, ink outline) with a small icon-like version of the
 *                    place; default size 96x96 (override with CSS width/height).
 * dark:true        : night version (dusk sky, lit windows, glowing lamps, moon). Day is the default.
 *                    Both versions paint their own sky and ground, so they read on any page background;
 *                    use dark:true when the page is in dark mode (html[data-theme="dark"]).
 *
 * Everything is explicit fills/strokes (no external CSS, no <style>), every id is unique per call,
 * and every SVG carries role="img" and a <title>. Text uses textLength so it never depends on a font.
 * Pure strings: safe to concatenate into innerHTML. No dependencies.
 */
(function (global) {
  'use strict';

  var INK = '#2B2230';
  var C = {
    tomato: '#E04A2F', tomatoD: '#A9361F', tomatoL: '#FFE3DB',
    teal: '#177A77', tealD: '#0E5754', tealL: '#D4EFEA',
    mustard: '#F3B534', mustardD: '#B97E0A', mustardL: '#FFF0C6',
    blush: '#F9CBBE', blushD: '#E3A08E', blushL: '#FDE9E2',
    cream: '#FFF5E8', paper: '#FFFDF8', line: '#EBDCC8', lineD: '#D9C6AA',
    ink2: '#675A6B', dress: '#D8312B',
    // additions the mockup did not need: enamel blue (Paris street plates), plum (friperie), glass, wood, crust
    blue: '#2F4B9B', plum: '#5B3F66', plumD: '#3F2C4A', glass: '#D6EEF2', wood: '#7A5C3A',
    crate: '#E3B15A', crust: '#E9A23B', leaf: '#6FBF7B', skin: '#E8B08A', hair: '#D9D2DE'
  };
  var FONT = 'Bricolage Grotesque,Avenir Next,Trebuchet MS,system-ui,sans-serif';

  /* per-unit palette: sky, far skyline tint, pavement */
  var THEME = {
    1: { sky: '#BFE4DC', far: '#A5D3C8', pave: C.line },
    2: { sky: '#FFEBB8', far: '#F2D693', pave: C.line },
    3: { sky: '#FBD9CC', far: '#F1BDAB', pave: C.line },
    4: { sky: '#CFE6F0', far: '#B3D2E1', pave: C.line },
    5: { sky: '#E6DCF2', far: '#CFC0E2', pave: C.line }
  };
  var NAMES = {
    1: 'Le café des langues',
    2: 'L’immeuble de Mamie Jo',
    3: 'La boulangerie de M. Dubois',
    4: 'La station de métro',
    5: 'La friperie'
  };
  /* le thème d'une unité = son titre dans content/meta.js */
  var TOPICS = {};
  try { Object.values(window.COURSE.units).forEach(function (u) { TOPICS[u.n] = u.titre.replace(/'/g, '’'); }); } catch (e) {}

  /* ---- render state (set by svg()) ---- */
  var NIGHT = false, LIGHTS = [], DEFS = [], ID = '', T = THEME[1], uid = 0, WINN = 0;

  /* ---- tiny drawing kit ---- */
  function st(o) {
    var s = '';
    if (!o.ns) s += ' stroke="' + (o.stroke || INK) + '" stroke-width="' + (o.sw || 2) + '" stroke-linejoin="round" stroke-linecap="round"';
    if (o.op != null) s += ' opacity="' + o.op + '"';
    return s;
  }
  function R(x, y, w, h, fill, o) {
    o = o || {};
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '"' + (o.rx ? ' rx="' + o.rx + '"' : '') + ' fill="' + fill + '"' + st(o) + '/>';
  }
  function E(cx, cy, rx, ry, fill, o) {
    o = o || {};
    return '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="' + fill + '"' + st(o) + '/>';
  }
  function K(cx, cy, r, fill, o) { return E(cx, cy, r, r, fill, o); }
  function P(d, fill, o) { return '<path d="' + d + '" fill="' + fill + '"' + st(o || {}) + '/>'; }
  /* a stroked line with an ink outline (like a tube) */
  function tube(d, color, w) {
    return '<path d="' + d + '" fill="none" stroke="' + INK + '" stroke-width="' + (w + 2.4) + '" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round"/>';
  }
  function line(d, color, w, op) {
    return '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round"' + (op != null ? ' opacity="' + op + '"' : '') + '/>';
  }
  function txt(x, y, str, size, fill, len) {
    return '<text x="' + x + '" y="' + y + '" text-anchor="middle" font-family="' + FONT + '" font-weight="800" font-size="' + size + '" fill="' + fill + '"' +
      (len ? ' textLength="' + len + '" lengthAdjust="spacingAndGlyphs"' : '') + '>' + str + '</text>';
  }
  /* scalloped striped awning: x,y top-left, w width, n stripes, h straight height */
  function awning(x, y, w, n, h, c1, c2, sw) {
    var s = w / n, r = +(s / 2).toFixed(2), out = '', i, x0, x1;
    for (i = 0; i < n; i++) {
      x0 = +(x + i * s).toFixed(2); x1 = +(x0 + s).toFixed(2);
      out += P('M' + x0 + ' ' + y + 'H' + x1 + 'V' + (y + h) + 'A' + r + ' ' + r + ' 0 0 1 ' + x0 + ' ' + (y + h) + 'Z', i % 2 ? c2 : c1, { sw: sw || 1.7 });
    }
    return out + R(x - 1, y - 3, w + 2, 5, C.tomatoD, { sw: sw || 1.7, rx: 1.5 }) + R(x + 2, y - 2, w - 4, 1.4, '#fff', { ns: 1, op: 0.25 });
  }
  /* soft glow (radial gradient), only at night, drawn above the dusk overlay; k = strength 0..1 */
  function glow(x, y, r, k) {
    if (NIGHT) LIGHTS.push('<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="url(#' + ID + 'g)"' + (k != null ? ' opacity="' + k + '"' : '') + '/>');
  }
  function lit(markup) { if (NIGHT) LIGHTS.push(markup); }
  /* window: lit at night unless o.lit===false; o.bare = no muntins; o.arch = round top */
  function win(x, y, w, h, o) {
    o = o || {};
    var arch = o.arch, d = '', s = '', glass = o.glass || C.glass, bars = '';
    if (arch) d = 'M' + x + ' ' + (y + h) + 'V' + (y + w / 2) + 'A' + (w / 2) + ' ' + (w / 2) + ' 0 0 1 ' + (x + w) + ' ' + (y + w / 2) + 'V' + (y + h) + 'Z';
    s += arch ? P(d, glass, { sw: 1.8 }) : R(x, y, w, h, glass, { sw: 1.8, rx: 1.5 });
    if (!o.bare) {
      bars += line('M' + (x + w / 2) + ' ' + (arch ? y + 2 : y) + 'V' + (y + h), INK, 1.2, 0.7);
      if (!arch || h > w) bars += line('M' + x + ' ' + (y + h * 0.5) + 'H' + (x + w), INK, 1.2, 0.7);
      s += bars + '<path d="M' + (x + 3) + ' ' + (y + h - 3) + 'L' + (x + 7) + ' ' + (y + h * 0.55) + '" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".55"/>';
    }
    if (NIGHT && o.lit !== false && (o.lit === true || o.bare || o.tint || (++WINN * 7 + 2) % 5 < 3)) {
      glow(x + w / 2, y + h / 2, Math.max(w, h) * 1.15, o.tint ? 0.5 : 0.8);
      if (o.tint) { LIGHTS.push(R(x, y, w, h, '#FFC857', { ns: 1, op: 0.3 })); return s; }
      LIGHTS.push((arch ? P(d, '#FFD27A', { sw: 1.8 }) : R(x, y, w, h, '#FFD27A', { sw: 1.8, rx: 1.5 })) + bars.replace(/opacity="0.7"/g, 'opacity="0.55"'));
    }
    return s;
  }
  function shutters(x, y, w, h, wi, color) {
    return R(x - wi - 1, y, wi, h, color, { sw: 1.6 }) + R(x + w + 1, y, wi, h, color, { sw: 1.6 }) +
      line('M' + (x - wi / 2 - 1) + ' ' + (y + 3) + 'V' + (y + h - 3) + 'M' + (x + w + wi / 2 + 1) + ' ' + (y + 3) + 'V' + (y + h - 3), INK, 1, 0.35);
  }
  function plant(cx, base, s, pot) {   // pot sits on y=base
    s = s || 1;
    var o = '';
    o += P('M' + (cx - 11 * s) + ' ' + (base - 20 * s) + 'C' + (cx - 14 * s) + ' ' + (base - 36 * s) + ' ' + (cx - 6 * s) + ' ' + (base - 44 * s) + ' ' + (cx - 2 * s) + ' ' + (base - 24 * s) + 'Z', C.teal, { sw: 1.8 });
    o += P('M' + (cx + 11 * s) + ' ' + (base - 20 * s) + 'C' + (cx + 15 * s) + ' ' + (base - 36 * s) + ' ' + (cx + 7 * s) + ' ' + (base - 42 * s) + ' ' + (cx + 2 * s) + ' ' + (base - 24 * s) + 'Z', C.leaf, { sw: 1.8 });
    o += P('M' + (cx - 5 * s) + ' ' + (base - 20 * s) + 'C' + (cx - 8 * s) + ' ' + (base - 40 * s) + ' ' + (cx + 4 * s) + ' ' + (base - 48 * s) + ' ' + (cx + 5 * s) + ' ' + (base - 20 * s) + 'Z', C.teal, { sw: 1.8 });
    o += P('M' + (cx - 11 * s) + ' ' + (base - 20 * s) + 'H' + (cx + 11 * s) + 'L' + (cx + 8 * s) + ' ' + base + 'H' + (cx - 8 * s) + 'Z', pot || C.tomato, { sw: 1.9 });
    return o;
  }
  function cloud(x, y, s) {
    s = s || 1;
    if (NIGHT) return '';
    return '<g fill="#fff" opacity=".78" transform="translate(' + x + ' ' + y + ') scale(' + s + ')"><ellipse cx="0" cy="0" rx="18" ry="7"/><ellipse cx="-10" cy="-5" rx="9" ry="7"/><ellipse cx="5" cy="-8" rx="11" ry="9"/></g>';
  }
  function skyline(arr, base) {
    var o = '', i, b, x, w, h, ch;
    for (i = 0; i < arr.length; i++) {
      b = arr[i]; x = b[0]; w = b[1]; h = b[2]; ch = b[3];
      o += '<path d="M' + x + ' ' + base + 'V' + (base - h) + 'L' + (x + 5) + ' ' + (base - h - 8) + 'H' + (x + w - 5) + 'L' + (x + w) + ' ' + (base - h) + 'V' + base + 'Z" fill="' + T.far + '"/>';
      if (ch) o += '<rect x="' + (x + ch) + '" y="' + (base - h - 16) + '" width="6" height="10" fill="' + T.far + '"/>';
    }
    return o;
  }
  function eiffel(x, base, s) {
    return '<g fill="' + T.far + '" transform="translate(' + x + ' ' + base + ') scale(' + s + ')"><path d="M0 -92 L4 -62 L11 -62 L18 0 H11 C9 -20 -9 -20 -11 0 H-18 L-11 -62 L-4 -62 Z"/></g>';
  }
  function ground(top, bottom, w) {
    return R(0, top, w, bottom - top, T.pave, { ns: 1 }) + R(0, top, w, 4, C.lineD, { ns: 1, op: 0.7 });
  }
  function pavers(y0, dx) {
    var o = '', i;
    for (i = 0; i < 16; i++) o += line('M' + (i * 24 + dx) + ' ' + (y0 + (i % 3) * 11) + 'h10', C.lineD, 1.6, 0.8);
    return o;
  }

  /* little national flags (France, Italy, Spain, Germany, Japan, Morocco, Canada) on a string */
  function flagAt(cx, cy, k) {
    var w = 12, h = 8, x = cx - w / 2, o = '';
    o += R(x, cy, w, h, '#fff', { ns: 1 });
    if (k === 0) o += R(x, cy, 4, h, C.blue, { ns: 1 }) + R(x + 8, cy, 4, h, '#E4312B', { ns: 1 });
    else if (k === 1) o += R(x, cy, 4, h, '#2E9E5B', { ns: 1 }) + R(x + 8, cy, 4, h, '#E4312B', { ns: 1 });
    else if (k === 2) o += R(x, cy, w, 2.7, '#C8362B', { ns: 1 }) + R(x, cy + 2.7, w, 2.7, C.mustard, { ns: 1 }) + R(x, cy + 5.4, w, 2.6, '#C8362B', { ns: 1 });
    else if (k === 3) o += R(x, cy, w, 2.7, INK, { ns: 1 }) + R(x, cy + 2.7, w, 2.7, '#E4312B', { ns: 1 }) + R(x, cy + 5.4, w, 2.6, C.mustard, { ns: 1 });
    else if (k === 4) o += K(cx, cy + 4, 2.4, '#E4312B', { ns: 1 });
    else if (k === 5) o += R(x, cy, w, h, '#C8362B', { ns: 1 }) + K(cx, cy + 4, 2, '#2E9E5B', { ns: 1 });
    else o += R(x, cy, 3, h, '#E4312B', { ns: 1 }) + R(x + 9, cy, 3, h, '#E4312B', { ns: 1 }) + K(cx, cy + 4, 1.7, '#E4312B', { ns: 1 });
    return o + R(x, cy, w, h, 'none', { sw: 1.2 });
  }
  function flagString(x0, y0, cx, cy, x1, y1, n) {
    var o = line('M' + x0 + ' ' + y0 + 'Q' + cx + ' ' + cy + ' ' + x1 + ' ' + y1, INK, 1.6), i, t, x, y;
    for (i = 0; i < n; i++) {
      t = (i + 1) / (n + 1);
      x = (1 - t) * (1 - t) * x0 + 2 * t * (1 - t) * cx + t * t * x1;
      y = (1 - t) * (1 - t) * y0 + 2 * t * (1 - t) * cy + t * t * y1;
      o += flagAt(+x.toFixed(1), +(y + 0.5).toFixed(1), i % 7);
    }
    return o;
  }
  function chair(cx, cy, col) {          // bistro chair, seat centre cx,cy
    col = col || C.teal;
    return tube('M' + (cx - 7) + ' ' + (cy + 2) + 'L' + (cx - 8.5) + ' ' + (cy + 20) + 'M' + (cx + 7) + ' ' + (cy + 2) + 'L' + (cx + 8.5) + ' ' + (cy + 20), col, 2.2) +
      tube('M' + (cx - 7) + ' ' + (cy - 1) + 'V' + (cy - 12) + 'Q' + cx + ' ' + (cy - 20) + ' ' + (cx + 7) + ' ' + (cy - 12) + 'V' + (cy - 1), col, 2.4) +
      E(cx, cy, 10, 3.6, C.mustard, { sw: 1.8 });
  }
  function cup(x, y) {                    // x,y = top-left of the rim, 12 wide
    return P('M' + x + ' ' + y + 'h12v4a6 5.2 0 0 1-12 0z', '#fff', { sw: 1.7 }) +
      '<path d="M' + (x + 12) + ' ' + (y + 1.5) + 'h2a2.6 2.6 0 0 1 0 5.2h-2.4" fill="none" stroke="' + INK + '" stroke-width="1.7" stroke-linecap="round"/>' +
      line('M' + (x + 4) + ' ' + (y - 3) + 'c-2-2 2-3 0-6M' + (x + 8.5) + ' ' + (y - 3) + 'c-2-2 2-3 0-6', '#fff', 1.6, 0.9);
  }
  function tee(fill, extra) {            // garment from dir-4, origin = hanger hook, drawn at scale
    return '<path d="M0 2V-8" stroke="' + C.mustardD + '" stroke-width="3" fill="none"/><path d="M-15 16L0 6L15 16" fill="none" stroke="' + C.mustardD + '" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M-18 16L-6 12Q0 20 6 12L18 16L26 32L14 36V72H-14V36L-26 32Z" fill="' + fill + '" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/>' + (extra || '');
  }
  function bread(x1, y1, x2, y2) {       // baguette: tube + scores
    var dx = x2 - x1, dy = y2 - y1, o = tube('M' + x1 + ' ' + y1 + 'L' + x2 + ' ' + y2, C.crust, 5.4), i, t;
    for (i = 1; i < 4; i++) { t = i / 4; o += line('M' + (x1 + dx * t - 1.4) + ' ' + (y1 + dy * t + 1.5) + 'l2.8 -3', C.mustardD, 1.1); }
    return o;
  }
  function bulbs(x, y, w, n, r, col) {
    var o = '', i;
    for (i = 0; i < n; i++) o += K(+(x + (w / (n - 1)) * i).toFixed(1), y, r, col, { ns: 1 });
    return o;
  }

  /* =================================================================== BANNERS (360 x 200) */
  var G = 152;

  function b1() {                         // Le café des langues
    var s = '', i;
    DEFS.push('<pattern id="' + ID + 'k" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="24" height="24" fill="' + C.cream + '"/><rect width="12" height="12" fill="' + C.mustard + '" opacity=".55"/><rect x="12" y="12" width="12" height="12" fill="' + C.mustard + '" opacity=".55"/></pattern>');
    s += skyline([[0, 34, 70, 10], [40, 40, 56, 0], [86, 30, 78, 14], [292, 36, 60, 0], [326, 40, 74, 12]], G);
    s += cloud(96, 30, 0.9);
    // terrace floor
    s += R(0, G, 360, 48, 'url(#' + ID + 'k)', { ns: 1 }) + R(0, G, 360, 4, C.lineD, { ns: 1, op: 0.6 });
    // building
    s += R(150, 26, 200, 126, C.cream, { sw: 2 });
    s += R(143, 15, 214, 12, C.tomatoD, { sw: 2, rx: 2 }) + R(147, 17, 206, 2, '#fff', { ns: 1, op: 0.25 });
    s += R(150, 68, 200, 84, C.teal, { sw: 2 });
    for (i = 0; i < 3; i++) {
      var wx = 168 + i * 62;
      s += shutters(wx, 36, 34, 28, 8, C.teal) + win(wx, 36, 34, 28);
      s += R(wx - 3, 64, 40, 6, C.tomato, { sw: 1.8, rx: 1.5 }) + K(wx + 6, 62, 3, C.blush, { sw: 1.3 }) + K(wx + 14, 60.5, 3, C.mustard, { sw: 1.3 }) + K(wx + 22, 61.5, 3, C.blush, { sw: 1.3 }) + K(wx + 29, 62.5, 3, C.mustard, { sw: 1.3 });
    }
    s += R(158, 73, 184, 15, C.tealD, { sw: 2, rx: 4 }) + txt(250, 84.6, 'CAFÉ DES LANGUES', 10, C.mustardL, 148);
    lit(R(158, 73, 184, 15, C.tealD, { sw: 2, rx: 4 }) + txt(250, 84.6, 'CAFÉ DES LANGUES', 10, '#FFE9A8', 148));
    s += win(162, 118, 92, 30, { glass: C.mustardL, bare: true, tint: true });
    s += line('M168 144l10-22M184 144l10-22', '#fff', 3, 0.5);
    s += line('M208 106V99', INK, 1.5) + E(208, 112, 5, 3.4, C.mustard, { sw: 1.5 });   // pendant lamp
    s += cup(197, 134) + cup(220, 134);
    s += R(160, 146, 96, 4, C.tealD, { sw: 1.8, rx: 1 });
    s += R(268, 108, 36, 44, C.tealD, { sw: 2, rx: 2 }) + win(274, 114, 24, 24, { glass: C.mustardL, bare: true });
    s += K(299, 142, 1.8, C.mustard, { sw: 1 });
    s += awning(153, 91, 194, 12, 8, C.tomato, C.cream);
    glow(208, 112, 24, 0.9);
    // lamp + flags
    s += R(28, 56, 5, 96, C.tealD, { sw: 1.8 }) + R(23, 146, 15, 6, C.tealD, { sw: 1.8, rx: 2 });
    s += (NIGHT ? '' : K(30.5, 44, 17, C.mustard, { ns: 1, op: 0.25 })) + R(21, 33, 19, 22, C.mustard, { sw: 2, rx: 6 }) + R(19, 30, 23, 6, INK, { ns: 1, rx: 3 }) + R(19, 53, 23, 5, INK, { ns: 1, rx: 2 });
    glow(30.5, 44, 34);
    lit(R(21, 33, 19, 22, '#FFE08A', { sw: 2, rx: 6 }) + R(19, 30, 23, 6, INK, { ns: 1, rx: 3 }) + R(19, 53, 23, 5, INK, { ns: 1, rx: 2 }));
    s += flagString(41, 42, 92, 80, 150, 42, 7);
    // plant
    s += plant(328, 152, 1, C.tomato);
    // tables & chairs (in front)
    s += chair(60, 170) + chair(134, 170);
    s += R(93, 170, 6, 22, C.tomatoD, { sw: 1.8 }) + E(96, 193, 12, 3.4, C.tomatoD, { sw: 1.8 }) + E(96, 167, 26, 6.4, C.tomato, { sw: 2 }) + line('M78 166.5q8 -3 16 -3', '#fff', 1.6, 0.5);
    s += cup(88, 160);
    s += chair(212, 176) + chair(294, 176);
    s += R(249, 176, 6, 18, C.tomatoD, { sw: 1.8 }) + E(252, 196, 11, 3, C.tomatoD, { sw: 1.8 }) + E(252, 174, 26, 6.4, C.tomato, { sw: 2 });
    s += E(246, 171, 9, 2.8, '#fff', { sw: 1.5 }) + P('M240 169c1-7 14-7 15 0-4-2-6-2-8-1-2-1-5-1-7 1z', C.crust, { sw: 1.5 });
    s += cup(258, 166);
    return s;
  }

  function joWindow(cx, glass) {          // Mamie Jo waving from her window, flowerbox below
    var s = R(cx - 13, 96, 26, 24, glass, { sw: 1.8, rx: 1.5 });
    s += P('M' + (cx - 13) + ' 97c6 3 3 12 4 22h-4z', C.tomatoL, { sw: 1.3 }) + P('M' + (cx + 13) + ' 97c-6 3-3 12-4 22h4z', C.tomatoL, { sw: 1.3 });
    s += K(cx, 97.5, 4.6, C.hair, { sw: 1.5 });                                                    // bun
    s += P('M' + (cx - 11) + ' 120Q' + (cx - 10) + ' 111 ' + cx + ' 111Q' + (cx + 10) + ' 111 ' + (cx + 11) + ' 120Z', C.tomato, { sw: 1.6 });
    s += E(cx, 105.5, 6, 6.6, C.skin, { sw: 1.5 });
    s += P('M' + (cx - 6.4) + ' 104.5C' + (cx - 6.4) + ' 98.5 ' + (cx + 6.4) + ' 98.5 ' + (cx + 6.4) + ' 104.5C' + (cx + 3) + ' 101.5 ' + (cx - 3) + ' 101.5 ' + (cx - 6.4) + ' 104.5Z', C.hair, { sw: 1.2 });
    s += K(cx - 2.6, 106, 0.9, INK, { ns: 1 }) + K(cx + 2.6, 106, 0.9, INK, { ns: 1 }) + line('M' + (cx - 2.4) + ' 109q2.4 1.8 4.8 0', INK, 1.1);
    s += '<g fill="none" stroke="' + INK + '" stroke-width="0.9"><circle cx="' + (cx - 2.6) + '" cy="106" r="2.3"/><circle cx="' + (cx + 2.6) + '" cy="106" r="2.3"/></g>';
    s += line('M' + (cx + 8.5) + ' 111Q' + (cx + 12) + ' 108 ' + (cx + 12.4) + ' 105.5', C.tomato, 3) + K(cx + 12.4, 103, 2.6, C.skin, { sw: 1.3 });
    s += R(cx - 15, 118, 30, 7, C.tomatoD, { sw: 1.8, rx: 1.5 }) + K(cx - 8, 116, 2.8, C.dress, { sw: 1.2 }) + K(cx, 114.5, 2.8, C.blush, { sw: 1.2 }) + K(cx + 8, 116, 2.8, C.dress, { sw: 1.2 });
    return s;
  }

  function b2() {                         // L'immeuble de Mamie Jo
    var s = '', i, cx, cols = [96, 138, 180, 222, 264];
    s += skyline([[10, 34, 60, 8], [62, 30, 70, 0], [300, 36, 66, 10]], G);
    s += cloud(318, 26, 0.85) + cloud(40, 52, 0.7);
    s += ground(G, 200, 360) + pavers(G + 14, 4);
    // neighbours
    s += R(-4, 72, 62, 80, C.blush, { sw: 2 }) + R(-4, 66, 66, 8, C.blushD, { sw: 2, rx: 2 }) + win(12, 84, 20, 24) + win(12, 118, 20, 24) + R(8, 108, 28, 4, C.blushD, { sw: 1.6 });
    s += R(302, 62, 62, 90, C.mustardL, { sw: 2 }) + R(298, 56, 66, 8, C.mustard, { sw: 2, rx: 2 }) + win(316, 76, 20, 24, { lit: false }) + win(316, 112, 20, 24, { lit: false });
    // roof
    s += P('M60 44L76 17H284L300 44Z', C.tealD, { sw: 2 });
    s += line('M70 28H290M66 36H294', '#fff', 1.4, 0.2);
    s += R(106, 4, 14, 14, C.tomatoD, { sw: 1.8 }) + R(104, 2, 18, 4, INK, { ns: 1, rx: 1.5 }) + R(238, 4, 14, 14, C.tomatoD, { sw: 1.8 }) + R(236, 2, 18, 4, INK, { ns: 1, rx: 1.5 });
    [100, 180, 260].forEach(function (dx) {
      s += R(dx - 11, 24, 22, 20, C.cream, { sw: 1.8 }) + P('M' + (dx - 14) + ' 25L' + dx + ' 12L' + (dx + 14) + ' 25Z', C.tealD, { sw: 1.8 }) + win(dx - 7, 28, 14, 15);
    });
    // facade
    s += R(64, 46, 232, 106, C.cream, { sw: 2 });
    s += R(60, 43, 240, 6, C.line, { sw: 2, rx: 2 });
    s += R(62, 120, 236, 6, C.line, { sw: 2 });                         // band
    s += R(64, 126, 232, 26, C.line, { sw: 2 }) + line('M64 133H296M64 140H296M64 147H296', C.lineD, 1.2);  // rusticated ground floor
    // row A (balcony)
    cols.forEach(function (c) { s += win(c - 13, 54, 26, 30); });
    s += R(62, 84, 236, 5, C.line, { sw: 2, rx: 1.5 });
    s += line('M66 74H294', INK, 2);
    for (i = 0; i < 29; i++) s += line('M' + (68 + i * 8) + ' 74V84', INK, 1.2, 0.8);
    s += plant(96, 84, 0.62, C.tomato) + plant(180, 84, 0.62, C.mustardD) + plant(264, 84, 0.62, C.tomato);
    // row B
    [96, 138, 180, 264].forEach(function (c) {
      s += shutters(c - 13, 96, 26, 24, 6, C.teal) + win(c - 13, 96, 26, 24);
      s += R(c - 15, 118, 30, 7, C.tomatoD, { sw: 1.8, rx: 1.5 }) + K(c - 8, 116, 2.8, C.blush, { sw: 1.2 }) + K(c, 114.5, 2.8, C.mustard, { sw: 1.2 }) + K(c + 8, 116, 2.8, C.blush, { sw: 1.2 });
    });
    // Mamie Jo's window (redrawn above the dusk overlay at night, so she stays visible and lit)
    cx = 222;
    s += R(cx - 20, 96, 7, 24, C.teal, { sw: 1.6 }) + R(cx + 14, 96, 7, 24, C.teal, { sw: 1.6 });
    s += joWindow(cx, '#FFE29A');
    glow(cx, 108, 36);
    lit(joWindow(cx, '#FFD27A'));
    // ground floor
    s += P('M164 152V138A16 14 0 0 1 196 138V152Z', C.tomato, { sw: 2 });
    s += P('M169 152V139A11 10 0 0 1 191 139V152Z', C.tomatoD, { sw: 1.4 }) + line('M180 128V152', INK, 1.6, 0.6);
    s += K(176, 144, 1.6, C.mustard, { sw: 0.8 }) + K(184, 144, 1.6, C.mustard, { sw: 0.8 });
    lit(P('M168 138A12 11 0 0 1 192 138Z', '#FFD27A', { sw: 1.4 }));
    s += R(199, 134, 9, 8, C.blue, { sw: 1.4, rx: 2 }) + line('M201.5 138h4', '#fff', 1.2);
    [96, 138, 222, 264].forEach(function (c) {
      s += win(c - 12, 131, 24, 16) + R(c - 14, 147, 28, 3.4, C.lineD, { sw: 1.4, rx: 1 });
    });
    s += R(158, 150, 44, 4, C.lineD, { sw: 1.6, rx: 1 });
    // tree
    s += R(326, 116, 7, 38, C.wood, { sw: 1.9 }) + K(330, 98, 19, C.teal, { sw: 2 }) + K(316, 112, 13, C.leaf, { sw: 2 }) + K(344, 111, 13, C.leaf, { sw: 2 }) + K(330, 108, 11, C.teal, { ns: 1 });
    s += '<g fill="' + C.tealD + '" opacity=".4"><circle cx="324" cy="94" r="3"/><circle cx="337" cy="100" r="3"/><circle cx="316" cy="110" r="2.4"/></g>';
    // cat on the pavement
    s += P('M236 160c0-8 5-11 9-10l1-5 3 3 3-3 1 5c3 2 4 6 4 10z', INK, { sw: 1.2 }) + line('M254 160c5 0 7-5 4-8', INK, 2.4);
    return s;
  }

  function b3() {                         // La boulangerie de M. Dubois + market stall
    var s = '';
    s += skyline([[0, 30, 70, 8], [236, 34, 58, 0], [300, 36, 74, 12], [340, 30, 60, 0]], G);
    s += cloud(296, 26, 0.85);
    s += ground(G, 200, 360) + pavers(G + 14, 10);
    // bakery
    s += R(20, 20, 208, 132, C.cream, { sw: 2 }) + R(14, 10, 220, 11, C.tomatoD, { sw: 2, rx: 2 }) + R(18, 12, 212, 2, '#fff', { ns: 1, op: 0.25 });
    [44, 108, 172].forEach(function (x) { s += shutters(x, 28, 30, 26, 7, C.tomato) + win(x, 28, 30, 26) + R(x - 3, 54, 36, 5, C.line, { sw: 1.6, rx: 1 }); });
    s += R(20, 62, 208, 90, C.tomatoD, { sw: 2 });
    s += R(30, 65, 188, 17, C.mustardL, { sw: 2, rx: 3 }) + txt(124, 78.4, 'BOULANGERIE', 12.5, C.tomatoD, 126);
    lit(R(30, 65, 188, 17, '#FFE9A8', { sw: 2, rx: 3 }) + txt(124, 78.4, 'BOULANGERIE', 12.5, C.tomatoD, 126));
    [42, 206].forEach(function (x) { s += line('M' + x + ' 79V68', C.mustardD, 1.5) + E(x - 3, 72, 1.8, 3, C.mustard, { sw: 1 }) + E(x + 3, 72, 1.8, 3, C.mustard, { sw: 1 }) + E(x, 68, 1.8, 3, C.mustard, { sw: 1 }); });
    // window with shelves + Dubois
    s += win(34, 106, 120, 42, { glass: '#FFE9B8', bare: true, tint: true });
    s += R(36, 118, 116, 3, C.mustardD, { sw: 1.4 });
    [42, 52, 62, 118, 128, 138].forEach(function (x, k) { s += E(x + 4, 115, 5, 3.3, k % 2 ? C.crust : '#F4C16A', { sw: 1.3 }); });
    s += R(80, 118, 28, 30, C.cream, { sw: 1.6, rx: 3 }) + E(94, 125, 7, 7.6, '#C78B62', { sw: 1.5 });
    s += P('M87 120q0-4 7-4t7 4v-2c4-1 4-7 0-9 1-5-6-7-7-4-2-3-9 0-7 4-4 2-4 8 0 9z', '#fff', { sw: 1.5 }) + R(87.5, 118, 13, 5, '#fff', { sw: 1.4, rx: 1 });
    s += K(91.5, 125.5, 0.9, INK, { ns: 1 }) + K(96.5, 125.5, 0.9, INK, { ns: 1 }) + line('M90 129q4 -2.6 8 0', '#2A1B2E', 1.8) + line('M92 131q2 1.4 4 0', INK, 1);
    s += R(36, 138, 116, 10, C.mustardD, { sw: 1.6, rx: 1.5 }) + R(40, 134, 20, 5, C.cream, { sw: 1.4, rx: 2 }) + E(125, 134, 8, 3.4, C.crust, { sw: 1.4 }) + E(140, 135, 6, 2.8, C.crust, { sw: 1.4 });
    // door
    s += R(166, 104, 44, 48, C.mustard, { sw: 2, rx: 2 }) + win(173, 110, 30, 26, { glass: C.cream, bare: true }) + line('M188 110V136', INK, 1.3, 0.6) + K(204, 146, 1.8, C.tomatoD, { sw: 1 });
    s += R(179, 119, 18, 8, C.tomato, { sw: 1.3, rx: 2 }) + line('M182 123h12', '#fff', 1.4);
    s += awning(24, 85, 200, 10, 8, C.teal, C.cream);
    // basket of baguettes
    s += bread(48, 148, 41, 128) + bread(55, 148, 55, 124) + bread(62, 148, 68, 128);
    s += P('M42 144H70L66 164H46Z', C.crate, { sw: 2 }) + line('M44 150H68M45 156H67', C.mustardD, 1.4) + line('M52 144L51 163M60 144L61 163', C.mustardD, 1.2);
    // market stall
    s += R(240, 70, 4, 82, C.mustardD, { sw: 1.7 }) + R(348, 70, 4, 82, C.mustardD, { sw: 1.7 });
    s += R(238, 126, 118, 6, C.mustardD, { sw: 1.8, rx: 1.5 });
    [244, 280, 316].forEach(function (x) { s += R(x, 132, 34, 20, C.crate, { sw: 1.8 }) + line('M' + x + ' 140H' + (x + 34) + 'M' + x + ' 146H' + (x + 34), C.mustardD, 1.2); });
    [[250, C.tomato], [284, C.mustard], [318, C.leaf]].forEach(function (b) {
      var x = b[0];
      s += R(x, 117, 30, 9, C.crate, { sw: 1.7 });
      [[6, 0], [14, -1], [22, 0], [10, -7], [18, -7]].forEach(function (p) { s += K(x + p[0] + 1, 113 + p[1], 5.2, b[1], { sw: 1.5 }); });
    });
    s += awning(236, 70, 120, 8, 9, C.tomato, C.cream);
    return s;
  }

  function b4() {                         // La station de métro
    var s = '', i;
    s += skyline([[120, 30, 58, 0], [236, 30, 50, 6], [330, 34, 62, 0]], G);
    s += eiffel(298, 72, 0.7) + cloud(196, 22, 0.9) + cloud(50, 18, 0.7);
    // pavement + road
    s += R(0, G, 360, 26, '#E6D6BE', { ns: 1 }) + R(0, G, 360, 4, C.lineD, { ns: 1, op: 0.7 });
    s += R(0, 176, 360, 24, '#8D8498', { ns: 1 }) + R(0, 174, 360, 4, '#CBBFA8', { ns: 1 }) + line('M0 176H360', INK, 2);
    for (i = 0; i < 6; i++) s += R(132 + i * 18, 181, 10, 17, C.cream, { ns: 1, rx: 1.5 });
    s += line('M10 189h18M44 189h18M296 189h18M330 189h18', C.cream, 2.4, 0.6);
    // left building
    s += R(-4, 40, 124, 112, C.cream, { sw: 2 }) + R(-6, 30, 130, 11, C.tealD, { sw: 2, rx: 2 }) + R(-6, 120, 130, 5, C.line, { sw: 2 });
    [12, 48, 84].forEach(function (x) {
      s += win(x, 46, 24, 28) + R(x - 2, 66, 28, 3.4, C.lineD, { sw: 1.4 }) + win(x, 94, 24, 24, { lit: false }) + line('M' + (x - 1) + ' 112H' + (x + 25), INK, 1.8);
    });
    s += R(14, 78, 94, 11, C.blue, { sw: 1.6, rx: 2 }) + txt(61, 86.6, 'RUE DE LA GARE', 7, '#fff', 80);
    // bike
    s += tube('M36 142L58 142L52 122L36 142M52 122L76 120M58 142L76 120M76 120L84 142', C.tomato, 2.6);
    s += tube('M52 122L50 114', INK, 1.2) + R(44, 110, 14, 4, INK, { ns: 1, rx: 2 }) + line('M72 112H82', INK, 3);
    s += tube('M76 120L78 113', C.tomato, 2.4);
    s += K(36, 142, 12.4, 'none', { sw: 2.6 }) + K(84, 142, 12.4, 'none', { sw: 2.6 }) + K(36, 142, 2, INK, { ns: 1 }) + K(84, 142, 2, INK, { ns: 1 });
    s += line('M36 130V154M24 142H48M84 130V154M72 142H96', C.ink2, 0.8, 0.7);
    s += R(78, 104, 15, 10, C.crate, { sw: 1.7, rx: 2 }) + line('M81 104L88 92', INK, 5.2) + line('M81 104L88 92', C.crust, 3);
    // right building
    s += R(246, 58, 118, 94, C.mustardL, { sw: 2 }) + R(242, 49, 124, 10, C.mustard, { sw: 2, rx: 2 }) + win(262, 68, 22, 26, { lit: false }) + win(326, 68, 22, 26) + win(294, 68, 22, 26);
    // bus stop
    s += R(284, 96, 68, 6, C.tealD, { sw: 1.8, rx: 2 }) + R(286, 102, 62, 46, '#E6F3F7', { sw: 1.8 }) + line('M296 144l12-38M312 144l12-38', '#fff', 3, 0.7);
    s += R(329, 108, 16, 24, C.tomato, { sw: 1.5, rx: 1.5 }) + line('M332 114h10M332 119h10M332 124h6', '#fff', 1.2);
    glow(337, 120, 30, 0.8); lit(R(329, 108, 16, 24, '#FFB878', { sw: 1.5, rx: 1.5 }));
    s += R(293, 137, 32, 5, C.mustardD, { sw: 1.6, rx: 1.5 }) + line('M296 142V150M322 142V150', INK, 1.6);
    s += R(284, 100, 4, 52, C.tealD, { sw: 1.6 }) + R(348, 100, 4, 52, C.tealD, { sw: 1.6 });
    s += R(264, 82, 4, 70, C.ink2, { sw: 1.5 }) + K(266, 76, 11, C.tomato, { sw: 2 }) + txt(266, 79, 'BUS', 7.2, '#fff', 15);
    // Guimard entrance
    var cxm = 185;
    s += P('M150 152V122Q150 108 ' + cxm + ' 108Q220 108 220 122V152Z', INK, { sw: 2 });
    for (i = 0; i < 5; i++) s += R(153 + i * 2, 126 + i * 5.2, 64 - i * 4, 3, C.ink2, { ns: 1, rx: 1 });
    s += P('M126 152V134Q126 120 150 114V152Z', C.teal, { sw: 2 }) + P('M244 152V134Q244 120 220 114V152Z', C.teal, { sw: 2 });
    s += line('M134 150V130M142 150V120', C.tealD, 1.6) + line('M236 150V130M228 150V120', C.tealD, 1.6);
    s += R(146, 56, 6, 60, C.tealD, { sw: 1.8, rx: 2 }) + R(218, 56, 6, 60, C.tealD, { sw: 1.8, rx: 2 });
    s += tube('M149 86C141 52 164 42 185 42C206 42 229 52 221 86', C.tealD, 4.4);
    s += R(155, 58, 60, 20, C.tealD, { sw: 1.8, rx: 5 }) + R(158, 60.5, 54, 15, C.mustardL, { ns: 1, rx: 3.5 });
    s += txt(185, 73, 'MÉTRO', 11.5, C.tomatoD, 44);
    lit(R(158, 60.5, 54, 15, '#FFD27A', { ns: 1, rx: 3.5 }) + txt(185, 73, 'MÉTRO', 11.5, C.tomatoD, 44));
    s += K(149, 49, 7, C.mustard, { sw: 2 }) + K(221, 49, 7, C.mustard, { sw: 2 }) + R(144, 54, 10, 4, C.tealD, { sw: 1.4, rx: 1.5 }) + R(216, 54, 10, 4, C.tealD, { sw: 1.4, rx: 1.5 });
    s += R(146, 112, 78, 4, C.tealD, { sw: 1.6, rx: 2 });
    glow(149, 49, 24); glow(221, 49, 24); glow(185, 68, 40, 0.7);
    return s;
  }

  function b5() {                         // La friperie
    var s = '', i, a;
    s += skyline([[0, 30, 66, 10], [260, 34, 60, 0], [310, 40, 76, 12]], G);
    // sun + cloud (weather)
    if (!NIGHT) {
      s += K(318, 36, 14, C.mustard, { ns: 1 });
      for (i = 0; i < 8; i++) { a = i * Math.PI / 4; s += line('M' + (318 + Math.cos(a) * 19).toFixed(1) + ' ' + (36 + Math.sin(a) * 19).toFixed(1) + 'L' + (318 + Math.cos(a) * 25).toFixed(1) + ' ' + (36 + Math.sin(a) * 25).toFixed(1), C.mustard, 3); }
    }
    s += cloud(298, 44, 1.1) + cloud(262, 14, 0.6);
    s += ground(G, 200, 360) + pavers(G + 14, 2);
    // shop
    s += R(36, 22, 208, 130, C.blush, { sw: 2 }) + R(30, 12, 220, 11, C.plum, { sw: 2, rx: 2 }) + R(34, 14, 212, 2, '#fff', { ns: 1, op: 0.2 });
    [50, 118, 186].forEach(function (x) {
      s += shutters(x, 30, 28, 28, 7, C.mustard) + win(x, 30, 28, 28, { arch: true });
      s += R(x - 3, 56, 34, 5, C.blushD, { sw: 1.6, rx: 1.5 });
    });
    s += R(32, 64, 216, 88, C.plum, { sw: 2 });
    s += R(40, 67, 200, 17, C.plumD, { sw: 2, rx: 4 }) + bulbs(46, 69.5, 188, 17, 1.3, '#FFE08A') + bulbs(46, 81.5, 188, 17, 1.3, '#FFE08A');
    s += txt(140, 80.4, 'FRIPERIE', 12.5, C.mustardL, 104);
    lit(R(40, 67, 200, 17, C.plumD, { sw: 2, rx: 4 }) + bulbs(46, 69.5, 188, 17, 1.6, '#FFF1B8') + bulbs(46, 81.5, 188, 17, 1.6, '#FFF1B8') + txt(140, 80.4, 'FRIPERIE', 12.5, '#FFE9A8', 104));
    // window display
    s += win(44, 108, 126, 40, { glass: '#FDECE6', bare: true, tint: true });
    s += R(44, 143, 126, 5, '#C99A6B', { sw: 1.4 });
    s += tube('M62 143V122', C.wood, 2) + E(62, 121, 11, 3, C.crust, { sw: 1.6 }) + P('M55 120q1-9 7-9t7 9z', C.crust, { sw: 1.6 }) + R(55, 117, 14, 2.6, C.tomato, { ns: 1 });
    s += tube('M107 143V132', C.ink2, 2.2) + E(107, 144, 9, 2.6, C.ink2, { sw: 1.5 });
    s += E(107, 112.5, 3.2, 3.8, C.blushD, { sw: 1.4 }) + R(105.5, 115, 3, 3, C.blushD, { sw: 1 });
    s += P('M99 118Q107 115 115 118L113 130L121 143Q107 148 93 143L101 130Z', C.dress, { sw: 1.8 }) + R(101, 127, 12, 2.8, C.cream, { sw: 1.2, rx: 1 }) + line('M98 142q9 3 18 0', '#fff', 1.2, 0.4);
    s += line('M130 112H165', C.wood, 2);
    [[138, C.teal], [150, C.mustard], [160, C.tomatoL]].forEach(function (g) { s += '<g transform="translate(' + g[0] + ' 112) scale(.3)">' + tee(g[1]) + '</g>'; });
    s += R(44, 108, 126, 40, 'none', { sw: 2 }) + line('M52 146l12-34', '#fff', 3, 0.5);
    s += R(184, 106, 46, 46, C.plum, { sw: 2, rx: 2 }) + win(191, 112, 32, 28, { glass: '#FDECE6', bare: true }) + line('M207 112V140', INK, 1.3, 0.6) + K(223, 144, 1.8, C.mustard, { sw: 1 });
    s += R(196, 118, 22, 9, C.cream, { sw: 1.3, rx: 2 }) + line('M199 121.5h16M199 124.5h10', INK, 1.1, 0.6);
    s += awning(36, 87, 208, 10, 8, C.mustard, C.cream);
    // umbrellas in a bin
    s += line('M13 142L7 118', INK, 4.6) + line('M13 142L7 118', C.tomato, 2.6) + line('M20 142L23 116', INK, 4.6) + line('M20 142L23 116', C.teal, 2.6);
    s += R(8, 140, 18, 14, C.ink2, { sw: 1.8, rx: 2 }) + line('M8 146H26', INK, 1);
    // clothes rail outside
    s += tube('M262 154V104M346 154V104', C.ink2, 2.6) + tube('M262 104H346', C.ink2, 2.6) + tube('M255 154H270M338 154H353', C.ink2, 2.6);
    DEFS.push('<clipPath id="' + ID + 't"><path d="M-18 16L-6 12Q0 20 6 12L18 16L26 32L14 36V72H-14V36L-26 32Z"/></clipPath>');
    s += '<g transform="translate(280 106) scale(.62)">' + tee(C.teal) + '</g>';
    s += '<g transform="translate(304 106) scale(.62)">' + tee(C.cream, '<g clip-path="url(#' + ID + 't)" fill="' + C.teal + '"><rect x="-30" y="22" width="60" height="6"/><rect x="-30" y="36" width="60" height="6"/><rect x="-30" y="50" width="60" height="6"/><rect x="-30" y="64" width="60" height="6"/></g>') + '</g>';
    s += '<g transform="translate(328 106) scale(.62)">' + tee(C.mustard) + '</g>';
    return s;
  }

  var BANNER = { 1: b1, 2: b2, 3: b3, 4: b4, 5: b5 };

  /* =================================================================== STOPS (96 x 96) */
  function s1() {
    var s = '';
    s += R(0, 74, 96, 22, C.cream, { ns: 1 }) + R(0, 74, 96, 22, C.mustard, { ns: 1, op: 0.18 }) + R(0, 74, 96, 3, C.lineD, { ns: 1, op: 0.7 });
    s += awning(8, 12, 80, 6, 10, C.tomato, C.cream, 2);
    s += flagString(12, 38, 48, 52, 84, 38, 5);
    s += R(45, 76, 6, 14, C.tomatoD, { sw: 2 }) + E(48, 91, 12, 3, C.tomatoD, { sw: 2 }) + E(48, 76, 28, 6.4, C.tomato, { sw: 2.2 });
    s += cup(41, 66);
    return s;
  }
  function s2() {
    var s = '';
    s += R(0, 78, 96, 18, T.pave, { ns: 1 }) + R(0, 78, 96, 3, C.lineD, { ns: 1, op: 0.7 });
    s += R(55, 6, 8, 10, C.tomatoD, { sw: 2 });
    s += P('M13 34L22 13H74L83 34Z', C.tealD, { sw: 2.2 });
    s += R(18, 33, 60, 45, C.cream, { sw: 2.2 }) + R(14, 32, 68, 4.4, C.line, { sw: 2, rx: 1.5 });
    [24, 42, 60].forEach(function (x) { s += win(x, 40, 12, 15, { bare: true }); });
    s += R(14, 55, 68, 4, C.line, { sw: 2, rx: 1.5 }) + line('M16 51H80', INK, 1.6);
    s += plant(30, 55, 0.4, C.tomato);
    [24, 42].forEach(function (x) { s += win(x, 62, 12, 14, { bare: true }); });
    s += R(40, 74, 16, 4, C.tomatoD, { sw: 1.6, rx: 1 }) + K(44, 72, 1.8, C.blush, { sw: 1 }) + K(48, 71, 1.8, C.mustard, { sw: 1 });
    // Mamie Jo's lit window
    s += R(58, 62, 14, 14, '#FFE29A', { sw: 1.8 }) + K(65, 69, 4, C.skin, { sw: 1.4 }) + K(65, 63.8, 2.4, C.hair, { sw: 1.2 }) + P('M58 76Q59 73 65 73Q71 73 72 76Z', C.tomato, { sw: 1.2 });
    glow(65, 69, 22); lit(R(58, 62, 14, 14, '#FFD27A', { sw: 1.8 }) + K(65, 69, 4, C.skin, { sw: 1.4 }) + K(65, 63.8, 2.4, C.hair, { sw: 1.2 }));
    return s;
  }
  function s3() {
    var s = '';
    s += R(0, 76, 96, 20, T.pave, { ns: 1 }) + R(0, 76, 96, 3, C.lineD, { ns: 1, op: 0.7 });
    s += awning(8, 12, 80, 6, 11, C.teal, C.cream, 2);
    s += bread(34, 62, 24, 34) + bread(47, 62, 47, 30) + bread(60, 62, 70, 34);
    s += P('M22 58H74L69 86H27Z', C.crate, { sw: 2.2 }) + line('M25 66H71M26 74H70M27 80H69', C.mustardD, 1.6) + line('M36 58L34 86M48 58V86M60 58L62 86', C.mustardD, 1.4);
    s += E(82, 78, 6, 3.4, C.crust, { sw: 1.6 }) + E(14, 79, 5.5, 3, C.crust, { sw: 1.6 });
    glow(48, 50, 44, 0.6);
    return s;
  }
  function s4() {
    var s = '';
    s += R(0, 80, 96, 16, '#E6D6BE', { ns: 1 }) + R(0, 80, 96, 3, C.lineD, { ns: 1, op: 0.7 });
    s += P('M26 82V64Q26 52 48 52Q70 52 70 64V82Z', INK, { sw: 2.2 });
    s += R(30, 66, 36, 2.6, C.ink2, { ns: 1, rx: 1 }) + R(33, 72, 30, 2.6, C.ink2, { ns: 1, rx: 1 }) + R(36, 78, 24, 2.6, C.ink2, { ns: 1, rx: 1 });
    s += P('M17 82V64Q17 56 26 52V82Z', C.teal, { sw: 2.2 }) + P('M79 82V64Q79 56 70 52V82Z', C.teal, { sw: 2.2 });
    s += R(11, 26, 6, 56, C.tealD, { sw: 2, rx: 2 }) + R(79, 26, 6, 56, C.tealD, { sw: 2, rx: 2 });
    s += tube('M14 46C12 14 34 10 48 10C62 10 84 14 82 46', C.tealD, 4.6);
    s += R(24, 24, 48, 22, C.tealD, { sw: 2, rx: 6 }) + R(26.5, 26.5, 43, 17, C.mustardL, { ns: 1, rx: 4 });
    s += txt(48, 39, 'MÉTRO', 12.5, C.tomatoD, 36);
    lit(R(26.5, 26.5, 43, 17, '#FFD27A', { ns: 1, rx: 4 }) + txt(48, 39, 'MÉTRO', 12.5, C.tomatoD, 36));
    s += K(14, 21, 7, C.mustard, { sw: 2.2 }) + K(82, 21, 7, C.mustard, { sw: 2.2 });
    glow(14, 21, 20); glow(82, 21, 20);
    return s;
  }
  function s5() {
    var s = '';
    s += R(0, 78, 96, 18, '#E7C79B', { ns: 1 }) + R(0, 78, 96, 3, '#C99A6B', { ns: 1, op: 0.7 }) + line('M0 88H96M24 82V96M60 88V96', '#C99A6B', 1.2, 0.7);
    s += tube('M6 14H90', C.plum, 3.4);
    s += line('M48 14V22', INK, 2.4) + '<path d="M48 22c0-4 4-4 4-7" fill="none" stroke="' + INK + '" stroke-width="2.2" stroke-linecap="round"/>';
    s += tube('M30 37L48 25L66 37', C.mustardD, 2.4);
    s += P('M40 34Q48 38 56 34L58 50L72 80Q48 90 24 80L38 50Z', C.dress, { sw: 2.4 });
    s += R(37.5, 47.5, 21, 5, C.cream, { sw: 1.8, rx: 1.5 }) + line('M30 78q18 8 36 0', '#fff', 1.8, 0.4) + line('M44 56L40 76', '#fff', 2, 0.28);
    s += P('M68 40h8v10h-8z', C.mustard, { sw: 1.6 }) + line('M72 40L66 36', INK, 1.4) + K(72, 44.5, 1.1, INK, { ns: 1 });
    glow(48, 50, 48, 0.6);
    return s;
  }
  var STOP = { 1: s1, 2: s2, 3: s3, 4: s4, 5: s5 };

  /* night: moon + stars, at positions that are clear sky in each scene */
  var MOON_B = { 1: [78, 22], 2: [32, 30], 3: [300, 32], 4: [70, 15], 5: [320, 34] };
  var STARS_B = {
    1: [[40, 12], [112, 14], [200, 8], [128, 30]], 2: [[100, 8], [180, 6], [20, 14], [330, 14]],
    3: [[8, 28], [110, 4], [250, 14], [340, 12]], 4: [[20, 10], [112, 16], [250, 10], [340, 24]],
    5: [[24, 10], [120, 6], [210, 8], [270, 20]]
  };
  var STARS_S = { 1: [[16, 56], [80, 58], [89, 47]], 2: [[8, 42], [89, 44], [90, 64]], 3: [[9, 52], [88, 56], [86, 40]], 4: [[5, 38], [91, 40], [6, 62]], 5: [[10, 42], [87, 62], [88, 44]] };

  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function svg(unit, o) {
    o = o || {};
    unit = parseInt(unit, 10);
    if (!NAMES[unit]) unit = 1;
    var stop = o.variant === 'stop', W = stop ? 96 : 360, H = stop ? 96 : 200, i;
    NIGHT = !!o.dark; LIGHTS = []; DEFS = []; WINN = 0; T = THEME[unit]; ID = 'pl' + (++uid) + 'u' + unit;
    var body = '', night = '', title = o.title || NAMES[unit];
    if (NIGHT) DEFS.push('<radialGradient id="' + ID + 'g"><stop offset="0" stop-color="#FFE9A8" stop-opacity=".85"/><stop offset=".35" stop-color="#FFC857" stop-opacity=".4"/><stop offset="1" stop-color="#F3B534" stop-opacity="0"/></radialGradient>');
    body += R(0, 0, W, H, NIGHT ? '#8F8CD2' : T.sky, { ns: 1 });
    body += (stop ? STOP[unit]() : BANNER[unit]());
    if (NIGHT) {
      var m = MOON_B[unit], stars = stop ? STARS_S[unit] : STARS_B[unit];
      night += R(0, 0, W, H, '#17144A', { ns: 1, op: 0.52 });
      night += LIGHTS.join('');
      for (i = 0; i < stars.length; i++) night += K(stars[i][0], stars[i][1], stop ? 1 : 1.3, '#FFF5E8', { ns: 1, op: 0.9 });
      if (!stop) night += K(m[0], m[1], 9, '#FFF0C6', { ns: 1 }) + K(m[0] + 4, m[1] - 2, 8.2, '#6D69B3', { ns: 1 });
    }
    var tid = ID + 'ti', clipId = ID + 'c';
    var head = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '"' + (stop ? ' width="96" height="96"' : '') + ' role="img" aria-labelledby="' + tid + '"' +
      ' preserveAspectRatio="' + (o.fit === 'meet' || stop ? 'xMidYMid meet' : 'xMidYMid slice') + '"' +
      ' data-place="' + unit + '" data-variant="' + (stop ? 'stop' : 'banner') + '"' + (NIGHT ? ' data-night="1"' : '') + '>';
    var defs = (DEFS.length || stop) ? '<defs>' + DEFS.join('') + (stop ? '<clipPath id="' + clipId + '"><rect width="96" height="96" rx="22"/></clipPath>' : '') + '</defs>' : '';
    var inner = body + night;
    if (stop) inner = '<g clip-path="url(#' + clipId + ')">' + inner + '</g><rect x="1.25" y="1.25" width="93.5" height="93.5" rx="21" fill="none" stroke="' + INK + '" stroke-width="2.5"/>';
    return head + '<title id="' + tid + '">' + esc(title) + '</title>' + defs + inner + '</svg>';
  }

  global.Places = {
    svg: svg,
    name: function (unit) { return NAMES[parseInt(unit, 10)] || ''; },
    info: function (unit) {
      unit = parseInt(unit, 10);
      return NAMES[unit] ? { unit: unit, name: NAMES[unit], topic: TOPICS[unit], tag: 'place-' + unit } : null;
    },
    units: Object.keys(NAMES).map(Number).filter(function (n) { return !window.COURSE || window.COURSE.units[n]; })
  };
})(typeof window !== 'undefined' ? window : this);
