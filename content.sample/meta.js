/* ============================================================
   COURSE — la fiche du cours, lue par toutes les pages (window.COURSE).
   C'est ici qu'on dit combien il y a d'unités, comment elles s'appellent
   et ce qu'elles couvrent. Le moteur n'a aucun titre d'unité en dur.
   (Jusqu'à 5 unités : une illustration de lieu et une couleur par unité, voir places.js.)

   name         le nom du cours
   next         le titre de l'unité suivante, annoncée « Bientôt » sur l'accueil (facultatif)
   units[N]     n, titre, pages, pistes (deux petites mentions affichées dans le menu des unités),
                obj (une phrase), dossier (le dossier des images de l'unité, s'il y en a)
   goals[N]     les objectifs courts affichés sur l'accueil (/app)
   topics[N]    les thèmes affichés sur la page Écoute
   shortLabels  un ou deux mots à côté de chaque arrêt du chemin (clé = titre d'étape en minuscules)
   revisionSub / revisionTitle / revisionFoot : textes de la page de révision (en-tête, onglet, pied de page)
   ============================================================ */
window.COURSE = {
  name: "Cours d'exemple",
  next: "À la boulangerie",
  revisionSub: u => `Cours d'exemple · cours + révision · ${u.pages}`,
  revisionTitle: (n, u) => `Unité ${n} · ${u.titre} (cours + révision)`,
  revisionFoot: (n, u) => `Unité ${n} · ${u.titre} — contenu d'exemple, écrit pour ce dépôt.`,
  units: {
    1: {n: 1, titre: "Au café", pages: "unité d'exemple", pistes: "sans audio",
        obj: "Saluer, commander poliment, demander le prix.", dossier: ""}
  },
  goals: {
    1: ['saluer', 'je voudrais…', 'un, une, des', 'les nombres de 1 à 10', 'les sons [u] et [y]']
  },
  topics: {
    1: ['au café', 'commander', 'les prix']
  },
  shortLabels: {
    "au café des amis": "Au café",
    "je voudrais… : demander poliment": "Je voudrais",
    "les articles indéfinis un, une, des": "Un, une, des",
    "les nombres de 1 à 10": "Nombres 1–10",
    "les sons [u] et [y] : vous et tu": "[u] / [y]"
  }
};
