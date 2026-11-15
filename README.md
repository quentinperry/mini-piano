# Mini Piano

Un petit piano web pensé pour les choristes : chaque pupitre (soprano, alto,
ténor par défaut, basse) peut afficher sa tessiture complète et jouer les
notes en notation solfège (Do, Ré, Mi…), avec un son de piano synthétisé en Web Audio.

## Fonctionnalités

- Sélecteur de tessiture : **Soprano** (Do4–Do6), **Alto** (Sol3–Sol5), **Ténor** (Do3–Do5), **Basse** (Mi2–Mi4)
- Clavier étendu automatiquement en paysage, compact en portrait (détection automatique de l'orientation)
- Lecture de fichiers MIDI : choisir sa piste (son pupitre), mise en avant avec les autres pistes jouées plus doucement en fond (par défaut) ou piste seule, vitesse ×0,5 à ×1,5, touches illuminées en rythme, pause/reprise à la position courante et curseur de navigation dans le morceau
- Pupitre et piste en un geste : la piste de chaque pupitre est reconnue d'après son nom (S, S I, Canto, Tenore, B2…) et mise en avant quand on choisit son pupitre
- Paroles synchronisées : un fichier `<morceau>.paroles.txt` à côté du MIDI, une syllabe par note de la piste du pupitre ; défilement, texte complet (toucher une ligne pour y reprendre) et mode « de mémoire » pour réviser (voir `public/songs/README.md`). Les paroles intégrées aux MIDI sont aussi lues
- Lecture des morceaux comme un lecteur de musique : le morceau (piste mise en avant, autres pistes en fond, vitesse, timbre) est préparé en fichier audio sur l'appareil en quelques secondes, puis joué par un élément `<audio>` — il continue en arrière-plan et écran verrouillé (iOS compris), avec titre et commandes sur l'écran de verrouillage ; touches et paroles suivent la position du fichier
- L'écran reste allumé pendant la lecture d'un morceau
- Outil `outils/pdf2paroles` : extrait les paroles d'une partition PDF par pupitre et les aligne sur le MIDI (voir son README)
- Bibliothèque de morceaux intégrés : les fichiers MIDI déposés dans `public/songs/`, rangés en dossiers (compositeur, œuvre…), avec fil d'Ariane, recherche et dernier dossier retenu (voir « Ajouter des morceaux intégrés »)
- Notation solfège + équivalent international + fréquence affichée
- Son de vrai piano : échantillons du *Salamander Grand Piano* (Alexander Holm, CC BY 3.0), une note toutes les tierces mineures du La1 au Do7 (≈ 0,9 Mo, téléchargés au premier son puis disponibles hors ligne), avec une réverbération de salle discrète ; timbre « Synthé » au choix (synthèse Web Audio, rien à télécharger), utilisé aussi le temps du chargement
- Jouable à la souris, au toucher, ou au clavier **AZERTY** : rangée du bas pour les blanches (Q S D F G H J K L M W X C V B), rangée du haut pour les noires
- Réglages volume, sustain et octave
- Bouton plein écran (là où le navigateur le permet) et PWA installable : une fois ajoutée à l'écran d'accueil, l'app démarre directement en plein écran et fonctionne hors ligne
- Contournement du mode silencieux iOS, désactivation de la loupe d'appui long et du zoom double-appui

## Ajouter des morceaux intégrés

La bibliothèque de l'app liste automatiquement les fichiers `.mid` / `.midi`
du dossier `public/songs/` de la branche `main`, sous-dossiers compris — aucun
changement de code n'est nécessaire :

1. Sur GitHub, ouvrez le dossier `public/songs/` (branche `main`), puis le
   sous-dossier voulu (par ex. `Mozart/Messe en ut mineur K. 427/`).
2. « Add file » → « Upload files », déposez vos `.mid`, validez le commit.
3. Le morceau apparaît dans la bibliothèque en une à deux minutes, le temps
   de la mise en ligne automatique du site (qui refait aussi l'index de la
   bibliothèque : l'app n'interroge pas l'API GitHub).

Le nom du fichier sert de titre (« 04 Qui tollis.mid » s'affichera « 04 Qui
tollis ») ; un numéro en tête fixe l'ordre. Le rangement en dossiers et les
paroles sont détaillés dans [`public/songs/README.md`](public/songs/README.md).
Un morceau écouté une fois est mis en cache par le service worker et reste
disponible hors ligne.

## Lancer en local

```bash
npm install
npm run dev
```

Puis ouvrez l'URL affichée (http://localhost:5173).

## Déploiement automatique

Toute poussée sur la branche `main` déclenche GitHub Actions : le site est
compilé (Vite) puis publié sur la branche `gh-pages`, qui sert
https://quentinperry.github.io/mini-piano/ — une à deux minutes. Modifier un
fichier de `src/` directement sur github.com suffit : le déploiement suit
automatiquement. La branche `gh-pages` est un artefact généré, ne pas
l'éditer à la main.

## Installer la PWA

Sur Android (Chrome) : ouvrez le site puis « Ajouter à l'écran d'accueil ».
L'app se lance en plein écran, avec sa propre icône. Sur iPhone (Safari) :
partage puis « Sur l'écran d'accueil » (lancement en mode autonome).

## Structure

```text
src/PianoApp.jsx  Logique principale : tessitures, clavier AZERTY, réglages
src/Piano.jsx     Rendu des touches (blanches / noires)
src/audio.js      Synthèse Web Audio (partiels, enveloppe, mode silencieux iOS)
src/notes.js      Notes, solfège, fréquences, mappage clavier
src/midi.js       Analyse et lecture de fichiers MIDI (pause, reprise, navigation)
src/songs.js      Morceaux intégrés : découverte de la liste, chargement
src/styles.css    Style visuel
public/           Manifeste PWA, icône, service worker, morceaux (public/songs/)
public/songs/    Fichiers .mid proposés dans le menu « Morceaux intégrés »
```

Aucune dépendance externe au-delà de React : tout le son est généré
côté navigateur avec l'API Web Audio.