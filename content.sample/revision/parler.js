/* ============================================================
   PARLER — les données des exercices oraux (onglet « Parler »).
   Ce fichier est inclus TEL QUEL dans le script de la page de révision (ligne
   « @include content/revision/parler.js ») : il doit déclarer SLOTS, TILE_EN, SPK et CONV.

   SLOTS   les « emplacements personnels » : ce que l'élève dit de lui-même.
           kind open = n'importe quel mot (jusqu'à max mots), plus les suggestions
                num  = un nombre, en chiffres ou en lettres
                art  = une suggestion, ou un article de « arts » + un mot inconnu
                list = seulement les suggestions
   TILE_EN le sens de chaque tuile fixe (ce qui manque est cherché dans le lexique).
   SPK     les exercices, par data-spk de la page. Une tuile = un texte fixe, ou {s:<emplacement>}.
           t: répondre (q, tiles, model) · flip:1 poser la question · rep:1 écouter et répéter ·
           tr:1 dire en français · dlg:1 mini-dialogue (turns:[…], {nom} = ce que l'élève a dit).
           orders = les ordres acceptés (indices des tuiles) ; trap = la tuile piège (replaces = l'indice remplacé).
   CONV    les conversations avec le tuteur, par data-conv : role (consigne secrète du tuteur),
           setting / settingEn, goals [{fr, en}], opener / openerEn.
   ============================================================ */
const SLOTS = {
  name:  {kind:'open', max:2, cap:true, label:"ton prénom"},
  drink: {kind:'art', arts:["un","une"], label:"une boisson", title:"Les boissons",
          items:[["un café","a coffee"],["un thé","a tea"],["un jus d'orange","an orange juice"],["une limonade","a lemonade"],["un verre d'eau","a glass of water"]]},
  num:   {kind:'num', label:"un nombre"}
};

const TILE_EN = {
  "je":"I", "voudrais":"would like (vouloir)", "s'il":"if it (→ s'il vous plaît = please)", "vous":"you (polite)",
  "plaît":"pleases (→ s'il vous plaît = please)", "c'est":"it is", "combien":"how much", "merci":"thank you",
  "au":"to the", "revoir":"see again (→ au revoir = goodbye)", "bonjour":"hello", "euros":"euros", "un":"a, one (masc.)", "une":"a, one (fem.)"
};

const SPK = {
'u1-t1': {q:"Bonjour ! Vous désirez ?", en:"Hello! What would you like?",
  tiles:["je","voudrais",{s:'drink'},"s'il","vous","plaît"], model:"Je voudrais un café, s'il vous plaît.",
  trap:{t:"veux", replaces:1, why:"Au café, on dit <b>je voudrais</b> : c'est plus poli que <em>je veux</em>.",
        whyEn:"At a café say je voudrais: more polite than je veux."}},
'u1-t2': {q:"Ça fait combien ?", en:"How much is it?",
  tiles:["ça","fait",{s:'num'},"euros"], model:"Ça fait trois euros."},
'u1-f1': {flip:1, q:"Trois euros cinquante.", en:"Three euros fifty.",
  tiles:["c'est","combien"], model:"C'est combien ?"},
'u1-r1': {rep:1, en:"I would like a tea, please.", model:"Je voudrais un thé, s'il vous plaît."},
'u1-r2': {rep:1, en:"Thank you, goodbye!", model:"Merci, au revoir !"},
'u1-x1': {tr:1, en:"The bill, please.", tiles:["l'addition","s'il","vous","plaît"], model:"L'addition, s'il vous plaît."},
'u1-dlg': {dlg:1, title:"Au comptoir", intro:"Vous êtes au comptoir d'un café. Le serveur vous pose deux questions — répondez à chacune.",
  introEn:"You're at the counter of a café. The waiter asks you two questions — answer each one.",
  turns:[
    {q:"Bonjour ! Qu'est-ce que vous voulez ?", en:"Hello! What do you want?",
     tiles:["je","voudrais",{s:'drink'}], model:"Je voudrais un thé.", reply:"{drink}, très bien !"},
    {q:"Et avec ça ?", en:"Anything else?",
     tiles:["c'est","tout","merci"], model:"C'est tout, merci.", reply:"Merci, bonne journée ! 👋"}
  ]}
};

const CONV = {
'u1-cv1': {unit:1, title:"Au Café des Amis", titleEn:"At the Café des Amis",
  role:"Tu es Hugo, le serveur du Café des Amis. Tu vouvoies l'élève et tu évites tout accord masculin / féminin à son sujet. Tu prends sa commande : une boisson, puis quelque chose à manger, puis tu dis le prix. Phrases très courtes, niveau A1 débutant.",
  setting:"Vous êtes assis·e au Café des Amis. Le serveur, Hugo, arrive à votre table. Il vous vouvoie.",
  settingEn:"You're sitting at the Café des Amis. The waiter, Hugo, comes to your table. He uses vous with you.",
  goals:[{fr:"Saluer le serveur", en:"Greet the waiter"},
         {fr:"Commander une boisson", en:"Order a drink"},
         {fr:"Commander quelque chose à manger", en:"Order something to eat"},
         {fr:"Demander le prix", en:"Ask the price"}],
  opener:"Bonjour ! Qu'est-ce que je vous sers ?", openerEn:"Hello! What can I get you?"}
};
