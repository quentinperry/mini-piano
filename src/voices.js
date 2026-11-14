// Détection du pupitre d'une piste MIDI d'après son nom.
// Les fichiers de chorale nomment leurs pistes de mille façons : « S »,
// « S I », « SII », « S 1 », « So », « Soprano », « Canto », « Tenore »,
// « Basso », « B2 »… On reconnaît ces formes, en préférant le premier chœur
// (I, 1 ou sans numéro) et en écartant les solistes et les instruments
// (« Soprano Solo », « Bassi », « Alto Sax »).

export function normalizeName(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Formes courtes ou complètes qui, seules (avec un éventuel numéro de
// chœur), désignent le pupitre.
const NAMES = {
  soprano: ["s", "so", "sop", "soprano", "sopran", "soprani", "sopranos", "canto", "cantus", "dessus"],
  alto: ["a", "al", "alt", "alto", "alti", "altos", "altus", "contralto"],
  tenor: ["t", "te", "ten", "tenor", "tenore", "tenori", "tenors", "taille"],
  basse: ["b", "ba", "bas", "basse", "basses", "basso", "bass", "bassus", "baryton", "baritone"],
};

// Mots qui, au milieu d'un nom plus long, suffisent à reconnaître le pupitre.
const KEYWORDS = {
  soprano: ["soprano", "sopran", "soprani", "sopranos", "canto"],
  alto: ["alto", "alti", "altos", "contralto"],
  tenor: ["tenor", "tenore", "tenori", "tenors"],
  basse: ["basse", "basses", "basso", "bass", "bassus"],
};

const CHOIR_WORDS = new Set(["choir", "chorus", "coro", "choeur", "chor", "voix", "voice"]);
const INSTRUMENT_WORDS = new Set([
  "sax", "saxophone", "flute", "flauto", "recorder", "clarinet", "clarinette",
  "trombone", "horn", "cor", "viol", "viola", "gamba", "guitar", "guitare",
  "ukulele", "oboe", "hautbois", "piano", "organ", "orgue", "string", "strings",
]);

// Numéro de chœur : I, II, III ou 1, 2, 3 (0 si absent).
function choirNumber(token) {
  if (!token) return 0;
  if (/^\d$/.test(token)) return Number(token);
  if (/^i{1,3}$/.test(token)) return token.length;
  return -1;
}

// Score de correspondance entre un nom et un pupitre (0 = aucune).
export function voiceScore(name, voiceId) {
  const n = normalizeName(name);
  if (!n) return 0;
  let tokens = n.split(" ");
  if (tokens.some((t) => INSTRUMENT_WORDS.has(t))) return 0;
  tokens = tokens.filter((t) => !CHOIR_WORDS.has(t));
  if (!tokens.length) return 0;

  // Forme courte collée à son numéro : « SI », « AII », « T1 », « B2 ».
  let [first, ...rest] = tokens;
  const glued = first.match(/^([a-z]{1,2}?)(i{1,3}|\d)$/);
  if (glued && NAMES[voiceId].includes(glued[1])) {
    first = glued[1];
    rest = [glued[2], ...rest];
  }

  if (NAMES[voiceId].includes(first)) {
    if (rest.length === 0) return 10;
    if (rest.length === 1) {
      const num = choirNumber(rest[0]);
      if (num >= 0) return num <= 1 ? 10 : 10 - num + 1;
    }
  }
  if (tokens.some((t) => KEYWORDS[voiceId].includes(t))) {
    return tokens.includes("solo") ? 2 : 5;
  }
  return 0;
}

// Numéro de chœur porté par un nom de pupitre (« S II » → 2, « T1 » → 1,
// « Alto » → 0). Sert à distinguer les deux chœurs d'une œuvre à double chœur.
export function choirOf(name) {
  const tokens = normalizeName(name).split(" ").filter((t) => t && !CHOIR_WORDS.has(t));
  if (!tokens.length) return 0;
  const glued = tokens[0].match(/^([a-z]{1,2}?)(i{1,3}|\d)$/);
  if (glued && VOICE_IDS.some((v) => NAMES[v].includes(glued[1]))) return choirNumber(glued[2]);
  if (tokens.length === 2) return Math.max(0, choirNumber(tokens[1]));
  return 0;
}

export const VOICE_IDS = ["soprano", "alto", "tenor", "basse"];

// Pupitre le plus probable pour un nom de piste, ou null.
export function detectVoice(name) {
  let best = null;
  let bestScore = 0;
  for (const id of VOICE_IDS) {
    const s = voiceScore(name, id);
    if (s > bestScore) {
      best = id;
      bestScore = s;
    }
  }
  return best;
}

// Index de la piste qui correspond le mieux à un pupitre, ou -1.
export function findVoiceTrack(tracks, voiceId) {
  let best = -1;
  let bestScore = 0;
  tracks.forEach((t, i) => {
    const s = voiceScore(t.name, voiceId);
    if (s > bestScore) {
      best = i;
      bestScore = s;
    }
  });
  return best;
}
