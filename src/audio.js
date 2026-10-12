// Synthèse type piano : partiels harmoniques avec inharmonicité légère,
// attaque percussive et décrément naturel (graves plus longs que les aigus).
let ctx = null;
let masterBus = null;
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
  // Uniquement iOS : le commutateur de sonnerie y coupe Web Audio. Ailleurs
  // (Android, desktop) il ne ferait qu'occuper un pipeline média pour rien.
  const isIOS =
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!isIOS) return;
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
      // Bus de sortie : limiteur doux (compresseur à fort ratio) qui garde
      // le signal sous 0 dB même quand des dizaines de voix se superposent.
      // Sans lui, un tutti orchestral sature durement (grésillement) et le
      // moteur audio peut s'effondrer sur mobile.
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -12;
      limiter.knee.value = 24;
      limiter.ratio.value = 8;
      limiter.attack.value = 0.005;
      limiter.release.value = 0.35;
      masterBus = ctx.createGain();
      masterBus.gain.value = 0.9;
      masterBus.connect(limiter);
      limiter.connect(ctx.destination);
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

// Bruit d'attaque du marteau : court éclat de bruit filtré passe-bande,
// mélangé brièvement au début de la note. C'est lui qui donne le caractère
// percussif « piano » qui manque à une synthèse purement sinusoïdale.
let noiseBuffer = null;

// Partiels typiques d'une corde de piano. Chaque partiel reçoit sa propre
// enveloppe : les harmoniques aigus s'éteignent nettement plus vite que la
// fondamentale (decayFactor, fraction du decay de la note).
const PARTIALS = [
  { ratio: 1.0, gain: 1.0, decayFactor: 1.0 },
  { ratio: 2.0, gain: 0.42, decayFactor: 0.7 },
  { ratio: 3.0, gain: 0.2, decayFactor: 0.5 },
  { ratio: 4.0, gain: 0.1, decayFactor: 0.35 },
  { ratio: 5.0, gain: 0.05, decayFactor: 0.25 },
];

export class Synth {
  constructor() {
    this.active = new Map();
    // Plafond de polyphonie : au-delà, on vole la voix la plus ancienne.
    // Les tutti orchestraux (fichiers MIDI complets) dépassent vite les
    // capacités d'un mobile, jusqu'au grésillement voire au crash.
    this.maxVoices = 32;
  }

  noteOn(id, freq, { volume = 0.6, partials = PARTIALS.length } = {}) {
    if (this.active.has(id)) return true;
    const c = ensureAudio();
    if (!c) return false;
    const now = c.currentTime;

    // Vol de voix : la Map conserve l'ordre d'insertion, la plus ancienne
    // passe la première. Un fondu très court évite les claquements.
    while (this.active.size >= this.maxVoices) {
      const oldest = this.active.keys().next().value;
      this.noteOff(oldest, 0.12);
    }

    const master = c.createGain();
    const peak = Math.max(0.001, volume);

    // Les notes aiguës s'éteignent plus vite que les graves
    const decayTime = Math.min(6, Math.max(1.2, 880 / freq));

    // Filtre passe-bas dynamique : la brillance décroît au cours de la
    // note, comme une corde réelle dont les harmoniques s'éteignent.
    const tone = c.createBiquadFilter();
    tone.type = "lowpass";
    tone.Q.value = 0.5;
    const bright = Math.min(18000, Math.max(2200, freq * 8));
    tone.frequency.setValueAtTime(bright, now);
    tone.frequency.setTargetAtTime(Math.max(800, freq * 2.5), now, decayTime / 4);
    tone.connect(master);

    // Enveloppe : attaque quasi instantanée (3 ms), puis décrément
    // exponentiel naturel. Les partiels et le marteau passent par le
    // filtre dynamique, la sortie reste sur le bus master.
    master.gain.setValueAtTime(0, now);
    master.gain.linearRampToValueAtTime(peak, now + 0.003);
    master.gain.setTargetAtTime(Math.max(peak * 0.18, 0.001), now + 0.003, decayTime / 4);

    // Bruit d'attaque du marteau : court éclat large bande filtré autour
    // de la frappe, effacé en quelques dizaines de millisecondes.
    if (!noiseBuffer) {
      const len = Math.max(1, Math.floor(c.sampleRate * 0.05));
      noiseBuffer = c.createBuffer(1, len, c.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    try {
      const noise = c.createBufferSource();
      noise.buffer = noiseBuffer;
      const noiseFilter = c.createBiquadFilter();
      noiseFilter.type = "bandpass";
      noiseFilter.frequency.value = Math.min(9000, Math.max(150, freq * 3));
      noiseFilter.Q.value = 0.8;
      const noiseGain = c.createGain();
      // Le marteau est plus présent dans les forts et dans les aigus
      const noisePeak = Math.min(0.5, peak * (0.25 + 110 / freq));
      // Montée très courte (1,5 ms) : un démarrage à pleine amplitude
      // produit un clic audible à chaque note.
      noiseGain.gain.setValueAtTime(0, now);
      noiseGain.gain.linearRampToValueAtTime(noisePeak, now + 0.0015);
      noiseGain.gain.setTargetAtTime(0.0001, now + 0.0015, 0.012);
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(tone);
      noise.start(now);
      noise.stop(now + 0.15);
    } catch (err) {
      /* attaque ignorée */
    }

    const oscs = [];
    // Rendu allégé possible : la lecture MIDI peut demander moins de partiels
    // (3 suffisent pour se caler), ce qui soulage nettement le processeur
    // sur mobile en tutti.
    PARTIALS.slice(0, Math.max(1, Math.min(PARTIALS.length, partials))).forEach((p, i) => {
      try {
        const osc = c.createOscillator();
        osc.type = "sine";
        // Inharmonicité légère + léger désaccord du partiel 2 : les cordes
        // d'un piano réel sont légèrement désaccordées entre elles.
        const f = freq * p.ratio * (1 + i * 0.0008) * (i === 1 ? 1.0011 : 1);
        osc.frequency.value = f;
        const g = c.createGain();
        // Les harmoniques aigus s'atténuent dans les notes hautes
        const pg = p.gain * (i === 0 ? 1 : Math.min(1, 220 / f + 0.35));
        g.gain.value = pg;
        // Enveloppe propre à chaque partiel : les harmoniques s'éteignent
        // plus vite que la fondamentale (décroissance sélective).
        const pDecay = decayTime * (p.decayFactor || 1);
        g.gain.setValueAtTime(pg, now);
        g.gain.setTargetAtTime(Math.max(0.0001, pg * 0.15), now + 0.003, Math.max(0.15, pDecay / 4));
        osc.connect(g);
        g.connect(tone);
        osc.start(now);
        oscs.push(osc);
      } catch (err) {
        /* partiel ignoré */
      }
    });

    master.connect(masterBus || c.destination);
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
      // Valeur courante recalculée analytiquement : l'enveloppe étant
      // déterministe (attaque 3 ms puis décrément exponentiel), on la
      // reconstruit plutôt que de lire param.value — que certains moteurs
      // renvoient périmé par rapport à l'automatisation, ou qui retombe
      // sur une valeur obsolète après cancelScheduledValues (Firefox),
      // provoquant un saut audible (clic) en début de release.
      const floor = Math.max(v.peak * 0.18, 0.001);
      const tau = Math.max(0.05, v.decayTime / 4);
      const elapsed = t - v.startedAt;
      let cur;
      if (elapsed <= 0.003) {
        cur = v.peak * Math.max(0, elapsed / 0.003);
      } else {
        cur = floor + (v.peak - floor) * Math.exp(-(elapsed - 0.003) / tau);
      }
      cur = Math.max(cur, 0.0001);
      param.cancelScheduledValues(t);
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
