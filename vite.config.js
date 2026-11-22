import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = "/mini-piano/";
const SONGS_DIR = fileURLToPath(new URL("./public/songs/", import.meta.url));

// Liste des fichiers de public/songs/ (sous-dossiers compris), chemins relatifs.
function listSongs(dir = SONGS_DIR) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listSongs(p));
    else out.push(relative(SONGS_DIR, p).split("\\").join("/"));
  }
  return out.filter((f) => f !== "index.json").sort();
}

// Index de la bibliothèque, fabriqué à chaque build (donc à chaque mise en
// ligne, déclenchée par tout ajout de fichier sur main) : l'app n'a plus
// besoin de l'API GitHub, limitée à 60 demandes par heure et par adresse IP
// (vite atteinte quand tout un chœur partage le Wi-Fi d'une répétition).
// MIDI contenant des paroles intégrées (méta-événements « lyric » FF 05),
// pour signaler « paroles » dans la bibliothèque sans fichier .paroles.txt.
function midiWithLyrics(files) {
  return files.filter((f) => {
    if (!/\.midi?$/i.test(f)) return false;
    try {
      const buf = readFileSync(SONGS_DIR + f);
      for (let i = 0; i + 1 < buf.length; i++) if (buf[i] === 0xff && buf[i + 1] === 0x05) return true;
    } catch (err) {
      /* fichier illisible : pas de mention */
    }
    return false;
  });
}

function songsIndex() {
  return {
    name: "songs-index",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if ((req.url || "").split("?")[0] !== `${BASE}songs/index.json`) return next();
        res.setHeader("Content-Type", "application/json");
        const files = listSongs();
        res.end(JSON.stringify({ files, midiLyrics: midiWithLyrics(files) }));
      });
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "songs/index.json",
        source: JSON.stringify({ files: listSongs(), midiLyrics: midiWithLyrics(listSongs()), generated: new Date().toISOString() }),
      });
    },
  };
}

// Le site est servi depuis un sous-chemin GitHub Pages
// (https://quentinperry.github.io/mini-piano/) : les adresses des
// ressources produites par le build sont préfixées en conséquence.
export default defineConfig({
  base: BASE,
  plugins: [react(), songsIndex()],
});
