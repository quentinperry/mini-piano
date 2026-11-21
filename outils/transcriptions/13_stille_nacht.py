"""Stille Nacht (partoche du chœur, n° 13) -> MIDI SATB avec paroles.

Usage : python3 outils/transcriptions/13_stille_nacht.py "public/songs/Chants de Noël/13 - Stille Nacht.mid"


Transcription des mesures 8 à 30 de la partoche (3/4, do majeur), chantées
quatre fois (couplets 1 à 4), une mesure de silence entre deux couplets.
Durées en croches ; "r" = silence.
"""
import struct, sys

PPQ = 480
EIGHTH = PPQ // 2
TEMPO_BPM = 72

NOTE = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def midi_of(p):
    return 12 * (int(p[-1]) + 1) + NOTE[p[0]] + (1 if "#" in p else 0)


def parse(s):
    out = []
    for bar in s.split("|"):
        for tok in bar.split():
            p, d = tok.split(":")
            out.append((None if p == "r" else midi_of(p), int(d)))
    return out


S = parse("""G4:3 A4:1 G4:2 | E4:6 | G4:3 A4:1 G4:2 | E4:6 | D5:4 D5:2 | B4:6 | C5:4 C5:2 | G4:4 r:2 |
A4:4 A4:2 | C5:3 B4:1 A4:2 | G4:3 A4:1 G4:2 | E4:6 | A4:4 A4:2 | C5:3 B4:1 A4:2 | G4:3 A4:1 G4:2 | E4:6 |
D5:4 D5:2 | F5:3 D5:1 B4:2 | C5:6 | E5:6 | C5:2 G4:2 E4:2 | G4:3 F4:1 D4:2 | C4:6""")
A = parse("""E4:3 F4:1 E4:2 | C4:6 | E4:3 F4:1 E4:2 | C4:6 | F4:4 F4:2 | F4:6 | E4:4 E4:2 | E4:4 r:2 |
F4:4 F4:2 | A4:3 G4:1 F4:2 | E4:3 F4:1 E4:2 | C4:6 | C4:2 F4:2 F4:2 | F4:3 F4:1 F4:2 | E4:3 F4:1 E4:2 | C4:6 |
F4:4 F4:2 | D4:3 F4:1 F4:2 | E4:6 | G4:6 | E4:2 G4:2 C4:2 | B3:3 B3:1 B3:2 | C4:6""")
T = parse("""C4:4 C4:2 | G3:6 | C4:3 C4:1 C4:2 | G3:6 | B3:4 B3:2 | D4:6 | C4:4 C4:2 | C4:6 |
C4:4 C4:2 | C4:3 C4:1 C4:2 | C4:3 C4:1 C4:2 | G3:6 | F3:2 C4:2 C4:2 | C4:3 C4:1 C4:2 | C4:3 C4:1 C4:2 | G3:6 |
B3:4 B3:2 | B3:3 B3:1 D4:2 | C4:6 | G3:6 | C4:4 G3:2 | G3:3 G3:1 F3:2 | E3:4 r:2""")
B = parse("""C3:4 C3:2 | C3:6 | C3:3 C3:1 C3:2 | C3:6 | G3:4 G3:2 | G3:6 | C3:4 C3:2 | C3:6 |
F3:4 F3:2 | F3:3 F3:1 F3:2 | C3:3 C3:1 C3:2 | C3:6 | F3:4 F3:2 | A3:3 G3:1 F3:2 | C3:3 C3:1 C3:2 | C3:6 |
G3:4 G3:2 | G3:3 G3:1 G3:2 | C3:6 | G3:6 | C3:4 C3:2 | G2:3 G2:1 G2:2 | C3:4 r:2""")

# Paroles : une entrée par note de soprano (46), "_" = note tenue (mélisme).
# "-" final = le mot continue ; sinon fin de mot.
VERSES = [
    "Stil- le _ Nacht, hei- li- ge Nacht, al- les schläft, ein- sam wacht. "
    "Nur das trau- te hoch- hei- li- ge Paar. Hol- der Kna- be im lo- cki- gen Haar. "
    "Schlaf in himm- li- scher Ruh, Schlaf in himm- li- scher _ _ Ruh.",
    "Dou- ce _ nuit, sain- te _ nuit ! Dans les cieux ! L'as- tre luit. "
    "Le mys- tè- re_an- non- cé s'ac- com- plit. Cet en- fant sur la pail- le_en- dor- mi, "
    "C'est l'a- mour in- fi- ni ! C'est l'a- mour in- fi- _ _ ni !",
    "Saint en- _ fant, doux a- _ gneau ! Qu'il est grand ! Qu'il est beau ! "
    "En- ten- dez ré- son- ner les pi- peaux, Des ber- gers con- dui- sant leurs trou- peaux "
    "Vers son hum- ble ber- ceau ! Vers son hum- ble ber- _ _ ceau !",
    "Si- lent _ night, Ho- ly _ night, All is calm, all is bright, "
    "Round yon vir- gin _ moth- er and child, Ho- ly in- fant so ten- der and mild, "
    "Sleep in heav- en- ly peace, Sleep in heav- en- ly _ _ peace.",
]
VERSES = [v.replace(" !", "\u00a0!") for v in VERSES]  # espace insécable avant « ! »
LINE_STARTS = {8, 14, 23, 32, 38}  # index (0-based) des notes qui ouvrent une ligne

sop_notes = [i for i, (p, _) in enumerate(S) if p is not None]
assert len(sop_notes) == 46, len(sop_notes)
for v in VERSES:
    assert len([x for x in v.split(" ") if x]) == 46, (len(v.split()), v[:30])

bar_len = 6  # croches par mesure
piece_len = sum(d for _, d in S)
assert all(sum(d for _, d in x) == piece_len for x in (A, T, B)), [sum(d for _, d in x) for x in (S, A, T, B)]
verse_len = piece_len + bar_len  # + une mesure de silence


def vlq(n):
    b = [n & 0x7F]
    n >>= 7
    while n:
        b.append(0x80 | (n & 0x7F))
        n >>= 7
    return bytes(reversed(b))


def meta(t, data):
    return b"\xff" + bytes([t]) + vlq(len(data)) + data


def lyric_events():
    """(tick, texte) pour les 4 couplets, minutés sur le soprano."""
    starts, t = [], 0
    for p, d in S:
        if p is not None:
            starts.append(t)
        t += d
    ev = []
    for v, text in enumerate(VERSES):
        toks = [x for x in text.split(" ") if x]
        for i, tok in enumerate(toks):
            if tok == "_":
                continue
            tok = tok.replace("_", " ")
            txt = tok if tok.endswith("-") else tok + " "
            if i == 0:
                txt = ("\\" if v else "/") + txt
            elif i in LINE_STARTS:
                txt = "/" + txt
            ev.append(((v * verse_len + starts[i]) * EIGHTH, txt))
    return ev


def track(name, part, ch, lyrics):
    ev = []  # (tick, ordre, octets)
    ev.append((0, 0, meta(3, name.encode("utf-8"))))
    ev.append((0, 1, bytes([0xC0 | ch, 0])))
    for v in range(len(VERSES)):
        t = v * verse_len
        for p, d in part:
            if p is not None:
                ev.append(((t) * EIGHTH, 3, bytes([0x90 | ch, p, 80])))
                ev.append(((t + d) * EIGHTH - 10, 1, bytes([0x80 | ch, p, 0])))
            t += d
    for tick, txt in lyrics:
        ev.append((tick, 2, meta(5, txt.encode("utf-8"))))
    ev.sort(key=lambda e: (e[0], e[1]))
    out, last = b"", 0
    for tick, _, data in ev:
        out += vlq(tick - last) + data
        last = tick
    out += vlq(0) + meta(0x2F, b"")
    return b"MTrk" + struct.pack(">I", len(out)) + out


def main(path):
    us = round(60_000_000 / TEMPO_BPM)
    t0 = (vlq(0) + meta(3, "Stille Nacht".encode()) + vlq(0) + meta(0x51, us.to_bytes(3, "big"))
          + vlq(0) + meta(0x58, bytes([3, 2, 24, 8])) + vlq(0) + meta(0x2F, b""))
    tracks = [b"MTrk" + struct.pack(">I", len(t0)) + t0]
    lyr = lyric_events()
    for i, (name, part) in enumerate([("Soprano", S), ("Alto", A), ("Ténor", T), ("Basse", B)]):
        tracks.append(track(name, part, i, lyr))
    with open(path, "wb") as f:
        f.write(b"MThd" + struct.pack(">IHHH", 6, 1, len(tracks), PPQ) + b"".join(tracks))


if __name__ == "__main__":
    main(sys.argv[1])
