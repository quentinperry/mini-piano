// Service worker : rend la PWA installable et disponible hors ligne.
// Après chaque build, scripts/generate-sw-manifest.mjs écrit sw-manifest.js
// (liste des fichiers produits) : on les pré-cache à l'installation, pour
// qu'une visite hors ligne fonctionne dès le déploiement suivant.
const CACHE = "mini-piano-v6";
const CORE_ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg"];
let PRECACHE_ASSETS = CORE_ASSETS;
try {
  importScripts("sw-manifest.js");
  if (Array.isArray(self.__SW_ASSETS__) && self.__SW_ASSETS__.length) {
    PRECACHE_ASSETS = CORE_ASSETS.concat(self.__SW_ASSETS__);
  }
} catch (err) {
  // Manifeste absent (build manuel) : on se contente du noyau.
}

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Morceaux intégrés : servis depuis raw.githubusercontent.com, immuables
// tant que le dépôt n'est pas modifié. Cache d'abord (lecture hors ligne
// immédiate), revalidation en arrière-plan pour rester à jour.
const SONGS_HOST = "raw.githubusercontent.com";

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.hostname === SONGS_HOST && /\.midi?$/i.test(url.pathname)) {
    e.respondWith(
      caches.match(e.request).then((hit) => {
        const fresh = fetch(e.request)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(e.request, copy));
            }
            return res;
          })
          .catch(() => hit);
        return hit || fresh;
      })
    );
    return;
  }
  // Le reste : réseau d'abord, cache en secours. Seules les réponses
  // same-origin sont mises en cache (les assets du build, déjà pré-cachés).
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && url.origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
