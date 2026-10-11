// Génération et données des notes
export function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const SOLFEGE = ["Do", "Do#", "Ré", "Ré#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"];

export function midiToName(midi) {
  return NAMES[midi % 12] + (Math.floor(midi / 12) - 1);
}

export function midiToSolf(midi) {
  return SOLFEGE[midi % 12] + (Math.floor(midi / 12) - 1);
}

// Clavier AZERTY : rangée du bas = touches blanches, rangée du haut = touches noires.
// 25 étiquettes couvrent Do3 → Do5 (toute la tessiture ténor en paysage).
const KEY_LABELS = [
  "Q", "Z", // Do3, Do#3
  "S", "E", // Ré3, Ré#3
  "D",      // Mi3
  "F", "T", // Fa3, Fa#3
  "G", "Y", // Sol3, Sol#3
  "H", "U", // La3, La#3
  "J",      // Si3
  "K", "O", // Do4, Do#4
  "L", "P", // Ré4, Ré#4
  "M",      // Mi4
  "W", "N", // Fa4, Fa#4
  "X", ",", // Sol4, Sol#4
  "C", ";", // La4, La#4
  "V",      // Si4
  "B",      // Do5
];

// Construit un clavier de `count` demi-tons à partir de `startMidi`
export function buildKeys(startMidi, count = 17) {
  const keys = [];
  let whiteIndex = -1;
  for (let i = 0; i < count; i++) {
    const midi = startMidi + i;
    const semitone = midi % 12;
    const isBlack =
      semitone === 1 || semitone === 3 || semitone === 6 || semitone === 8 || semitone === 10;
    if (!isBlack) whiteIndex++;
    keys.push({
      id: `n${midi}`,
      midi,
      name: midiToName(midi),
      solfege: midiToSolf(midi),
      isBlack,
      whiteBefore: whiteIndex,
      keyLabel: KEY_LABELS[i] || null,
    });
  }
  return keys;
}

export function buildKeyMap(keys) {
  const map = {};
  keys.forEach((k) => {
    if (k.keyLabel) map[k.keyLabel.toLowerCase()] = k;
  });
  return map;
}
