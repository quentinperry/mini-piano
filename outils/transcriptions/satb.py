"""Petit générateur de MIDI choral (une piste par pupitre, paroles intégrées).

Chaque chant transcrit depuis la partoche décrit :
- ses voix, en texte : « G4:3 A4:1 G4:2 | E4:6 | … » (hauteur:durée en
  croches ou dans l'unité choisie, « r » = silence, « F#4 » / « Bb3 » pour
  les altérations, les barres « | » ne servent qu'à la lisibilité) ;
- ses couplets : une entrée par note de la voix de référence (soprano par
  défaut), « _ » pour une note tenue sur la même syllabe (mélisme), tiret
  final = le mot continue, « _ » collé (« re_an- ») = espace dans la syllabe ;
- les notes (indice 0, 1, …) qui ouvrent une nouvelle ligne de texte.

Le morceau est joué une fois par couplet, paroles du couplet n au passage n.
"""
import struct

PPQ = 480
EIGHTH = PPQ // 2
STEP = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def midi_of(p):
    n = 12 * (int(p[-1]) + 1) + STEP[p[0]]
    return n + p.count("#") - p[1:-1].count("b")


def parse(s):
    out = []
    for tok in s.replace("|", " ").split():
        p, d = tok.split(":")
        out.append((None if p == "r" else midi_of(p), int(d)))
    return out


def words(v):
    # espace insécable avant « ! ? ; : » (typographie française), qui ne
    # compte pas comme séparateur de syllabes
    for c in "!?;:":
        v = v.replace(" " + c, " " + c)
    return [x for x in v.split(" ") if x]


def vlq(n):
    b = [n & 0x7F]
    n >>= 7
    while n:
        b.append(0x80 | (n & 0x7F))
        n >>= 7
    return bytes(reversed(b))


def meta(t, data):
    return b"\xff" + bytes([t]) + vlq(len(data)) + data


def build(path, title, parts, verses, line_starts=(), tempo=72, timesig=(4, 4), gap=0, lead=0, unit=EIGHTH,
          coda=None, para_starts=()):
    """parts : [(nom de piste, texte des notes)] ; gap : silence entre deux
    couplets ; lead : indice de la voix qui porte les paroles ; unit : durée
    d'une unité en ticks (croche par défaut, PPQ // 4 pour la double croche) ;
    coda : (textes des notes par voix, paroles, line_starts) joués une fois
    après le dernier couplet (ex. dernier refrain) ; para_starts : notes qui
    ouvrent un nouveau paragraphe (ex. début du couplet après le refrain)."""
    names = [name for name, _ in parts]
    segments = [([parse(s) for _, s in parts], text, line_starts) for text in verses]
    if coda:
        segments.append(([parse(s) for s in coda[0]], coda[1], coda[2]))

    events = {i: [] for i in range(len(parts))}  # voix -> [(tick, note, durée)]
    lyr = []
    t0 = 0
    for k, (voices, text, starts_at) in enumerate(segments):
        lens = [sum(d for _, d in p) for p in voices]
        assert len(set(lens)) == 1, f"voix de longueurs différentes : {dict(zip(names, lens))}"
        starts, t = [], 0
        for p, d in voices[lead]:
            if p is not None:
                starts.append(t)
            t += d
        toks = words(text)
        assert len(toks) == len(starts), f"passage {k + 1} : {len(toks)} syllabes pour {len(starts)} notes"
        for i, tok in enumerate(toks):
            if tok == "_":
                continue
            tok = tok.replace("_", " ")
            txt = tok if tok.endswith("-") else tok + " "
            if i == 0:
                txt = ("\\" if k else "/") + txt
            elif i in para_starts:
                txt = "\\" + txt
            elif i in starts_at:
                txt = "/" + txt
            lyr.append(((t0 + starts[i]) * unit, txt))
        for vi, notes in enumerate(voices):
            t = t0
            for p, d in notes:
                if p is not None:
                    events[vi].append((t, p, d))
                t += d
        t0 += lens[0] + gap

    def track(name, notes, ch):
        ev = [(0, 0, meta(3, name.encode("utf-8"))), (0, 1, bytes([0xC0 | ch, 0]))]
        for t, p, d in notes:
            ev.append((t * unit, 3, bytes([0x90 | ch, p, 80])))
            ev.append(((t + d) * unit - 10, 1, bytes([0x80 | ch, p, 0])))
        for tick, txt in lyr:
            ev.append((tick, 2, meta(5, txt.encode("utf-8"))))
        ev.sort(key=lambda e: (e[0], e[1]))
        out, last = b"", 0
        for tick, _, data in ev:
            out += vlq(tick - last) + data
            last = tick
        out += vlq(0) + meta(0x2F, b"")
        return b"MTrk" + struct.pack(">I", len(out)) + out

    us = round(60_000_000 / tempo)
    den = {2: 1, 4: 2, 8: 3}[timesig[1]]
    t0 = (vlq(0) + meta(3, title.encode("utf-8")) + vlq(0) + meta(0x51, us.to_bytes(3, "big"))
          + vlq(0) + meta(0x58, bytes([timesig[0], den, 24, 8])) + vlq(0) + meta(0x2F, b""))
    tracks = [b"MTrk" + struct.pack(">I", len(t0)) + t0]
    tracks += [track(name, events[i], i) for i, name in enumerate(names)]
    with open(path, "wb") as f:
        f.write(b"MThd" + struct.pack(">IHHH", 6, 1, len(tracks), PPQ) + b"".join(tracks))
