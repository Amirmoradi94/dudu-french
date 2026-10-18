/* tests.js — les tests de fin d'unité (test.html) et leurs rubriques d'erreurs.
 *
 * TEST_TOPICS[unité] : les étiquettes qui regroupent les erreurs dans « Mes points faibles ».
 * TESTS['N'] : cinq parties, dans l'ordre : co (écoute), ce (lecture), gv (grammaire et vocabulaire),
 * pe (production écrite), po (production orale). Un audio sans `src` est lu par la voix française
 * du navigateur, réplique par réplique, à partir de sa transcription.
 * `answer` d'un trou : alternatives séparées par | ; mcq : indice de la bonne option ; tf : true/false.
 */
const TEST_TOPICS = {
  1: [
    "Je voudrais…",
    "Les articles indéfinis",
    "Les nombres de 1 à 10",
    "Au café",
    "Compréhension orale",
    "Compréhension écrite"
  ]
};

const TESTS = {
'1': {
  id: '1', title: "Test — Unité 1 · Au café", titleEn: "Unit 1 test", covers: [1], minutes: 15,
  parts: [
    { key: 'co', title: "Compréhension orale", titleEn: "Listening", points: 20,
      intro: "Vous allez entendre un petit dialogue dans un café. Écoutez-le (2 fois maximum), puis répondez.",
      introEn: "You will hear a short dialogue in a café. Listen (2 times at most), then answer.",
      audios: [
        { title: "Au café", maxPlays: 2,
          transcript: [
            {who: "Le serveur", fr: "Bonjour, monsieur. Vous désirez ?", en: "Hello, sir. What would you like?"},
            {who: "Karim", fr: "Bonjour. Je voudrais un thé, s'il vous plaît.", en: "Hello. I would like a tea, please."},
            {who: "Le serveur", fr: "Un thé. Et avec ça ?", en: "A tea. Anything else?"},
            {who: "Karim", fr: "Une tarte aux pommes. C'est combien ?", en: "An apple pie. How much is it?"},
            {who: "Le serveur", fr: "Six euros.", en: "Six euros."} ] }
      ],
      items: [
        { type: 'mcq', q: "Karim commande :", qEn: "Karim orders:", options: ["un café", "un thé", "un jus d'orange"], answer: 1,
          topic: "Compréhension orale", why: "Karim dit : « Je voudrais un thé. »" },
        { type: 'tf', q: "Karim mange une tarte.", qEn: "Karim eats a pie.", answer: true,
          topic: "Compréhension orale", why: "Il commande « une tarte aux pommes »." },
        { type: 'gap', q: "Karim paie ___ euros.", qEn: "Karim pays ___ euros.", answer: "six|6",
          topic: "Compréhension orale", why: "Le serveur dit : « Six euros. »" }
      ] },
    { key: 'ce', title: "Compréhension écrite", titleEn: "Reading", points: 20,
      text: { title: "Le Café des Amis", kind: "annonce", fr: [
        "Le Café des Amis est ouvert tous les jours, de 8 h à 18 h.",
        "Un café : 2 euros. Un thé : 3 euros. Un croissant : 1 euro.",
        "Le mercredi, un jus d'orange est offert avec un croissant !" ] },
      items: [
        { type: 'gap', q: "Un thé coûte ___ euros.", qEn: "A tea costs ___ euros.", answer: "trois|3",
          topic: "Compréhension écrite", why: "« Un thé : 3 euros. »" },
        { type: 'tf', q: "Le café est fermé le dimanche.", qEn: "The café is closed on Sundays.", answer: false,
          topic: "Compréhension écrite", why: "Il est ouvert tous les jours." },
        { type: 'mcq', q: "Le mercredi, le jus d'orange est :", qEn: "On Wednesdays, the orange juice is:",
          options: ["offert avec un croissant", "à 5 euros", "fini"], answer: 0,
          topic: "Compréhension écrite", why: "« un jus d'orange est offert avec un croissant »." }
      ] },
    { key: 'gv', title: "Grammaire et vocabulaire", titleEn: "Grammar & vocabulary", points: 20,
      items: [
        { type: 'gap', q: "Je ___ un café, s'il vous plaît.", qEn: "I would like a coffee, please.", answer: "voudrais",
          topic: "Je voudrais…", why: "La formule polie : je voudrais + un nom." },
        { type: 'gap', q: "___ limonade, s'il vous plaît.", qEn: "A lemonade, please.", answer: "une|Une",
          topic: "Les articles indéfinis", why: "Limonade est féminin : une limonade." },
        { type: 'gap', q: "___ croissants, s'il vous plaît.", qEn: "Some croissants, please.", answer: "des|Des",
          topic: "Les articles indéfinis", why: "Au pluriel : des." },
        { type: 'gap', q: "7 = ___", qEn: "7", answer: "sept",
          topic: "Les nombres de 1 à 10", why: "7 se dit sept (le p ne se prononce pas)." },
        { type: 'mcq', q: "À la fin, on demande :", qEn: "At the end, you ask for:", options: ["la carte", "l'addition", "le serveur"], answer: 1,
          topic: "Au café", why: "L'addition, c'est ce qu'on paie à la fin." }
      ] },
    { key: 'pe', title: "Production écrite", titleEn: "Writing", points: 20,
      task: { fr: "Vous êtes au café avec un ami. Écrivez le petit dialogue avec le serveur : saluez, commandez deux choses, demandez le prix et remerciez.",
              en: "You are at a café with a friend. Write the short dialogue with the waiter: greet, order two things, ask the price and say thank you.",
              minWords: 20, maxWords: 60,
              criteria: ["Saluer", "Commander poliment (je voudrais, s'il vous plaît)", "Demander le prix", "Remercier et dire au revoir"] } },
    { key: 'po', title: "Production orale", titleEn: "Speaking", points: 20,
      prompts: [
        { fr: "Vous êtes au café. Commandez une boisson.", en: "You are at a café. Order a drink.", kind: 'answer', seconds: 30 },
        { fr: "Demandez le prix et remerciez le serveur.", en: "Ask the price and thank the waiter.", kind: 'answer', seconds: 30 }
      ] }
  ]
}
};
