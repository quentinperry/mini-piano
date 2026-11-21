"""Holy Night (partoche du chœur, n° 11) -> MIDI SATB avec paroles.

Usage : python3 outils/transcriptions/11_holy_night.py "public/songs/Chants de Noël/11 - Holy Night.mid"

Do majeur, 4/4, mesures 3 à 27 de la partoche (les mesures 1-2 n'y figurent
pas), chantées deux fois (couplets 1 et 2, refrain « Fall on your knees »
tutti à chaque fois). Couplet : mélodie à l'unisson soprano/alto, puis en
tierces ; ténors et basses entrent à « A thrill of hope ».
Durées en DOUBLES croches ; "r" = silence.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from satb import PPQ, build  # noqa: E402

REST_8_BARS = " | ".join(["r:16"] * 8)

# m3 … m15 (couplet) | m16 … m27 (refrain)
S = """E4:4 E4:3 E4:1 G4:7 G4:1 | A4:3 A4:1 F4:3 A4:1 C5:8 | G4:3 G4:1 E4:3 D4:1 C4:4 E4:3 F4:1 |
G4:4 F4:3 D4:1 C4:12 r:4 E4:4 E4:3 E4:1 | G4:7 G4:1 A4:3 A4:1 F4:3 A4:1 |
C5:8 G4:3 G4:1 F#4:3 E4:1 | B4:4 G4:3 A4:1 B4:4 C5:3 B4:1 | E4:8 r:6 G4:2 |
G4:4 A4:4 D4:4 G4:4 | A4:3 G4:1 C5:3 E4:1 A4:4 G4:3 G4:1 | G4:4 A4:4 D4:4 G4:4 |
A4:3 G4:1 C5:3 E4:1 G4:8 |
C5:12 B4:3 A4:1 | B4:12 r:2 B4:2 | D5:11 A4:1 A4:3 A4:1 | C5:8 C5:4 r:2 C5:2 |
E5:8 D5:6 G4:2 | C5:8 A4:4 B4:3 A4:1 | G4:8 F4:3 G4:1 A4:3 G4:1 | G4:12 C5:4 |
D5:12 r:2 G4:2 | G5:8 A4:2 F5:2 E5:2 D5:2 | C5:4 r:4 B4:4 C5:3 D5:1 | C5:12 r:4"""

A = """E4:4 E4:3 E4:1 G4:7 G4:1 | A4:3 A4:1 F4:3 A4:1 C5:8 | G4:3 G4:1 E4:3 D4:1 C4:4 E4:3 F4:1 |
G4:4 F4:3 D4:1 C4:12 r:4 C4:4 C4:3 C4:1 | E4:7 E4:1 F4:3 F4:1 C4:3 C4:1 |
E4:8 E4:3 E4:1 B3:3 B3:1 | E4:4 B3:3 B3:1 D#4:4 B3:3 B3:1 | E4:8 r:6 G4:2 |
G4:4 A4:4 D4:4 G4:4 | A4:3 G4:1 C5:3 E4:1 A4:4 G4:3 G4:1 | G4:4 A4:4 D4:4 G4:4 |
A4:3 G4:1 C5:3 E4:1 G4:8 |
E4:12 E4:3 E4:1 | G4:12 r:2 E4:2 | F4:11 F4:1 F4:3 F4:1 | E4:8 E4:4 r:2 E4:2 |
G4:8 F4:6 G4:2 | G4:8 A4:4 G4:3 E4:1 | E4:8 F4:3 F4:1 F4:3 F4:1 | E4:12 G4:4 |
G4:12 r:2 G4:2 | G4:8 A4:8 | G4:4 r:4 F4:4 F4:4 | E4:12 r:4"""

T = REST_8_BARS + """ | r:16 |
B3:4 r:4 B3:4 r:4 | G3:4 r:4 G3:4 r:4 | B3:4 r:4 B3:4 r:4 | G3:4 r:4 C4:4 B3:4 |
C4:12 D4:3 C4:1 | B3:12 r:2 G#3:2 | A3:11 D4:1 D4:3 D4:1 | C4:8 C4:4 r:2 C4:2 |
C4:8 B3:6 B3:2 | C4:15 C4:1 | C4:8 A3:3 A3:1 A3:3 A3:1 | C4:12 C4:4 |
B3:12 r:2 B3:2 | C4:8 C4:4 C4:2 D4:2 | D4:8 D4:4 C4:3 B3:1 | C4:12 r:4"""

B = REST_8_BARS + """ | r:16 |
D3:4 r:4 G3:4 r:4 | C3:4 r:4 C3:4 r:4 | D3:4 r:4 G3:4 r:4 | C3:4 r:12 |
A3:12 A3:3 A3:1 | E3:12 r:2 E3:2 | D3:11 D3:1 D3:3 D3:1 | A3:8 A3:4 r:2 A3:2 |
G3:8 F3:6 F3:2 | E3:8 F3:4 F3:3 F3:1 | G3:8 F2:3 F2:1 F2:3 F2:1 | C3:4 B2:4 A2:4 G2:4 |
G3:12 r:2 F3:2 | E3:8 F3:4 F3:2 F3:2 | G3:12 G3:3 G2:1 | C3:12 r:4"""

REFRAIN = (
    "Fall on your knees! O hear the an- gel voi- ces! "
    "O night di- _ vine! The night when Christ was _ born _ _ "
    "O night, O ho- _ ly night, _ O night di- _ vine!"
)
VERSES = [
    "Oh ho- ly night! The stars are bright- ly shi- ning, It is the night of the dear Sav- ior's birth! "
    "Long lay the world in sin and er- ror pi- ning, Till he ap- peared and the soul felt its worth. "
    "A thrill of hope the wea- ry world re- joi- ces, For yon- der breaks a new and glo- rious morn! "
    + REFRAIN,
    "Led by the light of Faith se- rene- ly beam- ing, With glow- ing hearts by His cra- dle we stand. "
    "So led by light of a star sweet- ly gleam- ing, Here come the wise men from O- ri- ent land. "
    "The King of Kings lay thus in low- ly man- ger, In all our tri- als born to be our friend. "
    + REFRAIN,
]

if __name__ == "__main__":
    build(
        sys.argv[1],
        "Holy Night",
        [("Soprano", S), ("Alto", A), ("Ténor", T), ("Basse", B)],
        VERSES,
        line_starts={11, 21, 32, 42, 53, 63, 67, 74, 79, 88, 96},
        tempo=60,
        timesig=(4, 4),
        gap=4,
        unit=PPQ // 4,
    )
