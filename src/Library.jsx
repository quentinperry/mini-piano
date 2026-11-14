import React, { useEffect, useMemo, useRef, useState } from "react";
import { NoteIcon, ChevronIcon } from "./icons";

// Bibliothèque des morceaux intégrés, rangés en dossiers (compositeur,
// œuvre…). On navigue de dossier en dossier avec un fil d'Ariane, ou on
// cherche directement un titre dans toute la bibliothèque. Le dernier
// dossier ouvert est retenu d'une visite à l'autre.

const DIR_KEY = "mini-piano-library-dir";

const fold = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const FolderIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" fill="currentColor" fillOpacity="0.12" />
  </svg>
);

const SearchIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

const CloseIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" aria-hidden="true" focusable="false">
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

function readDir() {
  try {
    const v = JSON.parse(localStorage.getItem(DIR_KEY));
    return Array.isArray(v) ? v : [];
  } catch (err) {
    return [];
  }
}

function saveDir(dir) {
  try {
    localStorage.setItem(DIR_KEY, JSON.stringify(dir));
  } catch (err) {
    /* stockage indisponible : sans conséquence */
  }
}

const startsWith = (folder, dir) => dir.every((d, i) => folder[i] === d);

export function Library({ songs, selected, loading, onOpen, onChoose }) {
  const [open, setOpen] = useState(false);
  const [dir, setDir] = useState(readDir);
  const [query, setQuery] = useState("");
  const searchRef = useRef(null);
  const rootRef = useRef(null);

  const current = useMemo(
    () => (songs || []).find((s) => s.name === selected) || null,
    [songs, selected]
  );

  // Dossier mémorisé disparu (fichiers déplacés) : on remonte au plus proche.
  useEffect(() => {
    if (!songs || !songs.length) return;
    let d = dir;
    while (d.length && !songs.some((s) => startsWith(s.folder || [], d))) d = d.slice(0, -1);
    if (d.length !== dir.length) setDir(d);
  }, [songs]);

  const goTo = (d) => {
    setDir(d);
    saveDir(d);
    setQuery("");
  };

  const openLibrary = () => {
    onOpen();
    if (current) goTo(current.folder || []);
    setOpen(true);
  };

  // À l'ouverture, la liste est amenée dans le champ de vision (téléphone).
  const panelRef = useRef(null);
  useEffect(() => {
    const panel = panelRef.current;
    if (!open || !panel || !panel.scrollIntoView) return;
    // En portrait (panneau dans le flux), le bouton remonte en haut de
    // l'écran pour laisser toute la place à la liste ; sinon, simple
    // ajustement pour que le panneau soit visible.
    const inFlow = window.getComputedStyle(panel).position === "static";
    (inFlow ? rootRef.current : panel).scrollIntoView({
      block: inFlow ? "start" : "nearest",
      behavior: "smooth",
    });
  }, [open]);

  // Échap ferme la bibliothèque ; un clic ailleurs aussi.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  // Contenu du dossier courant : sous-dossiers (avec leur nombre de
  // morceaux) puis morceaux.
  const view = useMemo(() => {
    const list = songs || [];
    const folders = new Map();
    const here = [];
    for (const s of list) {
      const f = s.folder || [];
      if (!startsWith(f, dir)) continue;
      if (f.length === dir.length) here.push(s);
      else {
        const name = f[dir.length];
        folders.set(name, (folders.get(name) || 0) + 1);
      }
    }
    const sortedFolders = [...folders.entries()].sort((a, b) =>
      a[0].localeCompare(b[0], "fr", { numeric: true })
    );
    return { folders: sortedFolders, songs: here };
  }, [songs, dir]);

  const results = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return null;
    const words = q.split(/\s+/);
    return (songs || []).filter((s) => {
      const hay = fold([...(s.folder || []), s.title].join(" "));
      return words.every((w) => hay.includes(w));
    });
  }, [songs, query]);

  const choose = (s) => {
    goTo(s.folder || []);
    setOpen(false);
    onChoose(s.name);
  };

  const songRow = (s, showPath) => (
    <li key={s.name}>
      <button
        type="button"
        className={`lib-row lib-song${s.name === selected ? " is-selected" : ""}`}
        onClick={() => choose(s)}
      >
        <span className="lib-icon"><NoteIcon size={16} /></span>
        <span className="lib-text">
          <span className="lib-name">{s.title}</span>
          {showPath && s.folder && s.folder.length > 0 && (
            <span className="lib-path">{s.folder.join(" › ")}</span>
          )}
        </span>
        {s.lyricsFile && <span className="lib-badge">paroles</span>}
      </button>
    </li>
  );

  return (
    <div className="library" ref={rootRef}>
      <button
        type="button"
        className={`lib-trigger${open ? " is-open" : ""}`}
        onClick={() => (open ? setOpen(false) : openLibrary())}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span className="lib-icon"><NoteIcon size={18} /></span>
        <span className="lib-text">
          {current ? (
            <>
              <span className="lib-name">{current.title}</span>
              {current.folder && current.folder.length > 0 && (
                <span className="lib-path">{current.folder.join(" › ")}</span>
              )}
            </>
          ) : (
            <span className="lib-name lib-placeholder">Bibliothèque des morceaux</span>
          )}
        </span>
        <span className="lib-chevron"><ChevronIcon size={16} /></span>
      </button>

      {open && (
        <div className="lib-panel" ref={panelRef} role="dialog" aria-label="Bibliothèque des morceaux">
          <div className="lib-head">
            <nav className="lib-crumbs" aria-label="Dossier">
              <button type="button" className={dir.length ? "" : "is-current"} onClick={() => goTo([])}>
                Bibliothèque
              </button>
              {dir.map((d, i) => (
                <React.Fragment key={i}>
                  <span className="lib-sep" aria-hidden="true">›</span>
                  <button
                    type="button"
                    className={i === dir.length - 1 ? "is-current" : ""}
                    onClick={() => goTo(dir.slice(0, i + 1))}
                  >
                    {d}
                  </button>
                </React.Fragment>
              ))}
            </nav>
            <button type="button" className="lib-close" onClick={() => setOpen(false)} aria-label="Fermer">
              <CloseIcon />
            </button>
          </div>

          <label className="lib-search">
            <SearchIcon />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Chercher un morceau, un compositeur…"
              aria-label="Chercher dans la bibliothèque"
            />
          </label>

          <ul className="lib-list">
            {songs === null || loading ? (
              <li className="lib-empty"><span className="spinner" aria-hidden="true" /> Chargement de la bibliothèque…</li>
            ) : songs.length === 0 ? (
              <li className="lib-empty">Bibliothèque indisponible pour l'instant (hors ligne ?). « Fichier MIDI » reste possible.</li>
            ) : results ? (
              results.length ? results.map((s) => songRow(s, true)) : <li className="lib-empty">Aucun morceau ne correspond.</li>
            ) : (
              <>
                {dir.length > 0 && (
                  <li>
                    <button type="button" className="lib-row lib-up" onClick={() => goTo(dir.slice(0, -1))}>
                      <span className="lib-icon lib-back"><ChevronIcon size={16} /></span>
                      <span className="lib-text"><span className="lib-name">Dossier parent</span></span>
                    </button>
                  </li>
                )}
                {view.folders.map(([name, count]) => (
                  <li key={"d:" + name}>
                    <button type="button" className="lib-row lib-folder" onClick={() => goTo([...dir, name])}>
                      <span className="lib-icon"><FolderIcon /></span>
                      <span className="lib-text"><span className="lib-name">{name}</span></span>
                      <span className="lib-count">{count} morceau{count > 1 ? "x" : ""}</span>
                      <span className="lib-go"><ChevronIcon size={16} /></span>
                    </button>
                  </li>
                ))}
                {view.songs.map((s) => songRow(s, false))}
                {!view.folders.length && !view.songs.length && <li className="lib-empty">Dossier vide.</li>}
              </>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
