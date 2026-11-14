import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  PlayIcon, PauseIcon, Back10Icon, Fwd10Icon, ExpandIcon, ShrinkIcon,
  FileIcon, NoteIcon, VolumeIcon, SustainIcon, MinusIcon, PlusIcon, Logo, LyricsIcon,
} from "./icons";
import { Synth, ensureAudio, audioState, suspendAudio, onAudioStateChange } from "./audio";
import { buildKeys, buildKeyMap, midiToFreq } from "./notes";
import { parseMidi, createMidiPlayer } from "./midi";
import { listBuiltInSongs, fetchBuiltInSong, fetchBuiltInLyrics } from "./songs";
import { detectVoice, findVoiceTrack, normalizeName } from "./voices";
import { buildLyrics, lyricsSectionNames } from "./lyrics";
import { Piano } from "./Piano";
import { Lyrics } from "./LyricsPanel";

// Tessitures chorales : base midi de chaque pupitre (mi = Do4).
// Ténor par défaut.
const TESSITURES = [
  { id: "soprano", label: "Soprano", base: 60 }, // Do4 – Do6 en paysage
  { id: "alto", label: "Alto", base: 55 },       // Sol3 – Sol5
  { id: "tenor", label: "Ténor", base: 48 },     // Do3 – Do5
  { id: "basse", label: "Basse", base: 40 },     // Mi2 – Mi4
];
const DEFAULT_TESSITURE = "tenor";
// Piste choisie « mise en avant » : les autres pistes jouent en fond, à ce
// facteur de gain (environ −11 dB), pour garder l'harmonie sans couvrir
// la voix travaillée.
const BACKGROUND_GAIN = 0.28;
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
    // Largeur : celle réellement rendue. Hauteur : celle de la fenêtre, car
    // le conteneur grandit avec son contenu et fausserait le rapport.
    const measure = () =>
      setSize({ width: el.clientWidth, height: window.innerHeight });
    measure();
    window.addEventListener("resize", measure);
    let ro = null;
    if (typeof ResizeObserver === "function") {
      ro = new ResizeObserver(measure);
      ro.observe(el);
    }
    return () => {
      window.removeEventListener("resize", measure);
      if (ro) ro.disconnect();
    };
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
  // Avec une piste choisie : « lead » = mise en avant, les autres pistes
  // restent audibles plus doucement (par défaut) ; « solo » = piste seule.
  const [midiMix, setMidiMix] = useState("lead");
  // Paroles du morceau : texte d'un fichier « .paroles.txt » (dépôt ou
  // fichier local), alignées ensuite sur la piste suivie.
  const [lyricsText, setLyricsText] = useState(null);
  const [midiSpeed, setMidiSpeed] = useState(1);
  const [midiPlaying, setMidiPlaying] = useState(false);
  const [midiActiveIds, setMidiActiveIds] = useState(() => new Set());
  const [midiError, setMidiError] = useState(null);
  // Pause automatique quand l'app passe en arrière-plan (écran verrouillé,
  // onglet caché) : optionnelle et désactivée par défaut, chacun choisit.
  const [pauseOnHidden, setPauseOnHidden] = useState(false);
  const pauseOnHiddenRef = useRef(false);
  pauseOnHiddenRef.current = pauseOnHidden;
  // Position dans le morceau (seconde), mémorisée d'une pause à l'autre
  const [midiProgress, setMidiProgress] = useState(0);
  // Morceaux intégrés : liste découverte à la première ouverture du menu
  // (null = pas encore demandée), morceau sélectionné, morceau en cours de chargement
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
  // Les rappels du lecteur MIDI lisent le clavier courant via cette
  // référence : changer de pupitre ou d'octave en pleine lecture ne
  // l'interrompt plus, les surbrillances suivent le nouveau clavier.
  const keyByMidiRef = useRef(keyByMidi);
  keyByMidiRef.current = keyByMidi;

  // Piste du morceau qui correspond à un pupitre (-1 si aucune).
  const voiceTrackOf = (m, id) => (m ? findVoiceTrack(m.tracks, id) : -1);

  // Pupitre et piste se règlent en un seul geste : choisir « Alto » recale
  // le clavier et, si le morceau a une piste d'alto, la met en avant.
  const chooseVoice = (id) => {
    setVoiceId(id);
    setOctave(0); // on recale le clavier sur la nouvelle tessiture
    const idx = voiceTrackOf(midi, id);
    if (idx >= 0 && String(idx) !== midiTrack) {
      const track = String(idx);
      setMidiTrack(track);
      if (midiPlaying) {
        pauseMidi();
        startMidi(midiSpeed, track);
      }
    }
  };

  const shiftOctave = (d) => {
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

  // Le navigateur peut suspendre ou reprendre le contexte audio de lui-même
  // (onglet en arrière-plan, verrouillage écran) : le badge suit l'état réel.
  useEffect(() => onAudioStateChange((s) => setAudioStatus(s)), []);

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

  // Démontage du composant : on coupe tout, lecteur MIDI compris.
  useEffect(() => {
    return () => {
      synthRef.current.stopAll(0.05);
      if (midiPlayerRef.current) midiPlayerRef.current.stop();
      midiHeldRef.current.clear();
      keyHeld.current.clear();
      pointerHeld.current.clear();
    };
  }, []);

  // Changement d'octave ou de gabarit (rotation portrait/paysage) : on relâche
  // seulement les notes tenues au clavier ou à la souris, dont les touches
  // peuvent avoir disparu. La lecture MIDI continue : ses notes ne dépendent
  // pas du gabarit affiché, et ses surbrillances lisent le clavier courant.
  useEffect(() => {
    return () => {
      keyHeld.current.forEach((id) => synthRef.current.noteOff(id, 0.05));
      pointerHeld.current.forEach((id) => synthRef.current.noteOff(id, 0.05));
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
  // En tutti, chaque note MIDI déclenchait deux mises à jour d'état React
  // (note affichée + surbrillances), soit des dizaines de re-rendus par
  // seconde qui saturent le fil JS et font glisser les timers du lecteur
  // (lecture « hésitante »). Les événements MIDI n'écrivent plus l'état
  // directement : ils alimentent ces références, et un vidage cadencé à
  // l'œil (~60 fps) ne met à jour l'interface qu'une fois par frame.
  const midiPlayingRef = useRef(false);
  const pauseMidiRef = useRef(null);
  const midiUiIdsRef = useRef(null);
  const midiUiNoteRef = useRef(null);
  const midiUiDirtyRef = useRef(false);
  const midiUiFrameRef = useRef(null);
  const flushMidiUi = () => {
    midiUiFrameRef.current = null;
    if (!midiUiDirtyRef.current) return;
    midiUiDirtyRef.current = false;
    if (midiUiIdsRef.current) {
      setMidiActiveIds(midiUiIdsRef.current);
      midiUiIdsRef.current = null;
    }
    if (midiUiNoteRef.current) {
      setLastNote(midiUiNoteRef.current);
      midiUiNoteRef.current = null;
    }
  };
  const scheduleMidiUi = () => {
    if (midiUiFrameRef.current !== null) return;
    midiUiFrameRef.current = requestAnimationFrame(flushMidiUi);
  };
  const releaseMidiNotes = () => {
    midiHeldRef.current.forEach((voiceId) =>
      synthRef.current.noteOff(voiceId, settingsRef.current.release)
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

  midiPlayingRef.current = midiPlaying;
  pauseMidiRef.current = pauseMidi;
  // Les notes d'accompagnement (pistes de fond) ont leurs propres voix de
  // synthé, pour qu'un unisson avec la piste mise en avant ne la coupe pas,
  // et elles n'allument pas le clavier : seule la voix travaillée s'affiche.
  const handleMidiNoteOn = (midiNum, velocity, gainScale = 1, songT = null, bg = false) => {
    const voiceId = (bg ? "midibg-" : "midi-") + midiNum;
    midiHeldRef.current.add(voiceId);
    // Compression de vélocité : les fichiers de notation encodent leurs
    // nuances de façon brutale (chœur souvent à 127 = forte constante).
    // On remappe 0-127 sur 48-105 pour garder les nuances audibles sans
    // coups de marteau : un ff ne sonne plus que ~1,5 fois plus fort qu'un pp.
    const compressed = 48 + (velocity * 57) / 127;
    const gain =
      settingsRef.current.volume * (0.35 + (0.65 * compressed) / 127) * gainScale;
    // 3 partiels au lieu de 5 : largement assez pour se caler, et un tiers de
    // charge en moins sur le processeur quand le tutti joue.
    // Départ sur l'horloge audio quand le lecteur fournit l'instant cible :
    // la note commence exactement au bon moment même si le timer JS a glissé.
    const c = ensureAudio();
    const at =
      songT !== null && c
        ? c.currentTime + Math.max(0, songT - (midiPlayerRef.current ? midiPlayerRef.current.getPos() : songT))
        : null;
    synthRef.current.noteOn(voiceId, midiToFreq(midiNum), {
      volume: gain,
      partials: 3,
      at,
    });
    if (bg) return;
    const key = keyByMidiRef.current.get(midiNum);
    if (key) {
      midiUiNoteRef.current = key;
      const cur = midiUiIdsRef.current || new Set(midiActiveIds);
      cur.add(key.id);
      midiUiIdsRef.current = cur;
      midiUiDirtyRef.current = true;
      scheduleMidiUi();
    }
  };

  const handleMidiNoteOff = (midiNum, songT = null, bg = false) => {
    const voiceId = (bg ? "midibg-" : "midi-") + midiNum;
    midiHeldRef.current.delete(voiceId);
    const c = ensureAudio();
    if (songT !== null && c) {
      const at =
        c.currentTime + Math.max(0, songT - (midiPlayerRef.current ? midiPlayerRef.current.getPos() : songT));
      synthRef.current.scheduledOff(voiceId, at, settingsRef.current.release);
    } else {
      synthRef.current.noteOff(voiceId, settingsRef.current.release);
    }
    if (bg) return;
    const key = keyByMidiRef.current.get(midiNum);
    if (key) {
      const cur = midiUiIdsRef.current || new Set(midiActiveIds);
      cur.delete(key.id);
      midiUiIdsRef.current = cur;
      midiUiDirtyRef.current = true;
      scheduleMidiUi();
    }
  };

  const startMidi = (
    speed = midiSpeed,
    track = midiTrack,
    fromPos = midiPosRef.current,
    mix = midiMix
  ) => {
    if (!midi) return;
    const leadIdx = track === "all" ? -1 : Number(track);
    // Pistes jouées : toutes (tutti), la piste seule, ou la piste mise en
    // avant accompagnée des autres en fond.
    const played = midi.tracks
      .map((t, i) => ({ notes: t.notes, bg: leadIdx !== -1 && i !== leadIdx }))
      .filter((t) => !(t.bg && mix === "solo"));
    if (!played.some((t) => !t.bg && t.notes.length)) return;
    const events = [];
    let maxT = 0;
    for (const t of played) {
      for (const n of t.notes) {
        events.push({ t: n.start, on: true, midi: n.midi, velocity: n.velocity, bg: t.bg });
        events.push({ t: n.end, on: false, midi: n.midi, bg: t.bg });
        if (n.end > maxT) maxT = n.end;
      }
    }
    // au même instant, on coupe la note avant d'en rallumer une
    events.sort((a, b) => a.t - b.t || (a.on ? 1 : 0) - (b.on ? 1 : 0));
    // En tutti, la somme des pistes saturerait vite : on divise le gain par
    // la racine du nombre de pistes, le limiteur de sortie fait le reste.
    // En mise en avant, la piste choisie garde son plein volume et
    // l'accompagnement est atténué, divisé lui aussi selon son nombre de pistes.
    const gainScale =
      track === "all" && midi.tracks.length > 1
        ? 1 / Math.sqrt(midi.tracks.length)
        : 1;
    const bgCount = played.filter((t) => t.bg).length;
    const bgScale = bgCount ? BACKGROUND_GAIN / Math.sqrt(bgCount) : 0;
    ensureAudio();
    midiPlayerRef.current = createMidiPlayer(events, maxT, {
      onNoteOn: (m, v, t, ev) =>
        handleMidiNoteOn(m, v, ev && ev.bg ? bgScale : gainScale, t, !!(ev && ev.bg)),
      onNoteOff: (m, t, ev) => handleMidiNoteOff(m, t, !!(ev && ev.bg)),
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

  // Option « pause en arrière-plan » : à l'écran verrouillé ou onglet
  // caché, les timers JS sont gelés et la lecture dérive. Si l'option est
  // cochée, on met en pause et on mémorise la position ; sinon on ne touche
  // à rien, au choix de l'utilisateur. Dans tous les cas, on relâche les notes
  // tenues (évite une note bloquée au retour) et, si rien ne joue, on suspend
  // le contexte audio pour économiser la batterie ; au retour au premier plan
  // (y compris restauration bfcache via pageshow), on relance l'audio.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisibility = () => {
      if (document.hidden) {
        if (pauseOnHiddenRef.current && midiPlayingRef.current) {
          pauseMidiRef.current();
        }
        keyHeld.current.forEach((id) => noteOff(id));
        keyHeld.current.clear();
        pointerHeld.current.forEach((id) => noteOff(id));
        pointerHeld.current.clear();
        if (!midiPlayingRef.current && synthRef.current.active.size === 0) {
          suspendAudio();
        }
      } else {
        ensureAudio();
        setAudioStatus(audioState());
      }
    };
    const onPageShow = (e) => {
      if (e.persisted) {
        ensureAudio();
        setAudioStatus(audioState());
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  // Écran allumé pendant la lecture : sans cela, le téléphone se met en
  // veille au milieu d'un morceau (et coupe le son sur certains appareils).
  // Le verrou est rendu à la pause, et repris au retour au premier plan
  // car le navigateur le relâche quand la page est cachée.
  useEffect(() => {
    if (!midiPlaying || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let lock = null;
    let cancelled = false;
    const acquire = () => {
      if (document.visibilityState !== "visible") return;
      navigator.wakeLock
        .request("screen")
        .then((l) => {
          if (cancelled) l.release().catch(() => {});
          else lock = l;
        })
        .catch(() => {});
    };
    acquire();
    const onVisible = () => {
      if (document.visibilityState === "visible" && (!lock || lock.released)) acquire();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (lock) lock.release().catch(() => {});
    };
  }, [midiPlaying]);

  // Barre de progression : rafraîchie pendant la lecture uniquement.
  useEffect(() => {
    if (!midiPlaying) return;
    const id = setInterval(() => {
      if (midiPlayerRef.current) setMidiProgress(midiPlayerRef.current.getPos());
    }, 200);
    return () => clearInterval(id);
  }, [midiPlaying]);

  // Morceaux intégrés : la liste (appel API GitHub) n'est demandée qu'à la
  // première ouverture du menu, pas au chargement de la page. En cas d'échec
  // (hors ligne, quota), le menu ne s'affiche pas et l'ouverture manuelle
  // d'un fichier reste disponible.
  const loadSongs = () => {
    if (songs !== null) return;
    // Stale-while-revalidate : le cache local s'affiche tout de suite,
    // la liste fraîche arrive ensuite via le callback.
    listBuiltInSongs((list) => setSongs(list)).catch(() => setSongs([]));
  };

  // Changer de piste ou de vitesse garde la position : on poursuit au même
  // endroit du morceau, comme le ferait un lecteur audio.
  const changeMidiTrack = (e) => {
    const track = e.target.value;
    setMidiTrack(track);
    // Piste d'un pupitre reconnu : le clavier suit sa tessiture.
    const voice = track !== "all" && midi ? detectVoice(midi.tracks[Number(track)].name) : null;
    if (voice && voice !== voiceId) {
      setVoiceId(voice);
      setOctave(0);
    }
    if (midiPlaying) {
      pauseMidi();
      startMidi(midiSpeed, track);
    }
  };

  const changeMidiMix = (mix) => {
    setMidiMix(mix);
    if (midiPlaying) {
      pauseMidi();
      startMidi(midiSpeed, midiTrack, midiPosRef.current, mix);
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

  // Au chargement d'un morceau, la piste du pupitre choisi est mise en avant
  // d'emblée (toutes les pistes si aucune ne correspond).
  const initialTrack = (parsed) => {
    const idx = voiceTrackOf(parsed, voiceId);
    return idx >= 0 ? String(idx) : "all";
  };

  // Paroles depuis un fichier local : pour essayer un texte avant de le
  // déposer dans le dépôt, ou pour un MIDI ouvert depuis l'appareil.
  const handleLyricsFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      setLyricsText(await file.text());
    } catch (err) {
      setMidiError("Impossible de lire ce fichier de paroles.");
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
      setMidiTrack(initialTrack(parsed));
      setLyricsText(null);
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
    setLyricsText(null);
    try {
      const song = (songs || []).find((s) => s.name === fileName);
      // MIDI et paroles se chargent en parallèle ; des paroles absentes ou
      // injoignables n'empêchent pas de jouer le morceau.
      const [buffer, text] = await Promise.all([
        fetchBuiltInSong(fileName),
        fetchBuiltInLyrics(song && song.lyricsFile),
      ]);
      const parsed = parseMidi(buffer);
      setMidi({
        name: song ? song.title : fileName,
        duration: parsed.duration,
        tracks: parsed.tracks,
      });
      setMidiTrack(initialTrack(parsed));
      setLyricsText(text);
    } catch (err) {
      setMidi(null);
      setMidiError(String(err && err.message ? err.message : err));
    } finally {
      setSongLoading(null);
    }
  };

  const displayParts = lastNote ? lastNote.solfege.match(/^(.*?)(-?\d+)$/) : null;
  const audioReady = audioStatus === "running";
  const midiPos = midi ? Math.min(midiProgress, midi.duration) : 0;
  const seekPct = midi && midi.duration > 0 ? (midiPos / midi.duration) * 100 : 0;
  const currentPos = () =>
    midiPlayerRef.current ? midiPlayerRef.current.getPos() : midiProgress;
  const canResume = midi && midiProgress > 0.05 && midiProgress < midi.duration - 0.05;

  // Piste suivie par les paroles : la piste choisie, ou celle du pupitre
  // quand toutes les pistes jouent.
  const focusTrack = midi
    ? midiTrack !== "all"
      ? Number(midiTrack)
      : voiceTrackOf(midi, voiceId)
    : -1;
  const lyrics = useMemo(
    () => buildLyrics(midi, lyricsText, focusTrack),
    [midi, lyricsText, focusTrack]
  );
  const focusTrackName = midi && focusTrack >= 0 ? midi.tracks[focusTrack].name : null;
  const voiceLabel = (name) => {
    const v = detectVoice(name);
    const t = v && TESSITURES.find((x) => x.id === v);
    return t ? t.label : null;
  };
  // Pupitre et nom de piste, sans répéter « Ténor · Ténor » quand ils coïncident.
  const trackLabel = (name) => {
    const label = voiceLabel(name);
    return label && normalizeName(label) !== normalizeName(name) ? `${name} · ${label}` : name;
  };

  return (
    <div
      className={`piano-app ${isWide ? "layout-wide" : "layout-narrow"}`}
      ref={rootRef}
    >
      {/* ---- Barre supérieure : identité, état du son, plein écran ---- */}
      <header className="topbar">
        <div className="brand">
          <Logo size={30} />
          <div className="brand-text">
            <h1>Mini Piano</h1>
            <span className="brand-tag">l'outil des choristes</span>
          </div>
        </div>
        <div className="topbar-actions">
          <button
            type="button"
            className={`audio-pill audio-${audioStatus}`}
            role="status"
            aria-live="polite"
            onClick={() => {
              ensureAudio();
              setAudioStatus(audioState());
            }}
          >
            <span className="audio-dot" aria-hidden="true" />
            {audioReady ? "Son actif" : audioStatus === "idle" ? "Activer le son" : "Son en veille"}
          </button>
          {fsAvailable && (
            <button
              type="button"
              className="icon-btn"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
              title={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
            >
              {isFullscreen ? <ShrinkIcon /> : <ExpandIcon />}
            </button>
          )}
        </div>
      </header>

      {/* ---- Scène : note jouée + choix du pupitre et de l'octave ---- */}
      <section className="stage">
        <div className={`readout${lastNote ? "" : " is-empty"}`} aria-live="polite">
          {displayParts ? (
            <>
              <span className="readout-note" key={lastNote.id}>
                {displayParts[1]}
                <sub>{displayParts[2]}</sub>
              </span>
              <span className="readout-meta">
                <span>{lastNote.name}</span>
                <span className="readout-sep" aria-hidden="true">·</span>
                <span>{midiToFreq(lastNote.midi).toFixed(1)} Hz</span>
              </span>
            </>
          ) : (
            <span className="readout-hint">
              {audioReady
                ? "Touchez une touche pour entendre la note"
                : "Touchez une touche pour activer le son, puis jouez"}
            </span>
          )}
        </div>

        <div className="range-controls">
          <div className="segmented" role="radiogroup" aria-label="Pupitre">
            {TESSITURES.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={t.id === voiceId}
                className={t.id === voiceId ? "is-selected" : ""}
                onClick={() => chooseVoice(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="octave">
            <button
              type="button"
              className="step-btn"
              onClick={() => shiftOctave(-1)}
              disabled={octave <= -2}
              aria-label="Octave en dessous"
            >
              <MinusIcon size={18} />
            </button>
            <div className="octave-info">
              <span className="octave-label">
                Octave {octave === 0 ? "" : octave > 0 ? `+${octave}` : octave}
              </span>
              <span className="octave-range">{rangeText}</span>
            </div>
            <button
              type="button"
              className="step-btn"
              onClick={() => shiftOctave(1)}
              disabled={octave >= 2}
              aria-label="Octave au-dessus"
            >
              <PlusIcon size={18} />
            </button>
          </div>
        </div>
      </section>

      <Piano
        keys={keys}
        activeIds={midiActiveIds.size ? new Set([...activeIds, ...midiActiveIds]) : activeIds}
        onNoteOn={handlePointerOn}
        onNoteOff={handlePointerOff}
      />

      <p className="kbd-hint">
        Clavier d'ordinateur : rangée <kbd>Q</kbd>…<kbd>B</kbd> pour les blanches,
        rangée du dessus pour les noires.
      </p>

      {/* ---- Paroles du morceau, synchronisées avec la lecture ---- */}
      {midi && (lyrics || lyricsText) && (
        <section className="panel panel-lyrics" aria-labelledby="lyrics-title">
          <div className="panel-head">
            <button
              type="button"
              className={`mini-play${midiPlaying ? " is-playing" : ""}`}
              onClick={toggleMidi}
              aria-label={midiPlaying ? "Pause" : "Lire"}
            >
              {midiPlaying ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
            </button>
            <h2 id="lyrics-title" className="panel-title">Paroles</h2>
            {focusTrackName && (
              <span className="panel-sub">
                {voiceLabel(focusTrackName) && normalizeName(voiceLabel(focusTrackName)) === normalizeName(focusTrackName)
                  ? focusTrackName
                  : `${voiceLabel(focusTrackName) || "Piste"} · ${focusTrackName}`}
              </span>
            )}
          </div>
          {lyrics ? (
            <>
              <Lyrics
                lyrics={lyrics}
                playing={midiPlaying}
                getPos={currentPos}
                progress={midiProgress}
                onSeek={seekMidi}
              />
              {lyrics.source === "file" && (lyrics.unusedNotes > 0 || lyrics.missingNotes > 0) && (
                <p className="lyrics-check">
                  {lyrics.missingNotes > 0
                    ? `Alignement : ${lyrics.missingNotes} syllabe${lyrics.missingNotes > 1 ? "s" : ""} de plus que de notes dans la piste.`
                    : `Alignement : ${lyrics.unusedNotes} note${lyrics.unusedNotes > 1 ? "s" : ""} de la piste sans syllabe à la fin du texte.`}{" "}
                  ({lyrics.syllableCount} syllabes, {lyrics.noteCount} notes)
                </p>
              )}
            </>
          ) : (
            <p className="midi-empty">
              {focusTrackName
                ? `Pas de paroles pour la piste « ${focusTrackName} ».`
                : "Choisissez une piste pour afficher ses paroles."}{" "}
              Paroles disponibles pour : {lyricsSectionNames(lyricsText).join(", ") || "—"}.
            </p>
          )}
        </section>
      )}

      {/* ---- Panneaux : son et lecture MIDI ---- */}
      <div className="panels">
        <section className="panel panel-sound" aria-labelledby="sound-title">
          <h2 id="sound-title" className="panel-title">Son</h2>
          <label className="slider">
            <span className="slider-head">
              <VolumeIcon size={18} />
              <span className="slider-name">Volume</span>
              <span className="slider-value">{Math.round(volume * 100)} %</span>
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              style={{ "--fill": `${volume * 100}%` }}
              onChange={(e) => setVolume(Number(e.target.value))}
            />
          </label>
          <label className="slider">
            <span className="slider-head">
              <SustainIcon size={18} />
              <span className="slider-name">Résonance</span>
              <span className="slider-value">{release.toFixed(2).replace(".", ",")} s</span>
            </span>
            <input
              type="range"
              min="0.05"
              max="1.5"
              step="0.05"
              value={release}
              style={{ "--fill": `${((release - 0.05) / 1.45) * 100}%` }}
              onChange={(e) => setRelease(Number(e.target.value))}
            />
          </label>
        </section>

        <section className="panel panel-midi" aria-labelledby="midi-title">
          <h2 id="midi-title" className="panel-title">S'entraîner sur un morceau</h2>

          <div className="source-row">
            <div className="select-wrap">
              <NoteIcon size={18} />
              {songs !== null && songs.length > 0 ? (
                <select
                  value={selectedSong}
                  onChange={chooseBuiltInSong}
                  aria-label="Morceaux intégrés"
                >
                  <option value="">Morceaux intégrés…</option>
                  {songs.map((s) => (
                    <option key={s.name} value={s.name}>
                      {s.title}
                      {s.lyricsFile ? " · paroles" : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  onFocus={loadSongs}
                  onClick={loadSongs}
                  onPointerDown={loadSongs}
                  disabled={songs !== null && songs.length === 0}
                  aria-label="Morceaux intégrés"
                >
                  <option>
                    {songs !== null && songs.length === 0
                      ? "Morceaux indisponibles"
                      : "Morceaux intégrés…"}
                  </option>
                </select>
              )}
            </div>
            <label className="file-btn" title="Ouvrir un fichier MIDI">
              <FileIcon size={18} />
              <span>Fichier MIDI</span>
              <input
                type="file"
                accept=".mid,.midi,audio/midi"
                hidden
                onChange={handleMidiFile}
              />
            </label>
          </div>

          {songLoading && (
            <p className="midi-status">
              <span className="spinner" aria-hidden="true" /> Chargement du morceau…
            </p>
          )}
          {midiError && <p className="midi-status midi-error">{midiError}</p>}

          {!midi && !songLoading && !midiError && (
            <p className="midi-empty">
              Choisissez un morceau puis votre pupitre : les touches s'illuminent en rythme.
            </p>
          )}

          {midi && (
            <div className="player">
              <div className="player-title">
                <span className="player-name">{midi.name}</span>
                <label
                  className="chip-btn"
                  title="Charger un fichier de paroles (.txt) pour ce morceau"
                >
                  <LyricsIcon size={16} />
                  <span>{lyrics || lyricsText ? "Autres paroles…" : "Ajouter des paroles"}</span>
                  <input
                    type="file"
                    accept=".txt,text/plain"
                    hidden
                    onChange={handleLyricsFile}
                  />
                </label>
              </div>

              <div className="seek">
                <input
                  type="range"
                  min="0"
                  max={midi.duration}
                  step="0.1"
                  value={midiPos}
                  style={{ "--fill": `${seekPct}%` }}
                  onChange={(e) => seekMidi(Number(e.target.value))}
                  aria-label="Position dans le morceau"
                />
                <div className="seek-times">
                  <span>{formatMidiTime(midiPos)}</span>
                  <span>{formatMidiTime(midi.duration)}</span>
                </div>
              </div>

              <div className="transport">
                <button
                  type="button"
                  className="transport-btn"
                  onClick={() => seekMidi(currentPos() - 10)}
                  aria-label="Reculer de 10 secondes"
                >
                  <Back10Icon size={24} />
                </button>
                <button
                  type="button"
                  className={`play-btn${midiPlaying ? " is-playing" : ""}`}
                  onClick={toggleMidi}
                  aria-label={midiPlaying ? "Pause" : canResume ? "Reprendre" : "Lire"}
                >
                  {midiPlaying ? <PauseIcon size={26} /> : <PlayIcon size={26} />}
                </button>
                <button
                  type="button"
                  className="transport-btn"
                  onClick={() => seekMidi(currentPos() + 10)}
                  aria-label="Avancer de 10 secondes"
                >
                  <Fwd10Icon size={24} />
                </button>
              </div>

              <div className="player-options">
                <label className="field">
                  <span className="field-label">Piste</span>
                  <span className="select-wrap select-sm">
                    <select value={midiTrack} onChange={changeMidiTrack}>
                      <option value="all">Toutes les pistes</option>
                      {midi.tracks.map((t, i) => (
                        <option key={i} value={String(i)}>
                          {trackLabel(t.name)} ({t.notes.length})
                        </option>
                      ))}
                    </select>
                  </span>
                </label>
                {midiTrack !== "all" && midi.tracks.length > 1 && (
                  <div className="field">
                    <span className="field-label" id="mix-label">Autres pistes</span>
                    <div className="segmented segmented-sm" role="radiogroup" aria-labelledby="mix-label">
                      <button
                        type="button"
                        role="radio"
                        aria-checked={midiMix === "lead"}
                        className={midiMix === "lead" ? "is-selected" : ""}
                        onClick={() => changeMidiMix("lead")}
                        title="La piste choisie domine, les autres restent audibles plus doucement"
                      >
                        En fond
                      </button>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={midiMix === "solo"}
                        className={midiMix === "solo" ? "is-selected" : ""}
                        onClick={() => changeMidiMix("solo")}
                        title="Seule la piste choisie est jouée"
                      >
                        Coupées
                      </button>
                    </div>
                  </div>
                )}
                <div className="field">
                  <span className="field-label" id="speed-label">Vitesse</span>
                  <div className="segmented segmented-sm" role="radiogroup" aria-labelledby="speed-label">
                    {[0.5, 0.75, 1, 1.25, 1.5].map((s) => (
                      <button
                        key={s}
                        type="button"
                        role="radio"
                        aria-checked={midiSpeed === s}
                        className={midiSpeed === s ? "is-selected" : ""}
                        onClick={() => changeMidiSpeed({ target: { value: s } })}
                      >
                        ×{String(s).replace(".", ",")}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <label className="toggle">
                <input
                  type="checkbox"
                  checked={pauseOnHidden}
                  onChange={(e) => setPauseOnHidden(e.target.checked)}
                />
                <span className="toggle-track" aria-hidden="true">
                  <span className="toggle-thumb" />
                </span>
                <span>Mettre en pause quand l'écran se verrouille</span>
              </label>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
