import React, { useEffect, useMemo, useRef } from "react";

export function Piano({ keys, activeIds, onNoteOn, onNoteOff }) {
  const keysRef = useRef(null);

  // iOS : l'appui long sur une touche déclenche la loupe / le zoom de
  // sélection. On bloque l'événement natif « touchstart » (React l'attache
  // en passif, d'où l'écouteur natif non passif) et le menu contextuel.
  // Les événements pointeur utilisés pour jouer ne sont pas affectés.
  useEffect(() => {
    const el = keysRef.current;
    if (!el) return;
    const stop = (e) => e.preventDefault();
    el.addEventListener("touchstart", stop, { passive: false });
    el.addEventListener("contextmenu", stop);
    return () => {
      el.removeEventListener("touchstart", stop);
      el.removeEventListener("contextmenu", stop);
    };
  }, []);

  const whites = useMemo(() => keys.filter((k) => !k.isBlack), [keys]);
  const blacks = useMemo(() => keys.filter((k) => k.isBlack), [keys]);
  const whiteW = 100 / whites.length;
  const blackW = whiteW * 0.62;

  return (
    <div className="piano">
      <div className="piano-keys" ref={keysRef}>
        {whites.map((k) => (
          <button
            key={k.id}
            type="button"
            className={`white-key${activeIds.has(k.id) ? " is-active" : ""}`}
            onPointerDown={(e) => {
              e.preventDefault();
              onNoteOn(k, "pointer");
            }}
            onPointerEnter={(e) => {
              if (e.buttons === 1) onNoteOn(k, "pointer");
            }}
            onPointerLeave={() => onNoteOff(k.id, "pointer")}
            aria-label={`${k.solfege} (${k.name})`}
          >
            <span className="key-note">{k.solfege}</span>
            {k.keyLabel && <span className="key-bind">{k.keyLabel}</span>}
          </button>
        ))}
        {blacks.map((k) => (
          <button
            key={k.id}
            type="button"
            className={`black-key${activeIds.has(k.id) ? " is-active" : ""}`}
            style={{ left: `${(k.whiteBefore + 1) * whiteW - blackW / 2}%`, width: `${blackW}%` }}
            onPointerDown={(e) => {
              e.preventDefault();
              onNoteOn(k, "pointer");
            }}
            onPointerEnter={(e) => {
              if (e.buttons === 1) onNoteOn(k, "pointer");
            }}
            onPointerLeave={() => onNoteOff(k.id, "pointer")}
            aria-label={`${k.solfege} (${k.name})`}
          >
            {k.keyLabel && <span className="key-bind">{k.keyLabel}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
