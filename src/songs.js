// Morceaux intégrés : le dossier « public/songs/ » de la branche `main` du
// dépôt GitHub héberge les fichiers. Celui qui gère le répertoire y dépose
// simplement des .mid via l'interface GitHub — aucun réglage côté code. L'app
// découvre la liste via l'API GitHub (dépôt public), puis charge le morceau
// choisi depuis raw.githubusercontent.com : les fichiers sont servis dès
// l'upload, sans attendre le déploiement Pages, et le service worker les met
// en cache après une première écoute pour un usage hors ligne.

const SONGS_API_URL =
  "https://api.github.com/repos/quentinperry/mini-piano/contents/public/songs?ref=main";
const SONGS_RAW_BASE =
  "https://raw.githubusercontent.com/quentinperry/mini-piano/main/public/songs/";
const SONGS_CACHE_KEY = "mini-piano-songs-v1";
const SONGS_CACHE_MAX_AGE = 24 * 3600 * 1000; // une relecture par jour suffit

// Libellé lisible à partir du nom de fichier : « 01kyrie.mid » s'affichera
// « 01 Kyrie ». Celui qui dépose les fichiers garde la main : espaces,
// accents et tirets dans le nom sont respectés tels quels.
function titleFromFileName(name) {
  return name
    .replace(/\.(mid|midi)$/i, "")
    .replace(/_+/g, " ")
    .replace(/(\d)(?=[A-Za-z\u00c0-\u017f])/g, "$1 ")
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ")
    .trim();
}

// Liste des morceaux disponibles. En cas d'échec (hors ligne, quota API),
// on retombe sur la dernière liste connue, stockée localement.
export async function listBuiltInSongs() {
  try {
    const res = await fetch(SONGS_API_URL, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const entries = await res.json();
    const list = entries
      .filter((e) => e.type === "file" && /\.midi?$/i.test(e.name))
      .map((e) => ({ name: e.name, title: titleFromFileName(e.name) }))
      .sort((a, b) => a.name.localeCompare(b.name, "fr", { numeric: true }));
    try {
      localStorage.setItem(SONGS_CACHE_KEY, JSON.stringify({ at: Date.now(), list }));
    } catch (err) {
      /* stockage indisponible (mode privé, quota) : sans conséquence */
    }
    return list;
  } catch (err) {
    try {
      const raw = JSON.parse(localStorage.getItem(SONGS_CACHE_KEY));
      if (raw && raw.list && Date.now() - raw.at < SONGS_CACHE_MAX_AGE) {
        return raw.list;
      }
    } catch (err2) {
      /* pas de liste connue : on remonte l'erreur */
    }
    throw err;
  }
}

// Charge le fichier MIDI d'un morceau intégré, depuis le dépôt.
export async function fetchBuiltInSong(fileName) {
  const res = await fetch(SONGS_RAW_BASE + encodeURIComponent(fileName));
  if (!res.ok) {
    throw new Error("Impossible de charger ce morceau (" + res.status + ").");
  }
  return res.arrayBuffer();
}
