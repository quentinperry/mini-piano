// Lancé après `vite build` : écrit dist/sw-manifest.js, la liste des
// fichiers produits par le build (chemins relatifs à la racine du site),
// pour que le service worker puisse les pré-cacher à l'installation.
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const dist = new URL("../dist/", import.meta.url).pathname;

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(relative(dist, p).split("\\").join("/"));
  }
  return out;
}

// Les échantillons de piano (≈ 0,9 Mo) et les morceaux (bibliothèque appelée
// à grossir) ne sont pas pré-cachés : ils sont
// téléchargés à la première utilisation puis gardés par le service worker.
const files = walk(dist).filter(
  (f) => f !== "sw-manifest.js" && !f.startsWith("samples/") && !f.startsWith("songs/")
);
writeFileSync(
  join(dist, "sw-manifest.js"),
  `self.__SW_ASSETS__ = ${JSON.stringify(files)};\n`
);
console.log(`sw-manifest.js : ${files.length} fichiers`);
