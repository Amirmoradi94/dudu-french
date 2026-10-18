/* TRACKS — un tableau de pistes audio (tables .tracktable de la page) : TRACKS[unité] = [[piste, page, "titre"], …],
   et TRACK_SRC(piste) donne l'adresse du mp3. L'unité d'exemple n'en a pas. */
const TRACKS={};
const TRACK_SRC=n=>`audio/${String(n).padStart(2,'0')}.mp3`;
