/*!
 * sfx.js v2 — « La Troupe » sounds for DuDu.
 *
 * Every moment has ONE small, consistent sound; the characters speak on outcomes only (right, wrong, streak
 * milestone, lesson done, unit unlocked, test passed / failed, welcome), never on every tap.
 *
 *   recorded fx  : /voices/v2/fx-<name>.mp3
 *   recorded voices : /voices/v2/<char>-<L>-<slug>.mp3   (char lea|dubois|mamie, L = B | C)
 * Whatever is missing / not decoded yet falls back to a short synthesised UI sound (fx) or to silence (voice).
 * Nothing here ever throws. Everything is embedded below (slug → French text, groups); no manifest is fetched.
 *
 * API (window.Sfx)
 *   Sfx.play(name, {char, quiet, n})
 *       name  tap | select | pop | whoosh | flip | xp | cheer      (fx only)
 *             correct | wrong | streak | complete | perfect | unlock | pass | fail | mascot | hello   (fx + a voice line)
 *             'correct' = fx-correct + a line; on the 3rd / 5th / 10th correct in a row fx-streak + fx-cheer + s3 / s5 / s10;
 *             from the 2nd in a row a quiet fx-cheer sits under the line.  'wrong' resets the streak.
 *             'complete' / 'perfect' / 'pass' end with a short exchange: a second character answers with a c-* line.
 *       char  'lea' | 'dubois' | 'mamie' ('jo' accepted) — who speaks (default Léa).
 *       quiet true → fx only, no voice, no cheer (repeated micro-checks).   n (name 'streak') the milestone: 3 | 5 | 10.
 *       near true (name 'wrong') → a gentle « Presque ! / Courage ! » line (right but for a detail); the streak is kept.
 *   Sfx.muted / setMuted(bool) / toggle()   persists to store.sfxMuted. Mute silences effects + character voices ONLY.
 *   Sfx.setVoice(char, 'B'|'C')  persists to store.voicePicks[char] (a stored legacy 'A' reads as 'B'); previews « Coucou ! ».
 *   Sfx.voicePicks               copy of {lea, dubois, mamie} letters.
 *   Sfx.streak                   current number of correct answers in a row.   Sfx.resetStreak()
 *   Sfx.test()                   demo sequence (tap, correct, wrong, streak, complete). Promise → Sfx.debug() at the end.
 *   Sfx.debug()                  {state, muted, letters, buffersLoaded, fxLoaded, linesLoaded, lastError, …}
 *
 * Event: window 'dudu:speak' { detail:{ char, duration, text, slug, kind, spoken, streak } } for every voice line
 * decided — also while muted (spoken:false), so pages can still show the speech bubble. kind: correct | wrong | streak |
 * done | perfect | unlock | pass | fail | hello | mascot | exchange.  Fired synchronously inside Sfx.play (first line).
 *
 * State lives in the SYNCED store (localStorage 'dudu-a1-u1'): store.sfxMuted (bool), store.voicePicks ({lea:'B'|'C', …}).
 * Writes re-read the store right before saving and then call DuduSync.schedulePush(store) when sync.js is present.
 *
 * The audio context is created on the first user gesture; the sounds are fetched (throttled queue) once it is running,
 * not at page load; a muted user downloads nothing. A voice that is not decoded yet when it is wanted plays as soon as
 * it decodes if that is within ~400 ms, otherwise it is skipped (the fx has already played). iOS hardening: see the
 * comment above « Audio engine ».
 */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   * Config
   * ------------------------------------------------------------------ */

  var STORE_KEY = 'dudu-a1-u1';
  var THROTTLE_MS = 60;        // same name inside this window is dropped
  var COMBO_IDLE_MS = 20000;   // correct-streak resets after this much silence
  var COMBO_CAP = 5;           // synth fallback: streak steps (+2 semitones each) before the pitch stops rising
  var MASTER_GAIN = 0.35 * 1.4; // synth master
  var BUS_GAIN = 0.9;          // sample playback level into the compressor (own bus, not the synth master)
  var FADE_S = 0.04;           // fade-out when a voice / fx is cut by the next one
  var RETRY_MS = 15000;        // a file that 404'd is tried again after this long, if wanted again
  var LATE_MS = 400;           // a voice that decodes later than this after the answer is skipped
  var LOAD_CONC = 4;           // preload: files in flight
  var EX_GAP_S = 0.14;         // pause between the lines of an exchange

  var VOICE_DIR = '/voices/v2/';
  var CAST = ['lea', 'dubois', 'mamie'];
  var MAIN = 'lea';
  var CHAR_ALIAS = { jo: 'mamie' };     // the SVG cast marks Mamie Jo as data-char="jo"
  var LETTERS = ['B', 'C'];
  var DEFAULT_LETTER = 'B';

  // Gains (the voices stay clearly on top).
  var G_VOICE = 1, G_FX = 0.55, G_FX_SOFT = 0.35, G_CHEER = 0.5, G_CHEER_UNDER = 0.35;

  /* slug → what the line says (the exact words of the recordings) */
  var TEXT = {
    parfait: 'Parfait !', bravo: 'Bravo !', youpi: 'Youpi !', genial: 'Génial !', tropfort: 'Trop fort !', cestca: 'C’est ça !',
    bienjoue: 'Bien joué !', super: 'Super !', excellent: 'Excellent !', exact: 'Exactement !', magnifique: 'Magnifique !',
    impeccable: 'Impeccable !', waouh: 'Waouh !', ouais: 'Ouais, bravo !',
    'c-tropbien': 'Trop bien !', 'c-yes': 'Yes ! C’est ça !', 'c-facile': 'Trop facile pour toi !',
    'c-baguette': 'Parfait, comme une baguette bien cuite !', 'c-chapeau': 'Chapeau !', 'c-chef': 'Du travail de chef !',
    'c-chou': 'Oh, mon petit chou, bravo !', 'c-fiere': 'Je suis fière de toi !', 'c-bijou': 'Un vrai bijou !',
    oups: 'Oups !', presque: 'Presque !', pastout: 'Pas tout à fait…', pasgrave: 'Ce n’est pas grave !', reessaie: 'On réessaie ?',
    regarde: 'Regarde bien la réponse.', courage: 'Courage !',
    s3: 'Trois d’affilée !', s5: 'Cinq d’affilée, incroyable !', s10: 'Dix de suite ! Tu es en feu !',
    done: 'Leçon terminée, bravo !', perfect: 'Zéro faute ! C’est parfait !', unlock: 'Nouvelle unité débloquée !',
    pass: 'Test réussi ! Félicitations !', fail: 'Pas cette fois… On révise et on recommence !',
    coucou: 'Coucou !', continue: 'On continue ?', revoila: 'Te revoilà !',
    't-onyva': 'On y va !', 't-baguette': 'Une petite baguette ?', 't-the': 'Un petit thé, mon chou ?'
  };

  var G = {
    correct: ['parfait', 'bravo', 'youpi', 'genial', 'tropfort', 'cestca', 'bienjoue', 'super', 'excellent', 'exact', 'magnifique', 'impeccable', 'waouh', 'ouais'],
    correctOwn: {
      lea: ['c-tropbien', 'c-yes', 'c-facile'],
      dubois: ['c-baguette', 'c-chapeau', 'c-chef'],
      mamie: ['c-chou', 'c-fiere', 'c-bijou']
    },
    wrong: ['oups', 'presque', 'pastout', 'pasgrave', 'reessaie', 'regarde', 'courage'],
    near: ['presque', 'pasgrave', 'courage'],          // opts.near: right but for a detail (spelling...)
    streak: { 3: 's3', 5: 's5', 10: 's10' },
    done: 'done', perfect: 'perfect', unlock: 'unlock', pass: 'pass', fail: 'fail',
    hello: ['coucou', 'revoila'],
    mascot: ['coucou', 'continue', 'revoila'],
    tapOwn: { lea: ['t-onyva'], dubois: ['t-baguette'], mamie: ['t-the'] }
  };
  var FX_NAMES = ['correct', 'wrong', 'tap', 'select', 'pop', 'whoosh', 'flip', 'streak', 'xp', 'unlock', 'complete', 'perfect', 'cheer', 'fail'];
  // Preload order: the sounds of the first answers first.
  var TIER1 = ['parfait', 'bravo', 'super', 'youpi', 'oups', 'presque', 'coucou'];
  var TIER2 = ['genial', 'tropfort', 'cestca', 'bienjoue', 'excellent', 'exact', 'courage', 'pasgrave', 'done', 'perfect'];

  function allSlugs(ch) {
    var a = [].concat(G.correct, G.wrong, ['s3', 's5', 's10', 'done', 'perfect', 'unlock', 'pass', 'fail', 'coucou', 'continue', 'revoila'],
      G.correctOwn[ch] || [], G.tapOwn[ch] || []);
    // wrong/correct lists are already in; the slugs of the groups above cover the whole recorded set
    return a.filter(function (s, i) { return a.indexOf(s) === i; });
  }

  function readStore() {
    try {
      var o = JSON.parse(window.localStorage.getItem(STORE_KEY) || '{}');
      if (o && typeof o === 'object' && !Array.isArray(o)) return o;
    } catch (e) { /* ignore */ }
    return {};
  }
  // Re-read, let `mutate` change it, save, then hand it to sync.js. Returns true when saved.
  function writeStore(mutate) {
    try {
      var st = readStore();
      mutate(st);
      window.localStorage.setItem(STORE_KEY, JSON.stringify(st));
      try { if (window.DuduSync && typeof window.DuduSync.schedulePush === 'function') window.DuduSync.schedulePush(st); } catch (e) { /* ignore */ }
      return true;
    } catch (e) { return false; }
  }

  function normLetter(v) {
    v = String(v == null ? '' : v).toUpperCase();
    return LETTERS.indexOf(v) >= 0 ? v : DEFAULT_LETTER;   // a legacy 'A' (or anything else) is voice B
  }
  function normChar(c) {
    c = String(c == null ? '' : c).toLowerCase();
    c = CHAR_ALIAS[c] || c;
    return CAST.indexOf(c) >= 0 ? c : '';
  }
  function readPicks() {
    var p = readStore().voicePicks;
    return p && typeof p === 'object' && !Array.isArray(p) ? p : {};
  }

  var muted = readStore().sfxMuted === true;
  var picks = readPicks();
  function letterFor(ch) { return normLetter(picks[ch]); }

  /* ------------------------------------------------------------------ *
   * Audio engine
   * ------------------------------------------------------------------ */

  var ac = null;           // AudioContext (created on a user gesture, never before)
  var master = null;       // synth master gain -> compressor -> destination
  var bus = null;          // sample (voice + fx) gain -> same compressor
  var audioBroken = false; // Web Audio missing or constructor threw

  /*
   * iOS / Safari hardening (all defensive, all in try/catch):
   *
   *  - Silent switch: iOS mutes Web Audio while the ringer switch is on silent, but not media elements (book audio
   *    plays, effects did not). navigator.audioSession.type = 'playback' (Audio Session API, Safari 16.4+ / iOS 17)
   *    makes effects behave like media playback, so they play with the switch on silent. The app's own mute button is
   *    the user's control; while effects are muted we do not touch the session at all (and hand it back to 'auto').
   *    Side effect, same as book audio: starting a sound can pause other apps' music.
   *  - Only touchend / click / keydown count as an audio activation on iOS (not pointerdown / touchstart), so the
   *    context is created, resumed and "unlocked" (1-sample silent buffer) synchronously inside those events, and
   *    nothing creates it before the first one (a context created at load can stay unusable on some iOS versions).
   *  - After a call / Siri / backgrounding iOS leaves the context 'suspended' or 'interrupted': any state other than
   *    'running' is resumed on the next gesture and when the page becomes visible again. If a gesture-time resume did
   *    not take, the next gesture closes the context and builds a fresh one inside that gesture. The same happens (at
   *    most twice) when the context sample rate is not 44100/48000 (Bluetooth route changes can leave a mismatch).
   *  - Switching to another app and back: iOS can hand the context back 'running' yet silent (speech synthesis, a
   *    separate path, still talks). So when the page is hidden we suspend the context and give the audio session back
   *    ('auto'); the first gesture after coming back builds a fresh context and sets 'playback' again (asleep, below).
   *  - Voices are fetched/decoded only once the context is running (old Safari may not decode into a suspended one).
   *  Sfx.debug() reports the state, for Safari's Web Inspector.
   */
  var gestured = false;      // a real user gesture has been seen (set even while muted, so unmuting can start audio)
  var unlocked = false;      // ac.state === 'running' was observed, after a gesture, for the current context
  var sessionSet = false;    // we put navigator.audioSession into 'playback'
  var recording = false;     // a page is using the microphone: the session must stay 'play-and-record' (see Sfx.recording)
  var gestureResumes = 0;    // gesture-time resume() attempts on the current context that have not yet worked
  var lastGestureResumeAt = 0;
  var silentAt = -1e9;       // when the silent unlock buffer last played
  var resets = 0;            // contexts closed and rebuilt
  var rateResets = 0;        // ... of which because of the sample rate
  var rebuiltAt = -1e9;      // when the context was last rebuilt (touchend + click of one tap must not rebuild twice)
  var asleep = false;        // the page was hidden (other app, lock screen): the next gesture rebuilds the context
  var setAt = -1e9;          // when the preload was last kicked from markRunning
  var RESUME_GRACE_MS = 700; // a gesture-time resume gets this long before we call it failed
  var DECODE_TIMEOUT_MS = 10000;

  function rateOk(c) { var r = c && c.sampleRate; return r === 44100 || r === 48000; }

  function sessionType() {
    try { return navigator.audioSession ? String(navigator.audioSession.type) : 'unsupported'; } catch (e) { return 'unsupported'; }
  }
  function setSession() {
    try {
      if (muted || !gestured || !navigator.audioSession || recording) return;
      if (navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback';
      sessionSet = true;
    } catch (e) { /* ignore */ }
  }
  /* Microphone: with the session in 'playback', iOS refuses to record (getUserMedia → InvalidStateError, speech
     recognition fails too). Pages call Sfx.recording(true) just before using the mic and Sfx.recording(false) after;
     meanwhile the session is 'play-and-record' (effects still play), then it goes back to 'playback' as before. */
  function setRecording(on) {
    recording = !!on;
    try {
      if (!navigator.audioSession) return;
      if (recording) navigator.audioSession.type = 'play-and-record';
      else if (!muted && gestured) { navigator.audioSession.type = 'playback'; sessionSet = true; }
      else navigator.audioSession.type = 'auto';
    } catch (e) { /* ignore */ }
  }
  function releaseSession() {   // effects muted: give the session back (only if we changed it)
    try {
      if (sessionSet && navigator.audioSession) navigator.audioSession.type = 'auto';
    } catch (e) { /* ignore */ }
    sessionSet = false;
  }

  function createCtx() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { audioBroken = true; return null; }
      var c = new AC();
      ac = c;
      master = c.createGain();
      master.gain.value = MASTER_GAIN;
      var comp = c.createDynamicsCompressor();
      comp.threshold.value = -20;
      comp.knee.value = 24;
      comp.ratio.value = 6;
      comp.attack.value = 0.003;
      comp.release.value = 0.2;
      master.connect(comp);
      bus = c.createGain();
      bus.gain.value = BUS_GAIN;
      bus.connect(comp);
      comp.connect(c.destination);
      try { c.onstatechange = function () { if (c === ac && c.state === 'running') markRunning(); }; } catch (e) { /* ignore */ }
    } catch (e) {
      ac = null; master = null; bus = null; audioBroken = true;
      return null;
    }
    unlocked = false; gestureResumes = 0;
    return ac;
  }

  // The context, creating it only after a user gesture. Voices load later, once it is running (markRunning).
  function ensureCtx() {
    if (ac) return ac;
    if (audioBroken || !gestured) return null;
    return createCtx();
  }

  function recreateCtx(why) {
    var old = ac;
    try { stopAll(); } catch (e) { /* ignore */ }
    ac = null; master = null; bus = null;
    cache = {}; active = {}; unlocked = false; gestureResumes = 0; setAt = -1e9;   // a fresh context re-fetches its sounds
    try { resetQueue(); } catch (e) { /* ignore */ }
    resets++; rebuiltAt = now();
    if (why === 'rate') rateResets++;
    try { if (old && old.close) { var p = old.close(); if (p && p.catch) p.catch(function () {}); } } catch (e) { /* ignore */ }
    return createCtx();
  }

  // The context was seen running (after a gesture): unlocked; now it is safe to fetch + decode the voices.
  function markRunning() {
    try {
      if (!ac || ac.state !== 'running' || !gestured) return;
      unlocked = true; gestureResumes = 0;
      if (now() - setAt > 30000) { setAt = now(); loadSet(); }   // no-op while muted; not on every tap (a 404'd set is not hammered)
    } catch (e) { /* ignore */ }
  }

  // The classic iOS unlock: a 1-sample silent buffer through the context, inside the gesture.
  function playSilent() {
    try {
      if (!ac || now() - silentAt < 500) return;
      silentAt = now();
      var src = ac.createBufferSource();
      src.buffer = ac.createBuffer(1, 1, 22050);
      src.connect(ac.destination);
      if (src.start) src.start(0); else if (src.noteOn) src.noteOn(0);
    } catch (e) { /* ignore */ }
  }

  function resumeCtx(inGesture) {
    try {
      if (ac && ac.state !== 'running') {
        setSession();
        if (inGesture) { gestureResumes++; lastGestureResumeAt = now(); }
        var c = ac, p = c.resume();
        if (p && p.then) p.then(function () { if (c === ac) markRunning(); }, function () {});
      }
    } catch (e) { /* ignore */ }
  }

  // Runs synchronously inside a user gesture (touchend / click / keydown, or an unmute click).
  function activate() {
    try {
      if (muted || !gestured) return;
      setSession();                                   // before creating / resuming the context
      if (!ac) {
        createCtx();
      } else if (asleep && !recording) {
        recreateCtx('wake');                          // back from another app: a fresh context, inside this gesture
      } else if (now() - rebuiltAt > RESUME_GRACE_MS) {
        if (!rateOk(ac) && rateResets < 2) {
          recreateCtx('rate');
        } else if (ac.state !== 'running' && gestureResumes >= 1 && now() - lastGestureResumeAt > RESUME_GRACE_MS) {
          // a gesture-time resume already had its chance and the context is still not running: start over
          recreateCtx('stuck');
        }
      }
      asleep = false;
      if (!ac) return;
      if (!unlocked) playSilent();
      if (ac.state !== 'running') resumeCtx(true);
      else markRunning();
    } catch (e) { /* ignore */ }
  }

  // iOS only treats touchend / click (and keydown) as audio activation; pointerdown only for a mouse (desktop).
  function onGesture(e) {
    try {
      if (e && e.type === 'pointerdown' && e.pointerType !== 'mouse') return;
      gestured = true;
      activate();
    } catch (err) { /* ignore */ }
  }
  ['pointerdown', 'touchend', 'keydown', 'click'].forEach(function (type) {
    document.addEventListener(type, onGesture, { capture: true, passive: true });
  });

  // Back from the background / lock screen / a call: try to resume (iOS usually wants a gesture, which then retries).
  function wake() {
    try {
      if (!muted && !document.hidden && ac && ac.state !== 'running') resumeCtx(false);
    } catch (e) { /* ignore */ }
  }
  window.addEventListener('pageshow', wake);
  window.addEventListener('focus', wake);

  /* ---- synthesis primitives ---------------------------------------- */

  function m2f(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  // Gain envelope: silence -> vol (linear attack) -> optional hold -> exponential release to `dur`.
  function envelope(g, t, vol, a, hold, dur) {
    var p = g.gain;
    hold = Math.min(hold || 0, Math.max(0, dur - a - 0.01));
    p.setValueAtTime(0.0001, t);
    p.linearRampToValueAtTime(vol, t + a);
    if (hold > 0) p.setValueAtTime(vol, t + a + hold);
    p.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  /**
   * One oscillator voice.
   *  t start, f freq, dur length, vol peak, type wave, a attack, hold sustain
   *  to + sweep : exponential glide to `to` over `sweep` seconds (default dur)
   *  det        : detune in cents
   *  lp         : lowpass cutoff
   *  vib        : [rateHz, depthHz] vibrato
   */
  function tone(o) {
    var t = o.t, dur = o.dur || 0.2;
    var s = ac.createOscillator();
    s.type = o.type || 'sine';
    s.frequency.setValueAtTime(o.f, t);
    if (o.to) s.frequency.exponentialRampToValueAtTime(o.to, t + (o.sweep || dur));
    if (o.det) s.detune.value = o.det;

    var g = ac.createGain();
    envelope(g, t, o.vol || 0.2, o.a || 0.004, o.hold, dur);

    if (o.lp) {
      var lp = ac.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.value = o.q || 0.7;
      lp.frequency.setValueAtTime(o.lp, t);
      s.connect(lp); lp.connect(g);
    } else {
      s.connect(g);
    }
    g.connect(master);

    if (o.vib) {
      var l = ac.createOscillator(), lg = ac.createGain();
      l.frequency.value = o.vib[0];
      lg.gain.value = o.vib[1];
      l.connect(lg); lg.connect(s.frequency);
      l.start(t); l.stop(t + dur + 0.05);
    }
    s.start(t);
    s.stop(t + dur + 0.05);
  }

  var noiseCache = null;
  function noiseBuffer() {
    if (noiseCache && noiseCache.c === ac) return noiseCache.b;
    var len = Math.floor(ac.sampleRate), b = ac.createBuffer(1, len, ac.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    noiseCache = { c: ac, b: b };
    return b;
  }
  // Band-passed noise with a swell: t start, dur, vol, from/to (centre frequency sweep, Hz), q
  function noise(o) {
    var s = ac.createBufferSource();
    s.buffer = noiseBuffer(); s.loop = true;
    var f = ac.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = o.q || 0.8;
    f.frequency.setValueAtTime(o.from, o.t);
    f.frequency.exponentialRampToValueAtTime(o.to, o.t + o.dur);
    var g = ac.createGain();
    envelope(g, o.t, o.vol, o.a || 0.03, o.hold || 0, o.dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(o.t); s.stop(o.t + o.dur + 0.05);
  }

  /* ------------------------------------------------------------------ *
   * Synth fallbacks: short, crisp, modern UI sounds (bright sines / triangles, soft clicks).
   * Each is fn(t, k): t = start time, k = pitch multiplier (only != 1 for 'correct', from the streak).
   * They play only while the recorded fx of the same name is missing / not decoded yet.
   * ------------------------------------------------------------------ */

  function chime(t, f, dur, vol) {      // a glassy bell: fundamental + soft octave + a hint of 3rd partial
    tone({ t: t, f: f, type: 'sine', vol: vol, dur: dur, a: 0.004 });
    tone({ t: t, f: f * 2, type: 'sine', vol: vol * 0.22, dur: dur * 0.55, a: 0.004 });
    tone({ t: t, f: f * 3.01, type: 'sine', vol: vol * 0.07, dur: dur * 0.3, a: 0.004 });
  }
  var PAL = {
    tap:    function (t) { tone({ t: t, f: 1500, to: 900, sweep: 0.03, type: 'sine', vol: 0.14, dur: 0.05, a: 0.002 }); },
    select: function (t) { tone({ t: t, f: 760, to: 1250, sweep: 0.05, type: 'sine', vol: 0.15, dur: 0.09, a: 0.003 }); },
    pop:    function (t) { tone({ t: t, f: 420, to: 1050, sweep: 0.07, type: 'sine', vol: 0.2, dur: 0.11, a: 0.003 }); },
    whoosh: function (t) { noise({ t: t, dur: 0.28, vol: 0.16, from: 500, to: 3600, q: 0.9, a: 0.08 }); },
    flip:   function (t) {
      tone({ t: t, f: 700, type: 'triangle', vol: 0.12, dur: 0.035, a: 0.002 });
      tone({ t: t + 0.05, f: 1050, type: 'triangle', vol: 0.12, dur: 0.04, a: 0.002 });
    },
    correct: function (t, k) {            // two rising bell notes (C6, E6), brighter in a streak
      chime(t, 1047 * k, 0.34, 0.2);
      chime(t + 0.09, 1319 * k, 0.46, 0.2);
    },
    wrong: function (t) {                 // soft, low and short: a gentle « bonk », never harsh
      tone({ t: t, f: 392, to: 294, sweep: 0.18, type: 'sine', vol: 0.24, dur: 0.3, a: 0.006, lp: 1400 });
      tone({ t: t, f: 196, to: 147, sweep: 0.2, type: 'triangle', vol: 0.1, dur: 0.3, a: 0.006, lp: 900 });
    },
    streak: function (t) {                // quick rising arpeggio
      [1047, 1319, 1568, 2093].forEach(function (f, i) { chime(t + i * 0.06, f, 0.38, 0.17); });
    },
    xp: function (t) {
      [1760, 2093, 2489].forEach(function (f, i) { tone({ t: t + i * 0.05, f: f, type: 'sine', vol: 0.1, dur: 0.06, a: 0.002 }); });
    },
    unlock: function (t) {
      [784, 988, 1175, 1568].forEach(function (f, i) { chime(t + i * 0.07, f, 0.34, 0.15); });
      chime(t + 0.34, 2093, 0.7, 0.07);
    },
    complete: function (t) {              // C major fanfare ending on a held chord
      [523, 659, 784].forEach(function (f, i) { chime(t + i * 0.12, f, 0.4, 0.16); });
      [1047, 1319, 1568].forEach(function (f) { chime(t + 0.38, f, 0.8, 0.11); });
    },
    perfect: function (t) {
      PAL.complete(t);
      [2093, 2637, 3136].forEach(function (f, i) { chime(t + 0.5 + i * 0.07, f, 0.5, 0.06); });
    },
    cheer: function (t) {                 // a soft swell of applause + two sparkles
      noise({ t: t, dur: 0.9, vol: 0.09, from: 1400, to: 3400, q: 0.6, a: 0.25 });
      chime(t + 0.12, 2349, 0.3, 0.05);
      chime(t + 0.3, 2794, 0.3, 0.045);
    },
    fail: function (t) {                  // gentle descent, kind, not scolding
      [440, 392, 330].forEach(function (f, i) {
        tone({ t: t + i * 0.16, f: f, type: 'sine', vol: 0.2, dur: i === 2 ? 0.5 : 0.24, a: 0.01, lp: 1500 });
      });
    }
  };

  /* name → { fx, g (fx gain), voice (which line), delay (voice after fx, s), ex (end with an exchange) } */
  var SPEC = {
    tap:      { fx: 'tap',      g: G_FX_SOFT },
    select:   { fx: 'select',   g: G_FX_SOFT },
    pop:      { fx: 'pop',      g: 0.4 },
    whoosh:   { fx: 'whoosh',   g: 0.3 },
    flip:     { fx: 'flip',     g: 0.45 },
    xp:       { fx: 'xp',       g: 0.4 },
    cheer:    { fx: 'cheer',    g: 0.45 },
    correct:  { fx: 'correct',  g: G_FX,  voice: 'correct',  delay: 0.12 },
    wrong:    { fx: 'wrong',    g: G_FX,  voice: 'wrong',    delay: 0.10 },
    streak:   { fx: 'streak',   g: 0.6,   voice: 'streak',   delay: 0.15 },
    complete: { fx: 'complete', g: G_FX,  voice: 'done',     delay: 0.25, ex: true },
    perfect:  { fx: 'perfect',  g: G_FX,  voice: 'perfect',  delay: 0.25, ex: true },
    unlock:   { fx: 'unlock',   g: G_FX,  voice: 'unlock',   delay: 0.20 },
    pass:     { fx: 'complete', g: G_FX,  voice: 'pass',     delay: 0.25, ex: true },
    fail:     { fx: 'fail',     g: G_FX,  voice: 'fail',     delay: 0.20 },
    mascot:   { fx: 'pop',      g: 0.4,   voice: 'mascot',   delay: 0.08 },
    hello:    { fx: 'pop',      g: 0.35,  voice: 'hello',    delay: 0.10 }
  };

  /* ------------------------------------------------------------------ *
   * Recorded fx + voices: buffer cache, throttled preload, sample playback
   * ------------------------------------------------------------------ */

  var lastPlayed = {};   // name -> performance.now()
  var combo = 0;         // consecutive corrects
  var comboAt = 0;       // when the last correct happened
  var voiceTok = 0;      // bumped for every voice line: a late decode of an older line must not speak
  var lastError = '';

  function now() {
    return (window.performance && performance.now) ? performance.now() : Date.now();
  }

  function voiceUrl(ch, slug) { return VOICE_DIR + ch + '-' + letterFor(ch) + '-' + slug + '.mp3'; }
  function fxUrl(name) { return VOICE_DIR + 'fx-' + name + '.mp3'; }

  // url -> { st: 'loading' | 'ok' | 'missing', buf, p (promise, always resolves), at }
  var cache = {};

  function decode(c, ab) {
    return new Promise(function (resolve, reject) {
      var done = false, tm = setTimeout(function () { if (!done) { done = true; reject(new Error('decode timeout')); } }, DECODE_TIMEOUT_MS);
      function ok(b) { if (!done) { done = true; clearTimeout(tm); resolve(b); } }
      function ko(e) { if (!done) { done = true; clearTimeout(tm); reject(e || new Error('decode failed')); } }
      var pr = c.decodeAudioData(ab, ok, ko);   // callback form: works on old Safari too
      if (pr && pr.catch) pr.catch(function () {});
    });
  }

  function loadUrl(url) {
    var e = cache[url];
    if (e && !(e.st === 'missing' && now() - e.at > RETRY_MS)) return e.p;
    e = cache[url] = { st: 'loading', buf: null, at: now(), p: null };
    var entry = e, ctx = ac;   // decode into the context that was current when the fetch started
    e.p = Promise.resolve().then(function () {
      if (!ctx || typeof fetch !== 'function') throw new Error('no audio');
      return fetch(url, { credentials: 'same-origin' });
    }).then(function (r) {
      if (!r || !r.ok) throw new Error('http ' + (r && r.status));
      return r.arrayBuffer();
    }).then(function (ab) { return decode(ctx, ab); }).then(function (buf) {
      entry.buf = buf; entry.st = 'ok';
    }).catch(function (err) {
      entry.st = 'missing'; entry.at = now();
      lastError = url + ' : ' + (err && err.message ? err.message : String(err));
    }).then(function () { return entry; });
    return e.p;
  }

  // Decoded buffer for a url, or null (and starts / retries the fetch when needed).
  function want(url) {
    var e = cache[url];
    if (e && e.st === 'ok') return e.buf;
    loadUrl(url);
    return null;
  }

  function lineState(ch, slug) {
    var e = cache[voiceUrl(ch, slug)];
    return e ? e.st : 'new';
  }
  function decoded(ch, slug) { return lineState(ch, slug) === 'ok'; }

  /* ---- preload: a small queue, a few files in flight ---------------------- */

  var queue = [], queued = {}, inflight = 0;
  function resetQueue() { queue = []; queued = {}; inflight = 0; }
  function pump() {
    while (inflight < LOAD_CONC && queue.length) {
      var u = queue.shift();
      delete queued[u];
      inflight++;
      loadUrl(u).then(finishOne, finishOne);
    }
  }
  function finishOne() { inflight = Math.max(0, inflight - 1); pump(); }
  function enqueue(urls) {
    urls.forEach(function (u) {
      var e = cache[u];
      if (queued[u] || (e && !(e.st === 'missing' && now() - e.at > RETRY_MS))) return;
      queued[u] = true; queue.push(u);
    });
    pump();
  }

  // Everything the cast needs for the current letters (skipped while muted / no running audio context).
  function loadSet() {
    try {
      if (!ac || muted || ac.state !== 'running') return;   // decode only into a running context (old Safari)
      var list = [];
      FX_NAMES.forEach(function (n) { list.push(fxUrl(n)); });
      var rest = [];
      CAST.forEach(function (ch) {
        TIER1.forEach(function (s) { list.push(voiceUrl(ch, s)); });
      });
      CAST.forEach(function (ch) {
        TIER2.forEach(function (s) { list.push(voiceUrl(ch, s)); });
      });
      CAST.forEach(function (ch) {
        allSlugs(ch).forEach(function (s) { if (TIER1.indexOf(s) < 0 && TIER2.indexOf(s) < 0) rest.push(voiceUrl(ch, s)); });
      });
      enqueue(list.concat(rest));
    } catch (e) { /* ignore */ }
  }

  /* ---- sample playback ------------------------------------------------- */

  var active = {};   // kind ('voice', 'voice:x2', 'fx:correct', ...) -> { src, g }
  var exTimers = [], exEndAt = 0;

  function fadeStop(h) {
    try {
      var t = ac.currentTime;
      h.g.gain.cancelScheduledValues(t);
      h.g.gain.setValueAtTime(h.g.gain.value, t);
      h.g.gain.linearRampToValueAtTime(0, t + FADE_S);
      h.src.stop(t + FADE_S + 0.01);
    } catch (e) { /* already stopped */ }
  }
  function clearExTimers() { exTimers.forEach(function (t) { clearTimeout(t); }); exTimers = []; }
  function stopAll() {
    clearExTimers();
    Object.keys(active).forEach(function (k) { if (active[k]) fadeStop(active[k]); active[k] = null; });
  }
  // A scheduled exchange (second line already on the audio clock) is cancelled by anything that speaks.
  function cancelExchange() {
    clearExTimers();
    if (active['voice:x2']) { fadeStop(active['voice:x2']); active['voice:x2'] = null; }
  }

  // Play a decoded buffer at `when` through the sample bus; a new sample of the same kind cuts the old one.
  function playBuf(buf, when, gain, kind) {
    var src = ac.createBufferSource(), g = ac.createGain();
    src.buffer = buf;
    g.gain.value = gain;
    src.connect(g); g.connect(bus);
    var h = { src: src, g: g };
    if (active[kind]) fadeStop(active[kind]);
    active[kind] = h;
    src.onended = function () {
      if (active[kind] === h) active[kind] = null;
      try { g.disconnect(); } catch (e) { /* ignore */ }
    };
    src.start(when);
  }

  // A recorded fx, else its synthesised stand-in.
  function playFx(name, when, gain, k) {
    var b = want(fxUrl(name));
    if (b) playBuf(b, when, gain, 'fx:' + name);
    else if (PAL[name]) PAL[name](when, k || 1);
  }

  // Start a voice line. Returns its duration when the buffer is already decoded; 0 when it is still loading
  // (it then plays on arrival if that is within LATE_MS of `startedAt`) or missing (silence).
  function voiceAt(ch, slug, when, kind, tok, startedAt) {
    var url = voiceUrl(ch, slug), e = cache[url];
    if (e && e.st === 'ok' && e.buf) { playBuf(e.buf, when, G_VOICE, kind); return e.buf.duration; }
    if (e && e.st === 'missing' && now() - e.at <= RETRY_MS) return 0;
    loadUrl(url).then(function (en) {
      try {
        if (tok !== voiceTok || muted || document.hidden || !ac || !en || en.st !== 'ok' || !en.buf) return;
        if (now() - startedAt > LATE_MS) return;
        playBuf(en.buf, ac.currentTime + 0.01, G_VOICE, kind);
      } catch (err) { /* ignore */ }
    });
    return 0;
  }

  // Tell the page a character speaks (it shows the bubble, animates the character for `duration` seconds).
  function emitSpeak(d) {
    try { window.dispatchEvent(new CustomEvent('dudu:speak', { detail: d })); } catch (e) { /* ignore */ }
  }
  function estDur(text) { return Math.max(0.8, (text || '').length * 0.06 + 0.3); }
  function speakDetail(ch, slug, kind, spoken) {
    var e = cache[voiceUrl(ch, slug)], text = TEXT[slug] || '';
    return { char: ch, duration: e && e.buf ? e.buf.duration : estDur(text), text: text, slug: slug, kind: kind, spoken: !!spoken, streak: combo };
  }

  /* ---- shuffle-bags: go through every line before any repeats --------- */

  var bags = {};        // key -> slugs still to come
  var lastDrawn = {};   // key -> slug drawn last
  var exN = 0;          // exchange counter (who answers)

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)), t = a[i];
      a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  // Next slug from the bag `key`, never the one before. Only lines whose file is not known to be missing; the decoded
  // ones are preferred (a line that is still loading would play late or not at all). decodedOnly: nothing else.
  function draw(key, ch, slugs, decodedOnly) {
    var cand = slugs.filter(function (s) { return lineState(ch, s) !== 'missing'; });
    var dec = cand.filter(function (s) { return decoded(ch, s); });
    var ok = decodedOnly ? dec : (dec.length ? dec : (cand.length ? cand : slugs));   // every file missing: still give the words (the page shows the bubble)
    if (!ok.length) return null;
    var bad = lastDrawn[key];
    function find(bag) {
      for (var i = bag.length - 1; i >= 0; i--) if (bag[i] !== bad) return i;
      return -1;
    }
    var bag = (bags[key] || []).filter(function (s) { return ok.indexOf(s) >= 0; });
    var at = find(bag);
    if (at < 0) { bag = shuffle(ok.slice()); at = find(bag); }
    if (at < 0) at = bag.length - 1;   // a single line: nothing else to choose
    var s = bag.splice(at, 1)[0];
    bags[key] = bag;
    lastDrawn[key] = s;
    return s;
  }

  /* ---- the end-of-lesson exchange ------------------------------------- */

  var EX_PREF = { lea: ['mamie', 'dubois'], mamie: ['dubois', 'lea'], dubois: ['mamie', 'lea'] };
  // A second character answers with one of its own c-* lines, right after the first line ends (decoded lines only).
  function exchange(ch, afterAt) {
    try {
      var pref = EX_PREF[ch] || EX_PREF.lea, who = pref[exN++ % 2];
      var slug = draw('x:' + who, who, G.correctOwn[who] || [], true);
      if (!slug) { who = pref[exN++ % 2]; slug = draw('x:' + who, who, G.correctOwn[who] || [], true); }
      if (!slug) return;
      var buf = cache[voiceUrl(who, slug)].buf, when = afterAt + EX_GAP_S, wait = Math.max(0, (when - ac.currentTime) * 1000);
      playBuf(buf, when, G_VOICE, 'voice:x2');
      exEndAt = now() + wait + buf.duration * 1000;
      var d = speakDetail(who, slug, 'exchange', true); d.streak = 0;
      exTimers.push(setTimeout(function () { emitSpeak(d); }, wait));
    } catch (e) { /* ignore */ }
  }

  /* ------------------------------------------------------------------ *
   * Sfx
   * ------------------------------------------------------------------ */

  function pickChar(opts) {
    return normChar(opts && typeof opts.char === 'string' ? opts.char : '') || MAIN;
  }
  function isMilestone(c) { return c === 3 || c === 5 || (c >= 10 && c % 10 === 0); }
  function milestoneSlug(c) { return G.streak[c >= 10 ? 10 : c] || G.streak[3]; }

  // Which line answers this sound (a slug, or null).
  function lineFor(name, ch, opts) {
    switch (name) {
      case 'wrong':    return opts && opts.near ? draw('wn:' + ch, ch, G.near) : draw('w:' + ch, ch, G.wrong);
      case 'complete': return G.done;
      case 'perfect':  return G.perfect;
      case 'unlock':   return G.unlock;
      case 'pass':     return G.pass;
      case 'fail':     return G.fail;
      case 'hello':    return draw('h:' + ch, ch, G.hello);
      case 'mascot':   return draw('m:' + ch, ch, G.mascot.concat(G.tapOwn[ch] || []));
      case 'streak':   return milestoneSlug(opts && +opts.n > 0 ? +opts.n : 3);
    }
    return null;
  }

  function play(name, opts) {
    try {
      if (typeof name !== 'string' || !Object.prototype.hasOwnProperty.call(SPEC, name)) return;
      opts = opts || {};
      var spec = SPEC[name], quiet = opts.quiet === true;
      if (name === 'wrong' && !opts.near) combo = 0;       // a near miss (a typo) neither adds to the streak nor breaks it
      if (document.hidden) return;

      var n = now();
      if (lastPlayed[name] !== undefined && n - lastPlayed[name] < THROTTLE_MS) return;
      lastPlayed[name] = n;

      var ch = pickChar(opts), fx = [[spec.fx, spec.g]], slug = null, kind = name, k = 1;
      if (name === 'correct') {
        if (n - comboAt > COMBO_IDLE_MS) combo = 0;
        combo++; comboAt = n;
        k = Math.pow(2, (Math.min(combo - 1, COMBO_CAP) * 2) / 12);   // synth fallback only
        if (!quiet) {
          if (isMilestone(combo)) {
            fx = [['streak', 0.6], ['cheer', G_CHEER]];
            slug = milestoneSlug(combo); kind = 'streak';
          } else {
            if (combo >= 2) fx.push(['cheer', G_CHEER_UNDER]);
            slug = draw('c:' + ch, ch, G.correct.concat(G.correctOwn[ch] || []));
          }
        }
      } else if (!quiet && spec.voice) {
        slug = lineFor(name, ch, opts);
        if (name === 'streak') fx.push(['cheer', G_CHEER]);
      }
      var streakNow = combo;
      if (name === 'complete' || name === 'perfect' || name === 'pass' || name === 'fail') combo = 0;

      var can = !muted && !!ensureCtx();
      if (slug) {   // the page shows the words, with the sound on or off
        var d = speakDetail(ch, slug, kind, can && lineState(ch, slug) !== 'missing');
        d.streak = streakNow;
        emitSpeak(d);
      }
      if (!can) return;

      var fire = function () {
        var tok = voiceTok;
        if (slug) { cancelExchange(); tok = ++voiceTok; }
        var t0 = ac.currentTime + 0.015;
        fx.forEach(function (f) { playFx(f[0], t0, f[1], k); });
        if (slug) {
          var vwhen = t0 + spec.delay, dur = voiceAt(ch, slug, vwhen, 'voice', tok, n);
          if (spec.ex && dur) exchange(ch, vwhen + dur);
        }
      };
      if (ac.state === 'running') { fire(); return; }
      // iOS suspends / interrupts the context after the mic was used (recording an answer): the verdict arrives
      // with no gesture, and a sound scheduled on a frozen clock was silently lost. Wake it, and play as soon as
      // it runs (give up after 1.2 s: a sound that late would only be confusing).
      var waited = ac, started = now(), fired = false;
      var go = function () {
        if (fired || ac !== waited || ac.state !== 'running' || muted || document.hidden || now() - started > 1200) return;
        fired = true;
        try { fire(); } catch (e) { /* ignore */ }
      };
      resumeCtx(false);
      try { var pr = waited.resume(); if (pr && pr.then) pr.then(go, function () {}); } catch (e) { /* ignore */ }
      setTimeout(go, 350);
    } catch (e) { /* sound must never break the page */ }
  }

  /* ---- voice letter (B / C) ------------------------------------------- */

  var previewTok = 0;
  // After switching a voice, say that character's « Coucou ! » in the new voice.
  function previewVoice(ch) {
    try {
      if (muted || document.hidden || !ensureCtx()) return;
      resumeCtx(false);
      var tok = ++previewTok, url = voiceUrl(ch, 'coucou');
      loadUrl(url).then(function (e) {
        try {
          if (tok !== previewTok || muted || document.hidden || !ac) return;
          cancelExchange(); voiceTok++;
          if (e.st === 'ok' && e.buf) { playBuf(e.buf, ac.currentTime + 0.015, G_VOICE, 'voice'); emitSpeak(speakDetail(ch, 'coucou', 'hello', true)); }
          else PAL.pop(ac.currentTime + 0.015, 1);
        } catch (err) { /* ignore */ }
      });
    } catch (e) { /* ignore */ }
  }

  function setVoice(char, letter) {
    try {
      var ch = normChar(char);
      if (!ch) return;
      var L = normLetter(letter);
      writeStore(function (st) {
        var p = st.voicePicks && typeof st.voicePicks === 'object' && !Array.isArray(st.voicePicks) ? st.voicePicks : {};
        p[ch] = L;
        st.voicePicks = p;
      });
      picks = readPicks();
      stopAll();
      loadSet();
      previewVoice(ch);
    } catch (e) { /* ignore */ }
  }

  function setMuted(v) {
    try {
      v = !!v;
      var changed = v !== muted;
      muted = v;
      if (changed) writeStore(function (st) { st.sfxMuted = muted; });
      if (muted) { stopAll(); releaseSession(); }
      else { activate(); loadSet(); }   // unmute (a click): wake the engine and fetch the sounds (if not yet)
    } catch (e) { /* ignore */ }
  }

  /* ---- « Tester les sons » ---------------------------------------------- */

  var testing = null;
  // A short demo: tap, a right answer (Léa), a wrong one, a streak (M. Dubois), the end of a lesson with its exchange.
  // Call it from a tap. Resolves with Sfx.debug() when the demo is over (at once when muted / no audio).
  function test() {
    if (testing) return testing;
    testing = new Promise(function (resolve) {
      var fin = function () { combo = 0; comboAt = 0; testing = null; resolve(debug()); };
      try {
        if (muted || !gestured || !ensureCtx()) { fin(); return; }
        resumeCtx(false);
        // fetch the demo's own sounds first (they are in the preload anyway), but never wait long
        var urls = FX_NAMES.map(fxUrl);
        ['lea', 'dubois'].forEach(function (c) { ['parfait', 'bravo', 'super', 'oups', 'presque', 's3', 'done'].forEach(function (s) { urls.push(voiceUrl(c, s)); }); });
        urls.forEach(function (u) { loadUrl(u); });
        var all = Promise.all(urls.map(function (u) { return cache[u] ? cache[u].p : null; }));
        var wait = Promise.race([all, new Promise(function (r) { setTimeout(r, 2500); })]);
        wait.then(function () {
          combo = 0; comboAt = 0;
          var seq = [
            [0,    function () { play('tap'); }],
            [550,  function () { play('correct', { char: 'lea' }); }],
            [2100, function () { play('wrong', { char: 'lea' }); }],
            [3700, function () { play('streak', { char: 'dubois', n: 3 }); }],
            [5700, function () { play('complete', { char: 'lea' }); }]
          ];
          seq.forEach(function (s) { setTimeout(function () { try { s[1](); } catch (e) { /* ignore */ } }, s[0]); });
          setTimeout(function () {                       // the exchange's end is known once `complete` has been scheduled
            var rest = exEndAt > now() ? exEndAt - now() : 0;
            setTimeout(fin, Math.min(5000, rest + 300) + 1200);
          }, 5800);
        });
      } catch (e) { fin(); }
    });
    return testing;
  }

  // For Safari's Web Inspector (iPhone via Mac): Sfx.debug()
  function debug() {
    var fxN = 0, lineN = 0;
    try {
      Object.keys(cache).forEach(function (u) {
        if (cache[u].st !== 'ok') return;
        if (u.indexOf(VOICE_DIR + 'fx-') === 0) fxN++; else lineN++;
      });
    } catch (e) { /* ignore */ }
    return {
      state: ac ? ac.state : 'none', sampleRate: ac ? ac.sampleRate : 0, sessionType: sessionType(),
      unlocked: unlocked, asleep: asleep, muted: muted, letters: { lea: letterFor('lea'), dubois: letterFor('dubois'), mamie: letterFor('mamie') },
      buffersLoaded: fxN + lineN, fxLoaded: fxN, linesLoaded: lineN, queued: queue.length, inflight: inflight,
      lastError: lastError, gestured: gestured, resets: resets, streak: combo
    };
  }

  window.Sfx = {
    version: 2,
    play: play,
    get muted() { return muted; },
    setMuted: setMuted,
    toggle: function () { setMuted(!muted); return muted; },
    setVoice: setVoice,
    recording: setRecording,
    rearm: function () { try { if (!muted && gestured && ac && ac.state !== 'running') { resumeCtx(false); setTimeout(wake, 400); } } catch (e) { /* ignore */ } },
    get voicePicks() { return { lea: letterFor('lea'), dubois: letterFor('dubois'), mamie: letterFor('mamie') }; },
    get streak() { return now() - comboAt > COMBO_IDLE_MS ? 0 : combo; },
    get nextIsMilestone() { return isMilestone((now() - comboAt > COMBO_IDLE_MS ? 0 : combo) + 1); },
    resetStreak: function () { combo = 0; comboAt = 0; },
    text: function (slug) { return TEXT[slug] || ''; },
    test: test,
    debug: debug
  };

  // Keep several open tabs (and a sync pull) in step.
  window.addEventListener('storage', function (e) {
    try {
      if (e.key !== STORE_KEY && e.key !== null) return;
      var st = readStore();
      var wasMuted = muted;
      muted = st.sfxMuted === true;
      picks = readPicks();
      if (muted) { if (!wasMuted) { stopAll(); releaseSession(); } }
      else loadSet();
    } catch (err) { /* ignore */ }
  });

  /* Hidden (other app, lock screen, app switcher): stop, suspend, and hand the audio session back, so that coming back
     starts from a clean state — activate() then rebuilds the context on the first gesture (see « Switching » above).
     Not while a page records (the mic owns the session). */
  function sleep() {
    try {
      stopAll();
      if (recording) return;
      asleep = true;
      if (ac && ac.state === 'running' && ac.suspend) { var p = ac.suspend(); if (p && p.catch) p.catch(function () {}); }
      releaseSession();
    } catch (e) { /* ignore */ }
  }
  document.addEventListener('visibilitychange', function () {
    try { if (document.hidden) sleep(); else wake(); } catch (e) { /* ignore */ }
  });
  window.addEventListener('pagehide', sleep);
})();
