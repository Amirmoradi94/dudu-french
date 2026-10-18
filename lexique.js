/* ============================================================
   LEXIQUE FRANÇAIS → ANGLAIS — le moteur. Les listes elles-mêmes vivent
   dans content/lexique.js (GLOSS_SOURCES : des blocs « mot = traduction »,
   une ligne par entrée), chargé juste avant ce fichier.
   ============================================================ */
const GLOSS = {};
const gkey = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase()
  .replace(/[’`]/g,"'").replace(/[.,;:!?…]/g,'').replace(/\s+/g,' ').trim();
/* LEXIQUE : la même liste, mais en gardant le français tel qu'écrit (accents,
   majuscules) — GLOSS ne garde que la clé normalisée, illisible telle quelle.
   Utilisé par Mémoire (les cartes) ; lookupGloss() continue à n'utiliser que GLOSS. */
const LEXIQUE = [];
GLOSS_SOURCES.forEach(src=>{
  src.trim().split('\n').forEach(line=>{
    const i = line.indexOf('=');
    if(i < 1) return;
    const fr = line.slice(0,i).trim();
    const k = gkey(fr);
    const v = line.slice(i+1).trim();
    if(!k || !v || GLOSS[k]) return;   // déjà vu ailleurs : on garde la première occurrence
    GLOSS[k] = v;
    LEXIQUE.push({fr, en:v});
  });
});
