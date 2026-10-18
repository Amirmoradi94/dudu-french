/* ============================================================
   DICTÉES — par data-id de la page (<div class="ex dic" data-id="…">).
   phrases : les phrases lues (fr) et leur traduction (en) ; tips : une remarque par mot,
   montrée quand ce mot est mal écrit. Inclus tel quel dans le script de la page de révision.
   ============================================================ */
const DICTEES = {
 "u1dic-1": {
  "unit": 1,
  "phrases": [
   {"fr": "Bonjour, je voudrais un café.", "en": "Hello, I would like a coffee."},
   {"fr": "C'est combien, s'il vous plaît ?", "en": "How much is it, please?"},
   {"fr": "Merci, au revoir !", "en": "Thank you, goodbye!"}
  ],
  "tips": {
   "voudrais": "je voudrais : -ais à la fin",
   "combien": "combien : -ien, comme bien",
   "plaît": "plaît : un accent circonflexe sur le î",
   "revoir": "au revoir : deux mots"
  }
 }
};
