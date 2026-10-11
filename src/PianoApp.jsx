import React, { useEffect, useMemo, useRef, useState } from "react";
import { Synth, ensureAudio, audioState } from "./audio";
import { buildKeys, buildKeyMap, midiToFreq } from "./notes";
import { Piano } from "./Piano";

// Tessitures chorales : base midi de chaque pupitre (mi = Do4).
// Ténor par défaut.
const TESSITURES = [
  { id: "soprano", label: "Soprano", base: 60 }, // Do4 – Do6 en paysage
  { id: "alto", label: "Alto", base: 55 },       // Sol3 – Sol5
  { id: "tenor", label: "Ténor", base: 48 },     // Do3 – Do5
  { id: "basse", label: "Basse", base: 40 },     // Mi2 – Mi4
];
const DEFAULT_TESSITURE = "tenor";
// Portrait : 17 demi-tons. Paysage : 25 demi-tons (toute la tessiture).
const NARROW_COUNT = 17;
const WIDE_COUNT = 25;

// Mesure la place réellement disponible dans le canvas via un ResizeObserver.
// Plus fiable que l'orientation annoncée par l'iframe (qui peut être fausse
// ou flotter pendant une rotation) : on décide selon l'espace réellement rendu.
function useContainerSize() {
  const ref = useRef(null);
  const [size, setSize] = useState(() => ({
    width: typeof window !== "undefined" ? window.innerWidth : 0,
    height: typeof window !== "undefined" ? window.innerHeight : 0,
  }));
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () =>
      setSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    if (typeof ResizeObserver === "function") {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  return { ref, size };
}

export default function PianoApp() {
  const { ref: rootRef, size } = useContainerSize();
  // Auto : clavier étendu dès que la place le permet ; forçable manuellement.
  const [layoutMode, setLayoutMode] = useState("auto"); // auto | wide | narrow
  const autoWide = size.width >= 600;
  const isWide = layoutMode === "auto" ? autoWide : layoutMode === "wide";
  const [voiceId, setVoiceId] = useState(DEFAULT_TESSITURE);
  const [octave, setOctave] = useState(0);
  const [volume, setVolume] = useState(0.5);
  const [release, setRelease] = useState(0.35);
  const [activeIds, setActiveIds] = useState(() => new Set());
  const [lastNote, setLastNote] = useState(null);
  const [audioStatus, setAudioStatus] = useState("idle");
  const [fsAvailable, setFsAvailable] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const synthRef = useRef(null);
  if (!synthRef.current) synthRef.current = new Synth();

  const settingsRef = useRef({ volume, release });
  settingsRef.current = { volume, release };

  const tessitura = TESSITURES.find((t) => t.id === voiceId) || TESSITURES[2];
  const keys = useMemo(
    () => buildKeys(tessitura.base + octave * 12, isWide ? WIDE_COUNT : NARROW_COUNT),
    [tessitura, octave, isWide]
  );
  const keyMap = useMemo(() => buildKeyMap(keys), [keys]);

  const chooseVoice = (id) => {
    setVoiceId(id);
    setOctave(0); // on recale le clavier sur la nouvelle tessiture
  };

  const rangeText = `${keys[0].solfege} – ${keys[keys.length - 1].solfege}`;

  const pointerHeld = useRef(new Set());
  const keyHeld = useRef(new Set());

  const noteOn = (key) => {
    const s = settingsRef.current;
    if (synthRef.current.active.has(key.id)) return;
    const playing = synthRef.current.noteOn(key.id, midiToFreq(key.midi), {
      volume: s.volume,
    });
    setAudioStatus(audioState());
    if (!playing) return;
    setLastNote(key);
    setActiveIds((prev) => new Set(prev).add(key.id));
  };

  const noteOff = (id) => {
    synthRef.current.noteOff(id, settingsRef.current.release);
    setActiveIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  // Activation par défaut : on demande l'audio dès le chargement.
  // Les navigateurs qui l'autorisent sans geste l'activent ici ;
  // les autres le débloqueront au premier clic ou au premier appui touche.
  useEffect(() => {
    ensureAudio();
    setAudioStatus(audioState());
  }, []);

  // Plein écran : indisponible sur iPhone (Safari) et dans certaines iframes
  // de rendu, le bouton se cache alors automatiquement.
  useEffect(() => {
    if (typeof document === "undefined") return;
    setFsAvailable(!!document.fullscreenEnabled);
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  // Déblocage audio : les navigateurs exigent un geste pour démarrer le son.
  // On réveille le contexte à chaque premier geste utile.
  useEffect(() => {
    const unlock = () => {
      ensureAudio();
      setAudioStatus(audioState());
    };
    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("keydown", unlock, true);
    return () => {
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
    };
  }, []);

  // Sortie pointeur : au relâchement global, on coupe les notes tenues à la souris
  useEffect(() => {
    const onUp = () => {
      pointerHeld.current.forEach((id) => noteOff(id));
      pointerHeld.current.clear();
    };
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  // Clavier physique
  useEffect(() => {
    const down = (e) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const key = keyMap[e.key.toLowerCase()];
      if (!key || keyHeld.current.has(key.id)) return;
      keyHeld.current.add(key.id);
      noteOn(key);
    };
    const up = (e) => {
      const key = keyMap[e.key.toLowerCase()];
      if (!key) return;
      keyHeld.current.delete(key.id);
      noteOff(key.id);
    };
    const blur = () => {
      keyHeld.current.forEach((id) => noteOff(id));
      keyHeld.current.clear();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [keyMap]);

  // Nettoyage au démontage / changement d'octave ou de gabarit
  useEffect(() => {
    return () => {
      synthRef.current.stopAll(0.05);
      keyHeld.current.clear();
      pointerHeld.current.clear();
    };
  }, [keys]);

  const handlePointerOn = (key, source) => {
    if (source === "pointer") {
      pointerHeld.current.add(key.id);
    }
    noteOn(key);
  };

  const handlePointerOff = (id, source) => {
    if (source === "pointer") pointerHeld.current.delete(id);
    noteOff(id);
  };

  return (
    <div className="piano-app" ref={rootRef}>
      <header className="piano-header">
        <h1>Mini Piano</h1>
        <p className="piano-sub">
          Choisissez votre pupitre (soprano, alto, ténor par défaut, basse) puis jouez la note pour vous caler. En paysage, toute la tessiture s'affiche, aigus compris. Au premier chargement, appuyez deux fois sur une touche : la première autorise l'audio, la seconde joue.
        </p>
      </header>

      <div className={`audio-badge audio-${audioStatus}`} role="status">
        {audioStatus === "running"
          ? "Audio actif"
          : audioStatus === "idle"
            ? "Au début, appuyez deux fois sur une touche pour lancer le son"
            : "Audio en veille : appuyez deux fois sur une touche pour lancer le son"}
      </div>

      <div className="piano-display">
        <span className="piano-display-note">{lastNote ? lastNote.solfege : "·"}</span>
        {lastNote && (
          <span className="piano-display-freq">
            {lastNote.name} · {midiToFreq(lastNote.midi).toFixed(1)} Hz
          </span>
        )}
      </div>

      <Piano
        keys={keys}
        activeIds={activeIds}
        onNoteOn={handlePointerOn}
        onNoteOff={handlePointerOff}
      />

      <div className="piano-controls">
        <div className="control-group">
          <span className="control-label">Tessiture</span>
          <div className="voice-btns">
            {TESSITURES.map((t) => (
              <button
                key={t.id}
                type="button"
                className={t.id === voiceId ? "is-selected" : ""}
                onClick={() => chooseVoice(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <span className="piano-range">{rangeText}</span>
        </div>

        <div className="control-group">
          <span className="control-label">Clavier</span>
          <div className="voice-btns">
            {[
              { id: "auto", label: "Auto" },
              { id: "wide", label: "Étendu" },
              { id: "narrow", label: "Compact" },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                className={layoutMode === m.id ? "is-selected" : ""}
                onClick={() => setLayoutMode(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {fsAvailable && (
          <div className="control-group">
            <span className="control-label">Affichage</span>
            <div className="voice-btns">
              <button type="button" onClick={toggleFullscreen}>
                {isFullscreen ? "Quitter plein écran" : "Plein écran"}
              </button>
            </div>
          </div>
        )}

        <div className="control-group">
          <span className="control-label">Octave</span>
          <div className="octave-btns">
            <button type="button" onClick={() => setOctave((o) => Math.max(-2, o - 1))} aria-label="Octave en dessous">
              −
            </button>
            <span className="octave-value">{octave >= 0 ? `+${octave}` : octave}</span>
            <button type="button" onClick={() => setOctave((o) => Math.min(2, o + 1))} aria-label="Octave au-dessus">
              +
            </button>
          </div>
        </div>

        <div className="control-group">
          <span className="control-label">Volume</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
          />
        </div>

        <div className="control-group">
          <span className="control-label">Sustain</span>
          <input
            type="range"
            min="0.05"
            max="1.5"
            step="0.05"
            value={release}
            onChange={(e) => setRelease(Number(e.target.value))}
          />
        </div>
      </div>
    </div>
  );
}
