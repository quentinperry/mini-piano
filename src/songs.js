// Morceaux intégrés : le dossier « public/songs/ » du dépôt héberge les
// fichiers, éventuellement rangés en sous-dossiers. Celui qui gère le
// répertoire y dépose simplement des .mid via l'interface GitHub — aucun
// réglage côté code : la mise en ligne automatique (1 à 2 min) publie les
// fichiers avec le site, et le service worker les garde pour le hors-ligne.

// Index de la bibliothèque : fabriqué à chaque mise en ligne du site (voir
// vite.config.js), il liste tous les fichiers de « public/songs/ »,
// sous-dossiers compris. Pas d'appel à l'API GitHub : aucune limite de
// requêtes, même quand tout un chœur ouvre l'app sur le même Wi-Fi.
const BASE = (import.meta.env && import.meta.env.BASE_URL) || "/";
const SONGS_INDEX_URL = `${BASE}songs/index.json`;
const SONGS_BASE = `${BASE}songs/`;
const SONGS_CACHE_KEY = "mini-piano-songs-v5";

// Chemin relatif (« Mozart/Messe/01 Kyrie.mid ») -> adresse sur le site,
// chaque segment encodé (espaces, accents).
function songUrl(path) {
  return SONGS_BASE + path.split("/").map(encodeURIComponent).join("/");
}

// Libellé lisible à partir du nom de fichier : « 01kyrie.mid » s'affichera
// « 01 Kyrie », « 04 Qui tollis.mid » « 04 Qui tollis ». Celui qui dépose les fichiers garde la main : espaces,
// accents et tirets dans le nom sont respectés tels quels.
function titleFromFileName(name) {
  return name
    .replace(/\.(mid|midi)$/i, "")
    .replace(/_+/g, " ")
    .replace(/(\d)(?=[A-Za-z\u00c0-\u017f])/g, "$1 ")
    .trim()
    // majuscule au premier mot seulement : « Hymne à la nuit », pas « Hymne À La Nuit »
    .replace(/^(\d*\s*)(\p{Ll})/u, (m, num, c) => num + c.toUpperCase());
}

function readSongsCache() {
  try {
    const raw = JSON.parse(localStorage.getItem(SONGS_CACHE_KEY));
    if (raw && Array.isArray(raw.list)) return raw.list;
  } catch (err) {
    /* stockage indisponible (mode privé, quota) : sans conséquence */
  }
  return null;
}

// Liste des morceaux en « stale-while-revalidate » : la dernière liste
// connue (stockée localement) est servie immédiatement via onUpdate, sans
// attendre le réseau, puis la liste est rafraîchie en arrière-plan depuis
// l'index du site et renvoyée via onUpdate si elle a changé. En cas d'échec
// réseau (hors ligne), on retombe sur la liste connue.
export async function listBuiltInSongs(onUpdate) {
  const cached = readSongsCache();
  if (cached && typeof onUpdate === "function") onUpdate(cached);
  try {
    const res = await fetch(SONGS_INDEX_URL, { cache: "no-cache" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    const files = new Set(data.files || []);
    const midiLyrics = new Set(data.midiLyrics || []);
    // Paroles : fichier texte de même nom dans le même dossier,
    // « 01kyrie.paroles.txt » (ou « 01kyrie.txt »).
    const lyricsFor = (path) => {
      const base = path.replace(/\.midi?$/i, "");
      return [base + ".paroles.txt", base + ".txt"].find((f) => files.has(f)) || null;
    };
    const list = [...files]
      .filter((path) => /\.midi?$/i.test(path))
      .map((path) => {
        const parts = path.split("/");
        const file = parts.pop();
        const lyricsFile = lyricsFor(path);
        return {
          name: path,
          title: titleFromFileName(file),
          folder: parts,
          lyricsFile,
          hasLyrics: Boolean(lyricsFile) || midiLyrics.has(path),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "fr", { numeric: true }));
    try {
      localStorage.setItem(SONGS_CACHE_KEY, JSON.stringify({ at: Date.now(), list }));
    } catch (err) {
      /* stockage indisponible (mode privé, quota) : sans conséquence */
    }
    if (typeof onUpdate === "function") onUpdate(list);
    return list;
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
}

// Charge le fichier MIDI d'un morceau intégré (chemin relatif à public/songs/).
export async function fetchBuiltInSong(fileName) {
  // « no-cache » : un morceau remplacé dans le dépôt est relu tout de suite
  // (sinon le cache HTTP peut servir l'ancienne version quelques minutes).
  const res = await fetch(songUrl(fileName), { cache: "no-cache" });
  if (!res.ok) {
    throw new Error("Impossible de charger ce morceau (" + res.status + ").");
  }
  return res.arrayBuffer();
}

// Charge les paroles d'un morceau intégré (texte UTF-8), ou null si absentes.
export async function fetchBuiltInLyrics(lyricsFile) {
  if (!lyricsFile) return null;
  try {
    const res = await fetch(songUrl(lyricsFile));
    if (!res.ok) return null;
    return await res.text();
  } catch (err) {
    return null; // hors ligne et jamais chargées : le morceau reste jouable
  }
}
