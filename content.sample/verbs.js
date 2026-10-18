/* ============================================================
   VERBES — le carnet (carnet.html) : présent ; impératif pour tu / nous / vous
   forms : je, tu, il/elle/on, nous, vous, ils/elles   (« a|b » = deux orthographes acceptées)
   hl    : indices des formes à mettre en couleur
   group : 'ind' (les indispensables) | 'er' | 'ir' | 'irr'
   ============================================================ */
const VERBS = [
 {"inf": "être", "en": "to be", "group": "ind", "unit": 1,
  "forms": ["suis", "es", "est", "sommes", "êtes", "sont"], "imp": ["sois", "soyons", "soyez"], "hl": [0, 1, 2, 3, 4, 5],
  "ex": ["Le café est ouvert.", "The café is open."], "neg": ["Le thé n'est pas cher.", "The tea isn't expensive."],
  "note": "Très irrégulier : à apprendre par cœur."},
 {"inf": "payer", "en": "to pay", "group": "er", "unit": 1,
  "forms": ["paie|paye", "paies|payes", "paie|paye", "payons", "payez", "paient|payent"], "imp": ["paie|paye", "payons", "payez"], "hl": [0, 1, 2, 5],
  "ex": ["Je paie l'addition.", "I'm paying the bill."], "neg": ["Il ne paie pas le café.", "He isn't paying for the coffee."],
  "note": "Deux orthographes acceptées devant un e muet : je paie / je paye."},
 {"inf": "commander", "en": "to order", "group": "er", "unit": 1,
  "forms": ["commande", "commandes", "commande", "commandons", "commandez", "commandent"], "imp": ["commande", "commandons", "commandez"], "hl": [3, 4],
  "ex": ["Nous commandons deux cafés.", "We are ordering two coffees."], "neg": ["Je ne commande pas de dessert.", "I'm not ordering dessert."],
  "note": "Un verbe en -er régulier : je, tu, il et ils se prononcent pareil."}
];

/* les expressions « à retenir sans conjuguer » de l'onglet Verbes : {unit, html, en, say?} */
const VERB_EXPRS = [
 {"unit": 1, "html": "« <b>Je voudrais</b> + nom » — la forme polie, au café ou au magasin.", "en": "Je voudrais + noun — the polite form, at a café or in a shop.", "say": "Je voudrais un café, s'il vous plaît."}
];
