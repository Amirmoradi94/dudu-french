/* ============================================================
   ATELIERS — l'« Atelier d'écriture » : une petite production écrite par thème,
   corrigée par le tuteur (POST /api/atelier), à réécrire ensuite.
   const ATELIERS = { <unité>: [ tâche, … ] } — champs : voir le premier exemple.
     id (unique), kind 'message' | 'mail' | 'formulaire' | 'description' | 'post',
     title / titleEn, prompt / promptEn, minWords / maxWords, criteria [ … ],
     phrases [ {fr, en} ] (puces à insérer), model {fr, en} (caché derrière « Voir un modèle »),
     focus [ … ] (étiquettes de TEST_TOPICS[unité], tests.js)
   ============================================================ */
const ATELIERS = {
1: [
  { id: 'u1w-1', kind: 'message',
    title: "Un message pour réserver une table", titleEn: "A message to book a table",
    prompt: "Vous écrivez au Café des Amis pour réserver une table demain matin. Saluez, dites pour combien de personnes, commandez déjà un petit déjeuner et remerciez.",
    promptEn: "You write to the Café des Amis to book a table tomorrow morning. Greet them, say for how many people, order a breakfast already and say thank you.",
    minWords: 20, maxWords: 50,
    criteria: ["Saluer", "Dire pour combien de personnes", "Commander poliment (je voudrais)", "Remercier"],
    phrases: [
      {fr: "Bonjour,", en: "Hello,"},
      {fr: "Je voudrais réserver une table pour deux personnes.", en: "I would like to book a table for two people."},
      {fr: "Je voudrais un café et un croissant.", en: "I would like a coffee and a croissant."},
      {fr: "Merci beaucoup !", en: "Thank you very much!"}
    ],
    model: {fr: "Bonjour, je voudrais réserver une table pour deux personnes, demain à 9 heures. Je voudrais un thé, un café et deux croissants, s'il vous plaît. Merci beaucoup ! Nadia",
            en: "Hello, I would like to book a table for two people, tomorrow at 9 o'clock. I would like a tea, a coffee and two croissants, please. Thank you very much! Nadia"},
    focus: ["Je voudrais…", "Les articles indéfinis", "Au café"] }
]
};
