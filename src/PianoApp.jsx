import React, { useEffect, useMemo, useRef, useState } from "react";
import { Synth, ensureAudio, audioState } from "./audio";
import { buildKeys, buildKeyMap, midiToFreq } from "./notes";
import { parseMidi, createMidiPlayer } from "./midi";
import { listBuiltInSongs, fetchBuiltInSong } from "./songs";
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

// Mesure la place réellement disponible via un ResizeObserver.
// Plus fiable que l'orientation annoncée par l'iframe (qui peut être fausse
// ou flotter pendant une rotation) : portrait ou paysage se déduit du
// rapport largeur/hauteur réellement rendu.
function formatMidiTime(t) {
  return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
}

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
  // Portrait : clavier compact (17 demi-tons). Paysage : étendu (25, toute
  // la tessiture). Le gabarit suit l'orientation réelle, sans réglage manuel.
  const isWide = size.width > 0 && size.width >= size.height;
  const [voiceId, setVoiceId] = useState(DEFAULT_TESSITURE);
  const [octave, setOctave] = useState(0);
  const [volume, setVolume] = useState(0.5);
  const [release, setRelease] = useState(0.35);
  const [activeIds, setActiveIds] = useState(() => new Set());
  const [lastNote, setLastNote] = useState(null);
  const [audioStatus, setAudioStatus] = useState("idle");
  const [fsAvailable, setFsAvailable] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Fichier MIDI : analyse, piste choisie, vitesse, lecture en cours
  const [midi, setMidi] = useState(null);
  const [midiTrack, setMidiTrack] = useState("all");
  const [midiSpeed, setMidiSpeed] = useState(1);
  const [midiPlaying, setMidiPlaying] = useState(false);
  const [midiActiveIds, setMidiActiveIds] = useState(() => new Set());
  const [midiError, setMidiError] = useState(null);
  // Position dans le morceau (seconde), mémorisée d'une pause à l'autre
  const [midiProgress, setMidiProgress] = useState(0);
  // Morceaux intégrés : liste découverte au chargement (null = en cours),
  // morceau sélectionné dans le menu, morceau en cours de chargement
  const [songs, setSongs] = useState(null);
  const [selectedSong, setSelectedSong] = useState("");
  const [songLoading, setSongLoading] = useState(null);

  const synthRef = useRef(null);
  if (!synthRef.current) synthRef.current = new Synth();

  const midiPlayerRef = useRef(null);
  const midiHeldRef = useRef(new Set());
  const midiPosRef = useRef(0); // position de reprise, en secondes

  const settingsRef = useRef({ volume, release });
  settingsRef.current = { volume, release };

  const tessitura = TESSITURES.find((t) => t.id === voiceId) || TESSITURES[2];
  const keys = useMemo(
    () => buildKeys(tessitura.base + octave * 12, isWide ? WIDE_COUNT : NARROW_COUNT),
    [tessitura, octave, isWide]
  );
  const keyMap = useMemo(() => buildKeyMap(keys), [keys]);
  const keyByMidi = useMemo(() => new Map(keys.map((k) => [k.midi, k])), [keys]);

  const chooseVoice = (id) => {
    pauseMidi(); // les surbrillances MIDI ne suivraient plus le clavier
    setVoiceId(id);
    setOctave(0); // on recale le clavier sur la nouvelle tessiture
  };

  const shiftOctave = (d) => {
    pauseMidi();
    setOctave((o) => Math.min(2, Math.max(-2, o + d)));
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
      if (midiPlayerRef.current) midiPlayerRef.current.stop();
      midiHeldRef.current.clear();
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

  // ---- Lecture d'un fichier MIDI : entraînement pupitre ----
  // Le choriste ouvre un fichier (souvent une piste par pupitre), choisit
  // sa voix, et suit en rythme : les touches s'illuminent, le son passe par
  // le même synthé que le clavier. La lecture se met en pause et se reprend
  // à la position mémorisée, et le curseur permet de naviguer dans le morceau.
  const releaseMidiNotes = () => {
    midiHeldRef.current.forEach((m) =>
      synthRef.current.noteOff("midi-" + m, settingsRef.current.release)
    );
    midiHeldRef.current.clear();
    setMidiActiveIds(new Set());
  };

  const pauseMidi = () => {
    if (midiPlayerRef.current) {
      midiPosRef.current = midiPlayerRef.current.getPos();
      midiPlayerRef.current.stop();
      midiPlayerRef.current = null;
    }
    releaseMidiNotes();
    setMidiPlaying(false);
    setMidiProgress(midiPosRef.current);
  };

  const handleMidiNoteOn = (midiNum, velocity) => {
    midiHeldRef.current.add(midiNum);
    const gain = settingsRef.current.volume * (0.35 + (0.65 * velocity) / 127);
    synthRef.current.noteOn("midi-" + midiNum, midiToFreq(midiNum), { volume: gain });
    const key = keyByMidi.get(midiNum);
    if (key) {
      setLastNote(key);
      setMidiActiveIds((prev) => new Set(prev).add(key.id));
    }
  };

  const handleMidiNoteOff = (midiNum) => {
    midiHeldRef.current.delete(midiNum);
    synthRef.current.noteOff("midi-" + midiNum, settingsRef.current.release);
    const key = keyByMidi.get(midiNum);
    if (key) {
      setMidiActiveIds((prev) => {
        if (!prev.has(key.id)) return prev;
        const next = new Set(prev);
        next.delete(key.id);
        return next;
      });
    }
  };

  const startMidi = (speed = midiSpeed, track = midiTrack, fromPos = midiPosRef.current) => {
    if (!midi) return;
    const notes =
      track === "all"
        ? midi.tracks.flatMap((t) => t.notes)
        : midi.tracks[Number(track)].notes;
    if (!notes.length) return;
    const events = [];
    let maxT = 0;
    for (const n of notes) {
      events.push({ t: n.start, on: true, midi: n.midi, velocity: n.velocity });
      events.push({ t: n.end, on: false, midi: n.midi });
      if (n.end > maxT) maxT = n.end;
    }
    // au même instant, on coupe la note avant d'en rallumer une
    events.sort((a, b) => a.t - b.t || (a.on ? 1 : 0) - (b.on ? 1 : 0));
    ensureAudio();
    midiPlayerRef.current = createMidiPlayer(events, maxT, {
      onNoteOn: handleMidiNoteOn,
      onNoteOff: handleMidiNoteOff,
      onEnd: () => {
        midiPlayerRef.current = null;
        midiPosRef.current = 0; // morceau terminé : une relecture repart du début
        setMidiPlaying(false);
        releaseMidiNotes();
        setMidiProgress(maxT);
      },
    });
    midiPlayerRef.current.play(speed, fromPos);
    setMidiPlaying(true);
  };

  const toggleMidi = () =>
    midiPlaying ? pauseMidi() : startMidi();

  // Saut dans le morceau : on relâche les notes tenues, puis on reprogramme
  // la lecture depuis la nouvelle position (les notes déjà passées ne sonnent
  // pas, leurs note-off orphelins sont sans effet).
  const seekMidi = (t) => {
    if (!midi) return;
    const to = Math.min(Math.max(t, 0), midi.duration);
    midiPosRef.current = to;
    releaseMidiNotes();
    if (midiPlaying && midiPlayerRef.current) {
      midiPlayerRef.current.seek(to);
    } else {
      setMidiProgress(to);
    }
  };

  // Barre de progression : rafraîchie pendant la lecture uniquement.
  useEffect(() => {
    if (!midiPlaying) return;
    const id = setInterval(() => {
      if (midiPlayerRef.current) setMidiProgress(midiPlayerRef.current.getPos());
    }, 200);
    return () => clearInterval(id);
  }, [midiPlaying]);

  // Morceaux intégrés : liste découverte au démarrage. En cas d'échec
  // (hors ligne, quota), le menu ne s'affiche pas et l'ouverture manuelle
  // d'un fichier reste disponible.
  useEffect(() => {
    let alive = true;
    listBuiltInSongs()
      .then((list) => {
        if (alive) setSongs(list);
      })
      .catch(() => {
        if (alive) setSongs([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Changer de piste ou de vitesse garde la position : on poursuit au même
  // endroit du morceau, comme le ferait un lecteur audio.
  const changeMidiTrack = (e) => {
    const track = e.target.value;
    setMidiTrack(track);
    if (midiPlaying) {
      pauseMidi();
      startMidi(midiSpeed, track);
    }
  };

  const changeMidiSpeed = (e) => {
    const speed = Number(e.target.value);
    setMidiSpeed(speed);
    if (midiPlaying) {
      pauseMidi();
      startMidi(speed, midiTrack);
    }
  };

  const handleMidiFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ""; // permet de rouvrir le même fichier
    if (!file) return;
    pauseMidi();
    midiPosRef.current = 0; // nouveau fichier : on repart du début
    setMidiProgress(0);
    setSelectedSong(""); // le menu des morceaux intégrés ne suit plus
    try {
      const parsed = parseMidi(await file.arrayBuffer());
      setMidi({ name: file.name, duration: parsed.duration, tracks: parsed.tracks });
      setMidiTrack("all");
      setMidiError(null);
    } catch (err) {
      setMidi(null);
      setMidiError(String(err && err.message ? err.message : err));
    }
  };

  // Morceau intégré : même chemin que l'ouverture d'un fichier, seul le
  // transport change (téléchargement depuis le site au lieu d'un upload).
  const chooseBuiltInSong = async (e) => {
    const fileName = e.target.value;
    setSelectedSong(fileName);
    if (!fileName) return;
    pauseMidi();
    midiPosRef.current = 0;
    setMidiProgress(0);
    setMidi(null);
    setMidiError(null);
    setSongLoading(fileName);
    try {
      const parsed = parseMidi(await fetchBuiltInSong(fileName));
      const song = (songs || []).find((s) => s.name === fileName);
      setMidi({
        name: song ? song.title : fileName,
        duration: parsed.duration,
        tracks: parsed.tracks,
      });
      setMidiTrack("all");
    } catch (err) {
      setMidi(null);
      setMidiError(String(err && err.message ? err.message : err));
    } finally {
      setSongLoading(null);
    }
  };

  return (
    <div
      className={`piano-app ${isWide ? "layout-wide" : "layout-narrow"}`}
      ref={rootRef}
    >
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
        activeIds={midiActiveIds.size ? new Set([...activeIds, ...midiActiveIds]) : activeIds}
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
            <button type="button" onClick={() => shiftOctave(-1)} aria-label="Octave en dessous">
              −
            </button>
            <span className="octave-value">{octave >= 0 ? `+${octave}` : octave}</span>
            <button type="button" onClick={() => shiftOctave(1)} aria-label="Octave au-dessus">
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

        <div className="control-group">
          <span className="control-label">Fichier MIDI</span>
          <div className="voice-btns">
            <label className="midi-btn">
              Ouvrir un MIDI…
              <input
                type="file"
                accept=".mid,.midi,audio/midi"
                hidden
                onChange={handleMidiFile}
              />
            </label>
          </div>
          {songs === null && (
            <div className="voice-btns">
              <select disabled aria-label="Morceaux intégrés">
                <option>Liste des morceaux…</option>
              </select>
            </div>
          )}
          {songs !== null && songs.length > 0 && (
            <div className="voice-btns">
              <select
                value={selectedSong}
                onChange={chooseBuiltInSong}
                aria-label="Morceaux intégrés"
              >
                <option value="">Morceaux intégrés…</option>
                {songs.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.title}
                  </option>
                ))}
              </select>
            </div>
          )}
          {songLoading && <span className="midi-file">Chargement du morceau…</span>}
          {midi && (
            <>
              <span className="midi-file">
                {midi.name} · {formatMidiTime(midi.duration)}
              </span>
              <div className="midi-seek">
                <span className="midi-time">{formatMidiTime(Math.min(midiProgress, midi.duration))}</span>
                <input
                  type="range"
                  min="0"
                  max={midi.duration}
                  step="0.1"
                  value={Math.min(midiProgress, midi.duration)}
                  onChange={(e) => seekMidi(Number(e.target.value))}
                  aria-label="Position dans le morceau"
                />
                <span className="midi-time">{formatMidiTime(midi.duration)}</span>
              </div>
              <div className="voice-btns midi-row">
                <select value={midiTrack} onChange={changeMidiTrack} aria-label="Piste à jouer">
                  <option value="all">Toutes les pistes</option>
                  {midi.tracks.map((t, i) => (
                    <option key={i} value={String(i)}>
                      {t.name} ({t.notes.length})
                    </option>
                  ))}
                </select>
                <select value={midiSpeed} onChange={changeMidiSpeed} aria-label="Vitesse de lecture">
                  {[0.5, 0.75, 1, 1.25, 1.5].map((s) => (
                    <option key={s} value={String(s)}>
                      ×{s}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={toggleMidi}>
                  {midiPlaying
                    ? "Pause"
                    : midiProgress > 0.05 && midiProgress < midi.duration - 0.05
                      ? "Reprendre"
                      : "Lire"}
                </button>
              </div>
            </>
          )}
          {midiError && <span className="midi-file midi-error">{midiError}</span>}
        </div>
      </div>
    </div>
  );
}
