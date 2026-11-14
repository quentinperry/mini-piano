import React, { useEffect, useMemo, useRef, useState } from "react";

// Affichage des paroles synchronisé avec la lecture MIDI.
// - « Défilement » : ligne précédente, ligne en cours (syllabe chantée en
//   couleur), ligne suivante.
// - « Texte complet » : tout le texte, la ligne en cours suit ; toucher une
//   ligne place la lecture juste avant elle, pour reprendre un passage.
// - « De mémoire » : les syllabes à venir sont masquées et ne se dévoilent
//   qu'au moment d'être chantées, pour réviser son texte.

const LEAD_IN = 1; // secondes jouées avant la ligne choisie

function lowerBound(arr, pos) {
  // dernier index i tel que arr[i] <= pos, ou -1
  let lo = 0;
  let hi = arr.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] <= pos) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

export function Lyrics({ lyrics, playing, getPos, progress, onSeek }) {
  const [view, setView] = useState("scroll");
  const [memory, setMemory] = useState(false);

  // Index à plat de toutes les syllabes minutées, pour une recherche rapide.
  const flat = useMemo(() => {
    const starts = [];
    const refs = [];
    lyrics.lines.forEach((l, li) =>
      l.syllables.forEach((s, si) => {
        if (s.start === null) return;
        starts.push(s.start);
        refs.push({ li, si });
      })
    );
    return { starts, refs };
  }, [lyrics]);

  const locate = (pos) => {
    const k = lowerBound(flat.starts, pos + 0.02);
    return k < 0 ? { li: -1, si: -1 } : flat.refs[k];
  };

  // Pendant la lecture, la position avance plus vite que l'état React :
  // une boucle d'animation suit la syllabe en cours et ne provoque un
  // rendu que lorsqu'elle change.
  const [cursor, setCursor] = useState(() => locate(progress));
  const cursorRef = useRef(cursor);
  useEffect(() => {
    const apply = (c) => {
      if (c.li !== cursorRef.current.li || c.si !== cursorRef.current.si) {
        cursorRef.current = c;
        setCursor(c);
      }
    };
    if (!playing) {
      apply(locate(progress));
      return;
    }
    let raf = 0;
    const tick = () => {
      apply(locate(getPos()));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [playing, progress, flat]);

  const status = (li, si) => {
    if (li < cursor.li || (li === cursor.li && si < cursor.si)) return "sung";
    if (li === cursor.li && si === cursor.si) return "current";
    return "todo";
  };

  const renderLine = (line, li) =>
    line.syllables.map((s, si) => {
      const st = status(li, si);
      return (
        <React.Fragment key={si}>
          <span className={`syl syl-${st}${memory && st === "todo" ? " is-masked" : ""}`}>
            {s.text}
          </span>
          {s.joinNext ? "" : " "}
        </React.Fragment>
      );
    });

  // Texte complet : la ligne en cours reste visible dans la zone défilante.
  const listRef = useRef(null);
  useEffect(() => {
    if (view !== "full" || !listRef.current) return;
    const el = listRef.current.querySelector(".lyr-line.is-current");
    if (!el) return;
    const box = listRef.current;
    const top = el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2;
    box.scrollTo({ top, behavior: playing ? "smooth" : "auto" });
  }, [cursor.li, view]);

  const li = Math.max(0, cursor.li);
  const prevLine = cursor.li > 0 ? lyrics.lines[cursor.li - 1] : null;
  const curLine = lyrics.lines[li];
  const nextLine = lyrics.lines[li + 1];

  const seekLine = (line) => {
    if (line.start !== null) onSeek(Math.max(0, line.start - LEAD_IN));
  };

  return (
    <div className="lyrics">
      <div className="lyrics-head">
        <div className="segmented segmented-sm" role="radiogroup" aria-label="Affichage des paroles">
          <button
            type="button"
            role="radio"
            aria-checked={view === "scroll"}
            className={view === "scroll" ? "is-selected" : ""}
            onClick={() => setView("scroll")}
          >
            Défilement
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={view === "full"}
            className={view === "full" ? "is-selected" : ""}
            onClick={() => setView("full")}
          >
            Texte complet
          </button>
        </div>
        <label className="toggle toggle-sm">
          <input type="checkbox" checked={memory} onChange={(e) => setMemory(e.target.checked)} />
          <span className="toggle-track" aria-hidden="true">
            <span className="toggle-thumb" />
          </span>
          <span>De mémoire</span>
        </label>
      </div>

      {view === "scroll" ? (
        <div className="lyrics-scroll" aria-live="off">
          <p className="lyr-side" onClick={() => prevLine && seekLine(prevLine)}>
            {prevLine ? renderLine(prevLine, cursor.li - 1) : " "}
          </p>
          <p className="lyr-main">{curLine ? renderLine(curLine, li) : " "}</p>
          <p className="lyr-side" onClick={() => nextLine && seekLine(nextLine)}>
            {nextLine ? renderLine(nextLine, li + 1) : " "}
          </p>
        </div>
      ) : (
        <div className="lyrics-full" ref={listRef}>
          {lyrics.lines.map((line, i) => (
            <button
              type="button"
              key={i}
              className={`lyr-line${i === cursor.li ? " is-current" : ""}${line.paragraph ? " is-paragraph" : ""}`}
              onClick={() => seekLine(line)}
              disabled={line.start === null}
              title="Reprendre à cette ligne"
            >
              {renderLine(line, i)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
