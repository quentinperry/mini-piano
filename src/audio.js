// Synthèse type piano : partiels harmoniques avec inharmonicité légère,
// attaque percussive et décrément naturel (graves plus longs que les aigus).
let ctx = null;
let silentEl = null;

// Génère un WAV d'une seconde de silence (8 kHz, 8 bits) sans fichier externe.
function makeSilentWavUrl() {
  const sampleRate = 8000;
  const n = sampleRate;
  const buf = new ArrayBuffer(44 + n);
  const view = new DataView(buf);
  const w = (off, s) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  w(0, "RIFF");
  view.setUint32(4, 36 + n, true);
  w(8, "WAVE");
  w(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  w(36, "data");
  view.setUint32(40, n, true);
  for (let i = 0; i < n; i++) view.setUint8(44 + i, 128);
  return URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
}

// Contournement du mode silencieux iOS : Web Audio est coupé quand le
// commutateur de sonnerie est en position silencieuse. La lecture d'un
// élément média (ici une seconde de silence en boucle, quasi inaudible)
// bascule la session audio en mode « lecture », qui ignore ce commutateur.
// Sans effet sur les navigateurs qui ne mute pas Web Audio (Android, desktop).
function bypassSilentSwitch() {
  try {
    if (!silentEl) {
      silentEl = document.createElement("audio");
      silentEl.src = makeSilentWavUrl();
      silentEl.loop = true;
      silentEl.preload = "auto";
      silentEl.setAttribute("playsinline", "true");
    }
    const p = silentEl.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  } catch (err) {
    /* rien : le mode silencieux ne pourra pas être contourné */
  }
}

// Crée (ou réveille) le contexte audio. À appeler dans un geste utilisateur.
// Renvoie le contexte, ou null si l'audio est indisponible.
export function ensureAudio() {
  if (!ctx) {
    try {
      // Profil "interactive" : tampons de sortie les plus courts possible,
      // pour minimiser la latence entre l'appui et le son.
      ctx = new window.AudioContext({ latencyHint: "interactive" });
    } catch (err) {
      ctx = null;
      return null;
    }
  }
  if (ctx.state !== "running") {
    try {
      const p = ctx.resume();
      if (p && typeof p.catch === "function") p.catch(() => {});
    } catch (err) {
      /* rien */
    }
  }
  bypassSilentSwitch();
  return ctx;
}

export function audioState() {
  return ctx ? ctx.state : "absent";
}

// Partiels typiques d'une corde de piano : fondamentale dominante,
// harmoniques décroissants, très légèrement étirés (inharmonicité).
const PARTIALS = [
  { ratio: 1.0, gain: 1.0 },
  { ratio: 2.0, gain: 0.42 },
  { ratio: 3.0, gain: 0.2 },
  { ratio: 4.0, gain: 0.1 },
  { ratio: 5.0, gain: 0.05 },
];

export class Synth {
  constructor() {
    this.active = new Map();
  }

  noteOn(id, freq, { volume = 0.6 } = {}) {
    if (this.active.has(id)) return true;
    const c = ensureAudio();
    if (!c) return false;
    const now = c.currentTime;

    const master = c.createGain();
    const peak = Math.max(0.001, volume);

    // Les notes aiguës s'éteignent plus vite que les graves
    const decayTime = Math.min(6, Math.max(1.2, 880 / freq));

    // Enveloppe : attaque quasi instantanée (3 ms), puis décrément exponentiel naturel
    master.gain.setValueAtTime(0, now);
    master.gain.linearRampToValueAtTime(peak, now + 0.003);
    master.gain.setTargetAtTime(Math.max(peak * 0.18, 0.001), now + 0.003, decayTime / 4);

    const oscs = [];
    PARTIALS.forEach((p, i) => {
      try {
        const osc = c.createOscillator();
        osc.type = "sine";
        const f = freq * p.ratio * (1 + i * 0.0008); // inharmonicité légère
        osc.frequency.value = f;
        const g = c.createGain();
        // Les harmoniques aigus s'atténuent dans les notes hautes
        g.gain.value = p.gain * (i === 0 ? 1 : Math.min(1, 220 / f + 0.35));
        osc.connect(g);
        g.connect(master);
        osc.start(now);
        oscs.push(osc);
      } catch (err) {
        /* partiel ignoré */
      }
    });

    master.connect(c.destination);
    // Filet de sécurité : on coupe tout après la queue naturelle
    oscs.forEach((o) => {
      try {
        o.stop(now + decayTime + 8);
      } catch (err) {
        /* rien */
      }
    });

    this.active.set(id, { master, oscs, startedAt: now, peak, decayTime });
    return c.state === "running";
  }

  noteOff(id, release = 0.25) {
    const v = this.active.get(id);
    if (!v) return;
    this.active.delete(id);
    const c = ensureAudio();
    if (!c) return;
    const t = c.currentTime;
    const rel = Math.max(0.05, release);
    const param = v.master.gain;
    try {
      // Gèle l'automatisation à sa valeur courante si possible
      if (typeof param.cancelAndHoldAtTime === "function") {
        param.cancelAndHoldAtTime(t);
      } else {
        param.cancelScheduledValues(t);
      }
      const cur = Math.max(param.value, 0.0001);
      param.setValueAtTime(cur, t);
      param.setTargetAtTime(0.0001, t, rel / 5);
    } catch (err) {
      /* rien */
    }
    v.oscs.forEach((o) => {
      try {
        o.stop(t + rel + 0.5);
      } catch (err) {
        /* déjà arrêté */
      }
    });
  }

  stopAll(release = 0.1) {
    Array.from(this.active.keys()).forEach((id) => this.noteOff(id, release));
  }
}
