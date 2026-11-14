// Morceaux intégrés : le dossier « public/songs/ » de la branche `main` du
// dépôt GitHub héberge les fichiers, éventuellement rangés en sous-dossiers.
// Celui qui gère le répertoire y dépose simplement des .mid via l'interface
// GitHub — aucun réglage côté code. L'app
// découvre la liste via l'API GitHub (dépôt public), puis charge le morceau
// choisi depuis raw.githubusercontent.com : les fichiers sont servis dès
// l'upload, sans attendre le déploiement Pages, et le service worker les met
// en cache après une première écoute pour un usage hors ligne.

// Arborescence complète du dépôt en un seul appel : les morceaux peuvent être
// rangés dans des sous-dossiers de « public/songs/ » (compositeur, œuvre…),
// sur autant de niveaux que voulu, sans multiplier les requêtes à l'API.
const SONGS_TREE_URL =
  "https://api.github.com/repos/quentinperry/mini-piano/git/trees/main?recursive=1";
const SONGS_PREFIX = "public/songs/";
const SONGS_RAW_BASE =
  "https://raw.githubusercontent.com/quentinperry/mini-piano/main/public/songs/";
const SONGS_CACHE_KEY = "mini-piano-songs-v3";

// Chemin relatif (« Mozart/Messe/01kyrie.mid ») -> adresse brute, chaque
// segment encodé (espaces, accents).
function rawUrl(path) {
  return SONGS_RAW_BASE + path.split("/").map(encodeURIComponent).join("/");
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
// l'API GitHub et renvoyée via onUpdate si elle a changé. En cas d'échec
// réseau (hors ligne, quota API), on retombe sur la liste connue.
export async function listBuiltInSongs(onUpdate) {
  const cached = readSongsCache();
  if (cached && typeof onUpdate === "function") onUpdate(cached);
  try {
    const res = await fetch(SONGS_TREE_URL, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    const files = new Set(
      (data.tree || [])
        .filter((e) => e.type === "blob" && e.path.startsWith(SONGS_PREFIX))
        .map((e) => e.path.slice(SONGS_PREFIX.length))
    );
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
        return { name: path, title: titleFromFileName(file), folder: parts, lyricsFile: lyricsFor(path) };
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
  const res = await fetch(rawUrl(fileName));
  if (!res.ok) {
    throw new Error("Impossible de charger ce morceau (" + res.status + ").");
  }
  return res.arrayBuffer();
}

// Charge les paroles d'un morceau intégré (texte UTF-8), ou null si absentes.
export async function fetchBuiltInLyrics(lyricsFile) {
  if (!lyricsFile) return null;
  try {
    const res = await fetch(rawUrl(lyricsFile));
    if (!res.ok) return null;
    return await res.text();
  } catch (err) {
    return null; // hors ligne et jamais chargées : le morceau reste jouable
  }
}
