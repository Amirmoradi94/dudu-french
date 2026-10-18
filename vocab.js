/* vocab.js — le moteur des paquets de mots. La liste VOCAB vit dans content/vocab.js, chargé juste avant. */

/* Les « paquets » d'une unité : ses mots du livre, dans l'ordre du livre, coupés en K parts à peu près égales
   (chaque part = un arrêt « Mots » du chemin dans app.html, et Mémoire ?u=N&pack=i&of=K). Clés = gkey de Mémoire.
   Les mots ajoutés à la main (memPerso) n'entrent pas ici : ils rejoignent le dernier paquet, sans décaler les autres. */
function vocabPacks(unit, K) {
  const key = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[’`]/g, "'").replace(/[.,;:!?…]/g, '').replace(/\s+/g, ' ').trim();
  const seen = new Set(), words = [];
  VOCAB.forEach(w => {
    if (String(w.u) !== String(unit)) return;
    const k = key(w.fr);
    if (!seen.has(k)) { seen.add(k); words.push(k); }
  });
  K = Math.max(1, Math.min(K | 0, words.length));
  const out = [];
  for (let i = 0; i < K && words.length; i++) out.push(words.slice(Math.round(i * words.length / K), Math.round((i + 1) * words.length / K)));
  return out;
}
