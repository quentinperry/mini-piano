// Paroles des morceaux, alignées sur les notes du MIDI.
//
// Format du fichier « <morceau>.paroles.txt » (voir public/songs/README.md) :
//
//   # commentaire
//   [Ténor]                 ← section : pupitre, nom exact de piste, ou [Tous]
//   Ky-ri-e e-lei-son,      ← une syllabe par note, dans l'ordre de la piste
//   Chri-ste _ e-lei-son    ← « _ » : la syllabe précédente tient une note de plus
//
//   [00:12.5] Ky-ri-e       ← variante minutée (LRC) : la ligne s'allume à 0:12,5
//
// Les tirets séparent les syllabes d'un mot, les espaces séparent les mots,
// chaque ligne du fichier est une ligne à l'écran, une ligne vide marque un
// paragraphe. On peut coller les « _ » à la syllabe : « lei__ » = 3 notes.
// « ~ » relie deux syllabes chantées sur une même note : « qui~tol-lis ».

import { detectVoice, normalizeName, choirOf } from "./voices.js";

const TIME_RE = /^(\d{1,3}):(\d{1,2}(?:[.,]\d+)?)$/;
const ALL_NAMES = new Set(["*", "tous", "toutes", "tutti", "all", "chœur", "choeur"]);

function parseTime(s) {
  const m = s.trim().match(TIME_RE);
  return m ? Number(m[1]) * 60 + Number(m[2].replace(",", ".")) : null;
}

// Découpe le texte en sections { names, lines: [{ text, time, paragraph }] }.
export function parseLyricsText(text) {
  const sections = [];
  let current = null;
  let paragraph = false;
  const ensure = () => {
    if (!current) {
      current = { names: ["*"], lines: [] };
      sections.push(current);
    }
    return current;
  };
  for (const rawLine of String(text || "").replace(/^﻿/, "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      paragraph = true;
      continue;
    }
    if (line.startsWith("#")) continue;
    const header = line.match(/^\[([^\]]+)\]$/);
    if (header && parseTime(header[1]) === null) {
      current = {
        names: header[1].split(/[,/]/).map((s) => s.trim()).filter(Boolean),
        lines: [],
      };
      sections.push(current);
      paragraph = false;
      continue;
    }
    let time = null;
    let body = line;
    const stamp = line.match(/^\[([^\]]+)\]\s*(.*)$/);
    if (stamp && parseTime(stamp[1]) !== null) {
      time = parseTime(stamp[1]);
      body = stamp[2];
    }
    const sec = ensure();
    sec.lines.push({ text: body, time, paragraph: paragraph && sec.lines.length > 0 });
    paragraph = false;
  }
  return sections.filter((s) => s.lines.length);
}

const isSolo = (normalized) => /\bsolo\b/.test(normalized);

// Section qui s'applique à une piste : nom exact > pupitre > [Tous].
export function pickSection(sections, trackName) {
  const n = normalizeName(trackName);
  const voice = detectVoice(trackName);
  const choir = choirOf(trackName) || 1;
  let best = null;
  let bestRank = 0;
  for (const s of sections) {
    for (const name of s.names) {
      const hn = normalizeName(name);
      const hVoice = detectVoice(name);
      const hChoir = choirOf(name);
      let rank = 0;
      // Nom exact, ou même pupitre et même chœur écrit autrement
      // ([S II] pour la piste « SII », [T1] pour « T I »).
      if ((hn && hn === n) || (hVoice && hVoice === voice && hChoir && hChoir === choir)) rank = 3;
      // Pupitre sans numéro ([Ténor], [T]) : vaut pour toutes ses pistes,
      // sans confondre le chœur et le soliste ([Soprano] / [Soprano Solo]).
      else if (hVoice && hVoice === voice && !hChoir && isSolo(hn) === isSolo(n)) rank = 2;
      else if (ALL_NAMES.has(name.trim().toLowerCase()) || ALL_NAMES.has(hn)) rank = 1;
      if (rank > bestRank) {
        best = s;
        bestRank = rank;
      }
    }
  }
  return best;
}

// Découpe une ligne en syllabes { text, ext, joinNext, extendPrev }.
function tokenizeLine(text) {
  const out = [];
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (/^_+$/.test(word)) {
      out.push({ extendPrev: word.length });
      continue;
    }
    const trailingHyphen = /-$/.test(word);
    const parts = word.split("-");
    parts.forEach((part, i) => {
      const u = (part.match(/_+$/) || [""])[0].length;
      const t = part.slice(0, part.length - u);
      if (!t) {
        if (u) out.push({ extendPrev: u });
        return;
      }
      const isLast = i === parts.length - 1 || parts.slice(i + 1).every((p) => !p.replace(/_/g, ""));
      // « ~ » : élision, plusieurs syllabes chantées sur une seule note
      out.push({ text: t.replace(/~/g, " "), ext: u, joinNext: !isLast || trailingHyphen });
    });
  }
  return out;
}

// Notes d'une piste regroupées par attaque (un accord = un seul temps).
function noteOnsets(notes) {
  const out = [];
  for (const n of notes) {
    const last = out[out.length - 1];
    if (last && n.start - last.start < 0.03) {
      if (n.end > last.end) last.end = n.end;
    } else {
      out.push({ start: n.start, end: n.end });
    }
  }
  return out;
}

// Aligne une section sur les notes d'une piste. Résultat :
// { lines: [{ paragraph, start, syllables: [{ text, start, end, joinNext }] }],
//   syllableCount, noteCount, unusedNotes, missingNotes, timed }
export function alignSection(section, notes) {
  const timed = section.lines.some((l) => l.time !== null);
  const onsets = noteOnsets(notes);
  let i = 0;
  let missing = 0;
  let count = 0;
  let prev = null;
  const lines = [];
  section.lines.forEach((l, li) => {
    const syllables = [];
    for (const tok of tokenizeLine(l.text)) {
      if (tok.extendPrev) {
        if (!timed) {
          const to = Math.min(i + tok.extendPrev, onsets.length) - 1;
          if (prev && to >= i) prev.end = onsets[to].end;
          i += tok.extendPrev;
        }
        continue;
      }
      count++;
      const syl = { text: tok.text, joinNext: tok.joinNext, start: null, end: null };
      if (!timed) {
        if (i < onsets.length) {
          syl.start = onsets[i].start;
          syl.end = onsets[Math.min(i + tok.ext, onsets.length - 1)].end;
        } else {
          missing++;
        }
        i += 1 + tok.ext;
      }
      syllables.push(syl);
      prev = syl;
    }
    if (timed) {
      // Ligne minutée : toute la ligne s'allume à son heure, jusqu'à la suivante.
      const start = l.time !== null ? l.time : lines.length ? lines[lines.length - 1].start : 0;
      const nextTimed = section.lines.slice(li + 1).find((x) => x.time !== null);
      const end = nextTimed ? nextTimed.time : start + 4;
      for (const s of syllables) {
        s.start = start;
        s.end = end;
      }
    }
    lines.push({
      paragraph: l.paragraph,
      syllables,
      start: syllables.length && syllables[0].start !== null ? syllables[0].start : null,
    });
  });
  return {
    lines,
    timed,
    syllableCount: count,
    noteCount: onsets.length,
    unusedNotes: timed ? 0 : Math.max(0, onsets.length - i),
    missingNotes: missing,
  };
}

// Paroles intégrées au MIDI (méta-événements « lyric ») : chaque événement
// est une syllabe minutée. Conventions usuelles : « / » ou « \ » en début
// = nouvelle ligne, retour chariot en fin = fin de ligne, tiret final =
// le mot continue, espace final = fin de mot.
export function linesFromMidiLyrics(events) {
  const lines = [];
  let line = null;
  const newLine = (paragraph = false) => {
    line = { paragraph, syllables: [], start: null };
    lines.push(line);
  };
  events.forEach((ev, idx) => {
    let t = ev.text;
    if (/^[/\\]/.test(t)) {
      newLine(t.startsWith("\\"));
      t = t.slice(1);
    }
    const breakAfter = /[\r\n]$/.test(t);
    t = t.replace(/[\r\n]+/g, "");
    if (!line) newLine();
    const word = t.replace(/\s+$/, "");
    const joinNext = /-$/.test(word) || (t === word && !breakAfter && !/[.,;:!?]$/.test(word));
    const clean = word.replace(/-$/, "");
    if (clean) {
      const next = events[idx + 1];
      const syl = {
        text: clean,
        joinNext,
        start: ev.time,
        end: next ? Math.min(next.time, ev.time + 4) : ev.time + 2,
      };
      if (line.start === null) line.start = syl.start;
      line.syllables.push(syl);
    }
    if (breakAfter) line = null;
  });
  const kept = lines.filter((l) => l.syllables.length);
  const count = kept.reduce((a, l) => a + l.syllables.length, 0);
  return {
    lines: kept,
    timed: true,
    syllableCount: count,
    noteCount: count,
    unusedNotes: 0,
    missingNotes: 0,
  };
}

// Choisit et prépare les paroles d'un morceau pour une piste donnée.
// `fileText` : contenu d'un fichier .paroles.txt (prioritaire) ou null.
// `trackIdx` : piste suivie. Renvoie null s'il n'y a rien pour cette piste.
export function buildLyrics(midi, fileText, trackIdx) {
  if (!midi || trackIdx < 0 || !midi.tracks[trackIdx]) return null;
  const track = midi.tracks[trackIdx];
  if (fileText) {
    const section = pickSection(parseLyricsText(fileText), track.name);
    if (section) {
      return {
        ...alignSection(section, track.notes),
        source: "file",
        sectionName: section.names.join(", "),
        trackName: track.name,
      };
    }
  }
  if (track.lyrics && track.lyrics.length) {
    return { ...linesFromMidiLyrics(track.lyrics), source: "midi", trackName: track.name };
  }
  return null;
}

// Pupitres / pistes pour lesquels un fichier propose des paroles.
export function lyricsSectionNames(fileText) {
  if (!fileText) return [];
  return parseLyricsText(fileText).flatMap((s) => s.names);
}
