// Lecture de fichiers MIDI standard (SMF, formats 0/1/2) pour l'entraînement
// des choristes : nom des pistes, notes (hauteur, début, fin, vélocité) et
// carte de tempo. Analyse volontairement minimale, sans dépendance externe :
// tout ce qui est General MIDI avancé (pitch bend, percussions, contrôleurs)
// est simplement ignoré, seul le rythme et les notes comptent à l'oreille.

const DEFAULT_TEMPO = 500000; // microsecondes par noire (120 BPM)

// Quantité à longueur variable (Variable Length Quantity) du format MIDI.
function readVLQ(bytes, pos) {
  let value = 0;
  for (;;) {
    const b = bytes[pos++];
    value = (value << 7) | (b & 0x7f);
    if ((b & 0x80) === 0) break;
  }
  return [value, pos];
}

function readTag(bytes, pos) {
  return String.fromCharCode(bytes[pos], bytes[pos + 1], bytes[pos + 2], bytes[pos + 3]);
}

// Les noms de pistes des fichiers de chorales sont en Latin-1 en général.
function readText(bytes, pos, len) {
  let out = "";
  for (let i = 0; i < len; i++) out += String.fromCharCode(bytes[pos + i]);
  return out.trim();
}

// Analyse une piste : événements note on/off en temps « ticks » + tempos.
function parseTrackBytes(bytes, start, end) {
  let pos = start;
  let tick = 0;
  let running = 0;
  let name = "";
  const notes = [];
  const tempos = [];
  const open = new Map(); // canal×hauteur -> note en attente de note-off
  while (pos < end) {
    let [delta, p] = readVLQ(bytes, pos);
    pos = p;
    tick += delta;
    let status = bytes[pos];
    if (status < 0x80) {
      if (running === 0) break; // fichier endommagé
      status = running;
    } else {
      pos += 1;
      if (status < 0xf0) running = status; // les méta-événements ne comptent pas
    }
    if (status === 0xff) {
      const metaType = bytes[pos++];
      const [len, p2] = readVLQ(bytes, pos);
      pos = p2;
      if (metaType === 0x51 && len >= 3) {
        tempos.push({
          tick,
          usPerQuarter: (bytes[pos] << 16) | (bytes[pos + 1] << 8) | bytes[pos + 2],
        });
      } else if (metaType === 0x03 && !name) {
        name = readText(bytes, pos, len);
      } else if (metaType === 0x2f) {
        break; // fin de piste
      }
      pos += len;
    } else if (status === 0xf0 || status === 0xf7) {
      const [len, p2] = readVLQ(bytes, pos);
      pos = p2 + len;
    } else {
      const type = status & 0xf0;
      const channel = status & 0x0f;
      if (type === 0x90 || type === 0x80) {
        const pitch = bytes[pos];
        const velocity = bytes[pos + 1];
        pos += 2;
        const slot = channel * 128 + pitch;
        if (type === 0x90 && velocity > 0) {
          open.set(slot, { midi: pitch, velocity, startTick: tick });
        } else {
          const pending = open.get(slot);
          if (pending) {
            open.delete(slot);
            notes.push({
              midi: pending.midi,
              velocity: pending.velocity,
              startTick: pending.startTick,
              endTick: tick,
            });
          }
        }
      } else if (type === 0xc0 || type === 0xd0) {
        pos += 1; // changement de programme, pression de canal
      } else {
        pos += 2; // aftertouch polyphonique, contrôleurs, pitch bend
      }
    }
  }
  // Notes jamais refermées (fichier tronqué) : on les ferme au dernier tick.
  for (const pending of open.values()) {
    notes.push({
      midi: pending.midi,
      velocity: pending.velocity,
      startTick: pending.startTick,
      endTick: Math.max(tick, pending.startTick + 1),
    });
  }
  return { name, notes, tempos };
}

// Analyse un ArrayBuffer et renvoie { duration, tracks } avec les temps en
// secondes. Les pistes sans note (conducteur, tempo seul) ne sont pas listées.
export function parseMidi(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 14 || readTag(bytes, 0) !== "MThd") {
    throw new Error("Ce fichier n'est pas un MIDI standard (SMF).");
  }
  const headerLen = (bytes[4] << 24) | (bytes[5] << 16) | (bytes[6] << 8) | bytes[7];
  const declaredTracks = (bytes[10] << 8) | bytes[11];
  const division = (bytes[12] << 8) | bytes[13];
  const smpte = (division & 0x8000) !== 0;
  const ticksPerQuarter = smpte ? 0 : division;
  const framesPerSecond = smpte ? 256 - (division >> 8) : 0;
  const ticksPerFrame = smpte ? division & 0xff : 0;

  let pos = 8 + headerLen;
  const raw = [];
  while (pos + 8 <= bytes.length && raw.length < declaredTracks) {
    if (readTag(bytes, pos) !== "MTrk") break;
    const len = (bytes[pos + 4] << 24) | (bytes[pos + 5] << 16) | (bytes[pos + 6] << 8) | bytes[pos + 7];
    if (len < 0) break; // longueur absurde : on s'arrête proprement
    const end = Math.min(pos + 8 + len, bytes.length);
    raw.push(parseTrackBytes(bytes, pos + 8, end));
    pos += 8 + len;
  }
  if (raw.length === 0) {
    throw new Error("Aucune piste MIDI trouvée dans ce fichier.");
  }

  // Carte de tempo globale : en format 1, la piste 0 porte les tempos,
  // mais on accepte les tempos où qu'ils soient, comme le font les séquenceurs.
  const tempos = [];
  for (const t of raw) tempos.push(...t.tempos);
  let tickToSec;
  if (smpte) {
    tickToSec = (tick) => tick / (framesPerSecond * ticksPerFrame);
  } else {
    tempos.sort((a, b) => a.tick - b.tick);
    if (tempos.length === 0 || tempos[0].tick > 0) {
      tempos.unshift({ tick: 0, usPerQuarter: DEFAULT_TEMPO });
    }
    const points = [];
    let sec = 0;
    for (let i = 0; i < tempos.length; i++) {
      points.push({ tick: tempos[i].tick, sec, usPerQuarter: tempos[i].usPerQuarter });
      if (i + 1 < tempos.length) {
        sec += ((tempos[i + 1].tick - tempos[i].tick) * tempos[i].usPerQuarter) / 1e6 / ticksPerQuarter;
      }
    }
    const last = points[points.length - 1];
    tickToSec = (tick) => {
      let point = last;
      for (let i = points.length - 1; i >= 0; i--) {
        if (points[i].tick <= tick) {
          point = points[i];
          break;
        }
      }
      return point.sec + ((tick - point.tick) * point.usPerQuarter) / 1e6 / ticksPerQuarter;
    };
  }

  let duration = 0;
  const tracks = [];
  raw.forEach((t, i) => {
    if (t.notes.length === 0) return; // piste de tempo seule : pas au menu
    const notes = t.notes
      .map((n) => ({
        midi: n.midi,
        velocity: n.velocity,
        start: tickToSec(n.startTick),
        end: tickToSec(n.endTick),
      }))
      .sort((a, b) => a.start - b.start);
    for (const n of notes) if (n.end > duration) duration = n.end;
    tracks.push({ name: t.name || "Piste " + (i + 1), notes });
  });
  if (tracks.length === 0) {
    throw new Error("Ce fichier MIDI ne contient aucune note.");
  }
  return { duration, tracks };
}

// Lecture d'une liste d'événements déjà triés. Un retard (timer) par événement
// suffit pour un fichier de répétition : quelques milliers de notes tiennent
// sans problème, et la précision d'une dizaine de millisecondes passe inaperçue
// pour se caler sur sa partie. Le lecteur mémorise sa position (en secondes du
// morceau) : pause, reprise, changement de vitesse en route et déplacement
// dans le morceau (seek) reposent sur le même mécanisme de reprogrammation.
export function createMidiPlayer(events, duration, { onNoteOn, onNoteOff, onEnd }) {
  let timers = [];
  let playing = false;
  let speed = 1;
  let pos = 0; // position dans le morceau, en secondes
  let startedAt = 0; // performance.now() au (re)démarrage de la lecture

  const clearTimers = () => {
    for (const t of timers) clearTimeout(t);
    timers = [];
  };

  const getPos = () =>
    playing
      ? Math.min(pos + ((performance.now() - startedAt) / 1000) * speed, duration)
      : pos;

  // (Re)programme tous les événements postérieurs à la position courante.
  // Les événements passés sont ignorés : un note-off orphelin (note allumée
  // avant un saut) est inoffensif, l'appelant relâche déjà les notes tenues.
  const schedule = () => {
    for (const ev of events) {
      if (ev.t < pos) continue;
      timers.push(
        setTimeout(() => {
          if (!playing) return;
          if (ev.on) onNoteOn(ev.midi, ev.velocity);
          else onNoteOff(ev.midi);
        }, ((ev.t - pos) * 1000) / speed)
      );
    }
    timers.push(
      setTimeout(() => {
        if (playing) {
          playing = false;
          pos = duration;
          clearTimers();
          onEnd();
        }
      }, ((duration - pos) * 1000) / speed + 80)
    );
  };

  return {
    // Démarre ou reprend, éventuellement depuis une position donnée.
    play(newSpeed = 1, from = null) {
      clearTimers();
      speed = newSpeed;
      if (from !== null && from !== undefined) {
        pos = Math.min(Math.max(from, 0), duration);
      }
      playing = true;
      startedAt = performance.now();
      schedule();
    },
    pause() {
      if (!playing) return;
      pos = getPos();
      playing = false;
      clearTimers();
    },
    // Saute à une position : reprogramme les événements restants si on était
    // en lecture, sinon mémorise simplement la nouvelle position.
    seek(to) {
      const resume = playing;
      playing = false;
      clearTimers();
      pos = Math.min(Math.max(to, 0), duration);
      if (resume) {
        playing = true;
        startedAt = performance.now();
        schedule();
      }
    },
    getPos,
    stop() {
      playing = false;
      clearTimers();
    },
  };
}
