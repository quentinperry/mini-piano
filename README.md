# Mini Piano

Un petit piano web pensé pour les choristes : chaque pupitre (soprano, alto,
ténor — par défaut —, basse) peut afficher sa tessiture complète et jouer les
notes en notation solfège (Do, Ré, Mi…), avec un son de piano synthétisé en Web Audio.

## Fonctionnalités

- Sélecteur de tessiture : **Soprano** (Do4–Do6), **Alto** (Sol3–Sol5), **Ténor** (Do3–Do5), **Basse** (Mi2–Mi4)
- Clavier étendu automatiquement en paysage (ou forçable via Auto / Étendu / Compact)
- Notation solfège + équivalent international + fréquence affichée
- Synthèse de type piano : partiels harmoniques, attaque percussive, décrément naturel (les graves résonnent plus longtemps)
- Jouable à la souris, au toucher, ou au clavier **AZERTY** : rangée du bas pour les blanches (Q S D F G H J K L M W X C V B), rangée du haut pour les noires
- Réglages volume, sustain et octave
- Style inspiré de l'Académie du Palais royal : bleu nuit, ivoire et or champagne

## Lancer en local

```bash
npm install
npm run dev
```

Puis ouvrez l'URL affichée (http://localhost:5173).

## Structure

```text
src/PianoApp.jsx  Logique principale : tessitures, clavier AZERTY, réglages
src/Piano.jsx     Rendu des touches (blanches / noires)
src/audio.js      Synthèse Web Audio (partiels, enveloppe)
src/notes.js      Notes, solfège, fréquences, mappage clavier
src/styles.css    Style visuel
```

Aucune dépendance externe au-delà de React : tout le son est généré
côté navigateur avec l'API Web Audio.