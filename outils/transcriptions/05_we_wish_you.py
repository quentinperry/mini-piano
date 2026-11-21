"""We wish you a Merry Christmas (partoche du chœur, n° 5) -> MIDI SATB avec paroles.

Usage : python3 outils/transcriptions/05_we_wish_you.py "public/songs/Chants de Noël/05 - We wish you a Merry Christmas.mid"

Sol majeur, 3/4, levée + 16 mesures (SA / TB sur deux portées), quatre
couplets.
Durées en croches ; "r" = silence.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from satb import build  # noqa: E402

S = """D4:2 | G4:2 G4:1 A4:1 G4:1 F#4:1 | E4:2 E4:2 E4:2 | A4:2 A4:1 B4:1 A4:1 G4:1 | F#4:2 D4:2 D4:2 |
B4:2 B4:1 C5:1 B4:1 A4:1 | G4:2 E4:2 D4:1 D4:1 | E4:2 A4:2 F#4:2 | G4:2 r:2 D4:2 |
G4:2 G4:2 G4:2 | F#4:4 F#4:2 | G4:2 F#4:2 E4:2 | D4:2 r:2 A4:2 |
B4:2 A4:1 A4:1 G4:1 G4:1 | D5:2 D4:2 D4:1 D4:1 | E4:2 A4:2 F#4:2 | G4:4 r:2"""

A = """D4:2 | D4:2 D4:1 D4:1 D4:1 D4:1 | C4:2 C4:2 D4:2 | C#4:2 C#4:1 D4:1 E4:1 E4:1 | D4:2 D4:2 D4:2 |
D#4:2 D#4:1 E4:1 F#4:1 F#4:1 | E4:2 B3:2 D4:1 D4:1 | C4:2 C4:2 D4:1 C4:1 | B3:2 r:2 C4:2 |
B3:2 C4:2 C#4:2 | D#4:4 D#4:2 | E4:2 D4:2 C#4:2 | D4:2 r:2 D4:2 |
D4:2 D4:1 D4:1 D4:1 D4:1 | F#4:2 D4:2 D4:1 D4:1 | C4:2 E4:2 D4:2 | D4:4 r:2"""

T = """D4:2 | B3:2 B3:1 C4:1 B3:1 A3:1 | G3:2 G3:2 G3:2 | A3:2 A3:1 G3:1 A3:1 A3:1 | A3:2 F#3:2 F#3:2 |
F#3:2 F#3:1 F#3:1 B3:1 B3:1 | B3:2 G3:2 G3:1 G3:1 | G3:2 A3:2 A3:2 | G3:2 r:2 F#3:2 |
G3:2 G3:2 E3:2 | F#3:4 B3:2 | B3:2 A3:2 G3:2 | F#3:2 r:2 D4:2 |
D4:2 D4:1 D4:1 D4:1 D4:1 | A3:2 F#3:2 G3:1 G3:1 | G3:2 C4:2 A3:2 | B3:4 r:2"""

B = """D3:2 | G3:2 D3:1 D3:1 B2:1 B2:1 | C3:2 C3:2 B2:2 | A2:2 E3:1 E3:1 C3:1 C3:1 | D3:2 D3:2 C3:2 |
B2:2 F#3:1 F#3:1 D#3:1 D#3:1 | E3:2 E3:2 B2:1 B2:1 | C3:2 A2:2 D3:2 | G2:2 r:2 D3:2 |
G2:2 A2:2 A#2:2 | B2:4 A2:2 | G2:2 A2:2 A2:2 | D3:2 r:2 F#3:2 |
G3:2 F#3:1 F#3:1 E3:1 E3:1 | D3:2 C3:2 B2:1 B2:1 | C3:2 A2:2 D3:2 | G2:4 r:2"""

FIN = (
    "ti- dings we bring to you and your kin, we "
    "wish you a mer- ry Christ- mas, and a hap- py new year!"
)
VERSES = [
    "We wish you a mer- ry Christ- mas, we wish you a mer- ry Christ- mas, we "
    "wish you a mer- ry Christ- mas, and a hap- py new year. Good " + FIN,
    "Please bring me some fig- gy pud- ding, please bring me some fig- gy pud- ding, please "
    "bring me some fig- gy pud- ding, and _ bring it right here! Glad " + FIN,
    "We won't go un- til we get some, we won't go un- til we get some, we "
    "won't go un- til we get some, so _ bring it out here! Glad " + FIN,
    "We wish you a mer- ry Christ- mas, we wish you a mer- ry Christ- mas, we "
    "wish you a mer- ry Christ- mas, and a hap- py new year. Glad " + FIN,
]

if __name__ == "__main__":
    build(
        sys.argv[1],
        "We wish you a Merry Christmas",
        [("Soprano", S), ("Alto", A), ("Ténor", T), ("Basse", B)],
        VERSES,
        line_starts={8, 16, 24, 30, 40, 48},
        tempo=132,
        timesig=(3, 4),
        gap=2,
    )
