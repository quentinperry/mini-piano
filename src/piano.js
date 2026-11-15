// Échantillons de piano (Salamander Grand Piano, Yamaha C5 enregistré par
// Alexander Holm, CC BY 3.0) : une note toutes les tierces mineures, du La1
// au Do7. Les notes intermédiaires sont obtenues en transposant
// l'échantillon le plus proche (au plus 1,5 demi-ton), ce qui garde un
// timbre naturel. Les fichiers (≈ 0,9 Mo) ne sont téléchargés qu'à la
// première utilisation, puis gardés hors ligne par le service worker.

const BASE = (import.meta.env && import.meta.env.BASE_URL) || "/";
const NAMES = { 0: "C", 3: "Ds", 6: "Fs", 9: "A" };
const SAMPLE_MIDIS = [33];
for (let m = 36; m <= 96; m += 3) SAMPLE_MIDIS.push(m);

const buffers = new Map(); // midi de l'échantillon -> AudioBuffer
let loading = null;
const listeners = new Set();

function fileFor(midi) {
  return `${BASE}samples/piano/${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}.mp3`;
}

function emit() {
  for (const cb of listeners) {
    try {
      cb(pianoStatus());
    } catch (err) {
      /* abonné défaillant ignoré */
    }
  }
}

// « idle » (rien demandé), « loading », « ready » (tous chargés) ou
// « partial » / « error » (certains manquent : le synthé prend le relais).
let status = "idle";
export function pianoStatus() {
  return status;
}

export function onPianoStatus(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// Charge et décode les échantillons, du médium vers les extrêmes : les
// notes les plus jouées par un chœur sont prêtes en premier.
export function loadPiano(ctx) {
  if (loading || !ctx) return loading;
  status = "loading";
  emit();
  const order = [...SAMPLE_MIDIS].sort((a, b) => Math.abs(a - 57) - Math.abs(b - 57));
  let failed = 0;
  const one = async (midi) => {
    try {
      const res = await fetch(fileFor(midi));
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.arrayBuffer();
      const buf = await new Promise((resolve, reject) => {
        // forme à rappels : Safari ancien ne renvoie pas de promesse
        const p = ctx.decodeAudioData(data, resolve, reject);
        if (p && typeof p.then === "function") p.then(resolve, reject);
      });
      buffers.set(midi, buf);
    } catch (err) {
      failed++;
    }
  };
  // quatre téléchargements à la fois
  const queue = [...order];
  const workers = Array.from({ length: 4 }, async () => {
    while (queue.length) await one(queue.shift());
  });
  loading = Promise.all(workers).then(() => {
    status = failed === 0 ? "ready" : buffers.size ? "partial" : "error";
    emit();
  });
  return loading;
}

// Échantillon à jouer pour une note : tampon et vitesse de lecture
// (transposition), ou null si rien d'assez proche n'est chargé.
export function sampleFor(midi) {
  let best = null;
  let dist = Infinity;
  for (const [m, buf] of buffers) {
    const d = Math.abs(midi - m);
    if (d < dist) {
      best = [m, buf];
      dist = d;
    }
  }
  // au-delà de 4 demi-tons de transposition, le timbre se dénature :
  // le synthé reste préférable
  if (!best || dist > 4) return null;
  return { buffer: best[1], rate: Math.pow(2, (midi - best[0]) / 12) };
}
