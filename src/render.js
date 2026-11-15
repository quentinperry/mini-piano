// Préparation d'un morceau en fichier audio, sur l'appareil.
//
// iOS interrompt le moteur audio d'une page web dès qu'elle passe en
// arrière-plan (autre app, écran verrouillé) ; seule la lecture d'un fichier
// audio par un élément <audio> continue, comme un lecteur de musique. On
// « enregistre » donc le morceau tel qu'il sonnerait (piste mise en avant,
// autres pistes en fond, vitesse, timbre, réverbération), bien plus vite que
// le temps réel, puis on le joue comme une chanson. Tout est calculé sur
// l'appareil : rien ne transite par le réseau.

import { sampleFor, loadPiano, pianoStatus } from "./piano";
import { SAMPLE_GAIN } from "./audio";

// Au plus ~12 millions d'échantillons (≈ 48 Mo pendant le calcul) : la
// fréquence d'échantillonnage s'adapte à la durée, 32 kHz au mieux (bien
// au-delà de ce que restitue un haut-parleur de téléphone pour un piano).
const MAX_FRAMES = 12e6;

// notes : [{ start, end, midi, gain }] en secondes « morceau » ;
// options : { speed, release, timbre: "piano" | "synth", liveCtx }
//
// Tout est calculé directement dans un tableau d'échantillons : lecture
// interpolée des échantillons de piano (ou trois partiels pour le synthé),
// puis réverbération et limiteur. Passer par un OfflineAudioContext était
// bien plus lent (≈ 2 min pour 2 700 notes : chaque note programmée reste
// dans le circuit audio pendant tout le calcul). Résultat : { data, rate }.
export async function renderPerformance(notes, duration, { speed = 1, release = 0.35, timbre = "piano", liveCtx = null } = {}) {
  if (timbre === "piano" && pianoStatus() !== "ready" && liveCtx) {
    // échantillons pas encore là : on attend leur chargement (quelques s)
    await Promise.race([loadPiano(liveCtx), new Promise((r) => setTimeout(r, 15000))]);
  }
  const rel = Math.max(0.05, release);
  const realDur = duration / speed + Math.max(1.5, rel + 1.2);
  const rate = Math.max(16000, Math.min(32000, Math.floor(MAX_FRAMES / realDur)));
  const frames = Math.ceil(realDur * rate);
  const mix = new Float32Array(frames);

  const attack = Math.max(1, Math.round(0.002 * rate));
  const relDecay = Math.exp(-1 / ((rel / 5) * rate)); // décroissance par échantillon
  const relLen = Math.round((rel + 0.3) * rate);

  let k = 0;
  for (const n of notes) {
    // rend la main au navigateur de temps en temps (interface fluide)
    if (++k % 200 === 0) await new Promise((r) => setTimeout(r, 0));
    const i0 = Math.round((n.start / speed) * rate);
    if (i0 >= frames) continue;
    const iOff = Math.max(i0 + Math.round(0.03 * rate), Math.round((n.end / speed) * rate));
    const iEnd = Math.min(frames, iOff + relLen);
    const smp = timbre === "piano" ? sampleFor(n.midi) : null;
    if (smp) {
      const data = smp.buffer.getChannelData(0);
      const len = data.length - 1;
      const step = (smp.rate * smp.buffer.sampleRate) / rate;
      const peak = n.gain * SAMPLE_GAIN;
      let pos = 0;
      let env = 0;
      for (let i = i0; i < iEnd; i++, pos += step) {
        const j = pos | 0;
        if (j >= len) break;
        const d = i - i0;
        if (d < attack) env = d / attack;
        else if (i < iOff) env = 1;
        else env *= relDecay;
        const f = pos - j;
        mix[i] += (data[j] + (data[j + 1] - data[j]) * f) * env * peak;
      }
    } else {
      // synthèse allégée : trois partiels, décrément naturel vers un plancher
      const freq = 440 * Math.pow(2, (n.midi - 69) / 12);
      const peak = n.gain;
      const decay = Math.min(6, Math.max(1.2, 880 / freq));
      const floor = 0.18;
      const dk = Math.exp(-1 / ((decay / 4) * rate));
      const amps = [1, 0.42, 0.2].map((a, h) => (h === 0 ? a : a * Math.min(1, 220 / (freq * (h + 1)) + 0.35)));
      // oscillateurs par rotation (pas de sinus recalculé à chaque échantillon)
      const w = (2 * Math.PI * freq) / rate;
      const c1 = Math.cos(w), s1 = Math.sin(w);
      const c2 = Math.cos(2 * w), s2 = Math.sin(2 * w);
      const c3 = Math.cos(3 * w), s3 = Math.sin(3 * w);
      let x1 = 1, y1 = 0, x2 = 1, y2 = 0, x3 = 1, y3 = 0;
      let body = 1; // part au-dessus du plancher, décroissante
      let env = 0;
      for (let i = i0; i < iEnd; i++) {
        const d = i - i0;
        if (d < attack) env = d / attack;
        else if (i < iOff) {
          body *= dk;
          env = floor + (1 - floor) * body;
        } else env *= relDecay;
        mix[i] += (amps[0] * y1 + amps[1] * y2 + amps[2] * y3) * env * peak;
        let t = x1 * c1 - y1 * s1; y1 = x1 * s1 + y1 * c1; x1 = t;
        t = x2 * c2 - y2 * s2; y2 = x2 * s2 + y2 * c2; x2 = t;
        t = x3 * c3 - y3 * s3; y3 = x3 * s3 + y3 * c3; x3 = t;
      }
    }
  }

  await new Promise((r) => setTimeout(r, 0));
  reverbInPlace(mix, rate, 0.22);
  limitInPlace(mix, rate);
  return { data: mix, rate };
}

// Réverbération de salle légère (filtres en peigne amortis + passe-tout,
// à la manière de Freeverb), ajoutée au son direct.
function reverbInPlace(x, rate, wetGain) {
  const k = rate / 44100;
  const combs = [1116, 1188, 1277, 1356].map((n) => ({
    buf: new Float32Array(Math.round(n * k)), i: 0, store: 0,
  }));
  const aps = [556, 441].map((n) => ({ buf: new Float32Array(Math.round(n * k)), i: 0 }));
  const feedback = 0.8, damp = 0.3, apg = 0.5;
  const n = x.length;
  for (let t = 0; t < n; t++) {
    const input = x[t] * 0.25;
    let acc = 0;
    for (let c = 0; c < 4; c++) {
      const cb = combs[c];
      const y = cb.buf[cb.i];
      cb.store = y * (1 - damp) + cb.store * damp;
      cb.buf[cb.i] = input + cb.store * feedback;
      if (++cb.i >= cb.buf.length) cb.i = 0;
      acc += y;
    }
    for (let a = 0; a < 2; a++) {
      const ap = aps[a];
      const b = ap.buf[ap.i];
      ap.buf[ap.i] = acc + b * apg;
      acc = b - acc * apg;
      if (++ap.i >= ap.buf.length) ap.i = 0;
    }
    x[t] = x[t] * 0.9 + acc * wetGain;
  }
}

// Limiteur doux : au-delà de -12 dB, le niveau est fortement comprimé
// (taux 8), attaque 5 ms, relâchement 350 ms ; plafond de sécurité à 0 dB.
function limitInPlace(x, rate) {
  const thr = Math.pow(10, -12 / 20);
  const ratio = 8;
  const att = Math.exp(-1 / (0.005 * rate));
  const relc = Math.exp(-1 / (0.35 * rate));
  let env = 0;
  for (let t = 0; t < x.length; t++) {
    const a = Math.abs(x[t]);
    env = a > env ? a + (env - a) * att : a + (env - a) * relc;
    let g = 1;
    if (env > thr) g = (thr + (env - thr) / ratio) / env;
    let y = x[t] * g;
    if (y > 0.99) y = 0.99;
    else if (y < -0.99) y = -0.99;
    x[t] = y;
  }
}

// Échantillons -> fichier WAV 16 bits mono (Blob), lisible partout, iPhone compris.
export function bufferToWav({ data, rate }) {
  const out = new ArrayBuffer(44 + data.length * 2);
  const v = new DataView(out);
  const w = (off, s) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  };
  w(0, "RIFF");
  v.setUint32(4, 36 + data.length * 2, true);
  w(8, "WAVE");
  w(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, "data");
  v.setUint32(40, data.length * 2, true);
  let off = 44;
  for (let i = 0; i < data.length; i++, off += 2) {
    const s = Math.max(-1, Math.min(1, data[i]));
    v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([out], { type: "audio/wav" });
}

// Lecteur « fichier audio » au même usage que le lecteur MIDI : position,
// vitesse, saut, pause. Les touches et les paroles suivent la position du
// fichier : une boucle d'animation rejoue les événements visuels (allumage
// et extinction des touches) au fil de la lecture, et rattrape d'un coup
// au retour au premier plan.
export function createAudioPlayer(el, events, duration, speed, { onNoteOn, onNoteOff, onReset, onEnd }) {
  let idx = 0;
  let last = 0;
  let raf = null;
  let ended = false;

  const getPos = () => Math.min(duration, el.currentTime * speed);

  const lowerBound = (pos) => {
    let lo = 0, hi = events.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (events[mid].t < pos) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };

  // état visuel exact à une position donnée (après un saut)
  const rebuild = (pos) => {
    onReset();
    const on = new Map();
    for (let i = 0; i < events.length && events[i].t <= pos; i++) {
      const ev = events[i];
      const k = ev.midi + (ev.bg ? "bg" : "");
      if (ev.on) on.set(k, ev);
      else on.delete(k);
    }
    for (const ev of on.values()) onNoteOn(ev.midi, ev.velocity, ev.t, ev);
    idx = lowerBound(pos + 1e-6);
    last = pos;
  };

  const tick = () => {
    raf = requestAnimationFrame(tick);
    const pos = getPos();
    if (pos + 0.05 < last) {
      rebuild(pos);
      return;
    }
    while (idx < events.length && events[idx].t <= pos) {
      const ev = events[idx++];
      if (ev.on) onNoteOn(ev.midi, ev.velocity, ev.t, ev);
      else onNoteOff(ev.midi, ev.t, ev);
    }
    last = pos;
  };

  const handleEnded = () => {
    if (ended) return;
    ended = true;
    stopLoop();
    onEnd();
  };
  el.addEventListener("ended", handleEnded);

  const stopLoop = () => {
    if (raf !== null) cancelAnimationFrame(raf);
    raf = null;
  };

  return {
    play(_speed, from = 0) {
      ended = false;
      el.currentTime = Math.min(Math.max(from, 0), duration) / speed;
      rebuild(getPos());
      const p = el.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
      stopLoop();
      raf = requestAnimationFrame(tick);
    },
    seek(to) {
      el.currentTime = Math.min(Math.max(to, 0), duration) / speed;
      rebuild(getPos());
    },
    stop() {
      stopLoop();
      el.pause();
      el.removeEventListener("ended", handleEnded);
    },
    getPos,
    getSpeed: () => speed,
    flushAhead() {},
    resync() {
      if (!el.paused) rebuild(getPos());
    },
  };
}
