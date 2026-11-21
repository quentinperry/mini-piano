"""O come ye Faithful (partoche du chœur, n° 17) -> MIDI SATB avec paroles.

Usage : python3 outils/transcriptions/17_o_come_ye_faithful.py "public/songs/Chants de Noël/17 - O come ye Faithful.mid"

Sol majeur, 4/4, levée « O » puis mesures 1 à 20, trois couplets.
Refrain : 1er « O come, let us adore Him » soprano + ténor, 2e avec l'alto,
3e (« … Christ the Lord ») tutti, comme sur la partoche.
Durées en croches ; "r" = silence.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from satb import build  # noqa: E402

S = """G4:2 | G4:4 D4:2 G4:2 | A4:4 D4:4 | B4:2 A4:2 B4:2 C5:2 | B4:4 A4:2 G4:2 |
G4:4 F#4:2 E4:2 | F#4:2 G4:2 A4:2 B4:2 | F#4:4 E4:3 D4:1 | D4:6 r:2 |
D5:4 C5:2 B4:2 | C5:4 B4:4 | A4:2 B4:2 G4:2 A4:2 | F#4:3 E4:1 D4:2 G4:2 |
G4:2 F#4:2 G4:2 A4:2 | G4:4 D4:2 B4:2 | B4:2 A4:2 B4:2 C5:2 | B4:4 A4:2 B4:2 |
C5:2 B4:2 A4:2 G4:2 | F#4:4 G4:2 C5:2 | B4:4 A4:3 G4:1 | G4:6"""

A = """D4:2 | D4:4 D4:2 D4:2 | D4:4 D4:4 | D4:2 D4:2 D4:2 E4:2 | D4:4 D4:2 B3:2 |
B3:2 C#4:2 D4:2 C#4:2 | D4:2 D4:2 D4:2 D4:2 | D4:4 C#4:3 D4:1 | D4:6 r:2 |
F#4:4 E4:1 F#4:1 G#4:2 | A4:4 G4:4 | D4:2 D4:2 E4:2 E4:2 | D4:4 D4:2 r:2 |
r:8 | r:6 D4:2 | D4:14 E4:2 |
E4:1 F#4:1 G4:2 D4:2 D4:1 C#4:1 | D4:4 D4:2 E4:2 | D4:6 C4:1 C4:1 | B3:6"""

T = """B3:2 | B3:4 B3:2 B3:2 | A3:4 A3:4 | G3:2 A3:2 G3:2 G3:2 | G3:4 F#3:2 G3:2 |
G3:4 A3:2 A3:2 | A3:2 G3:2 F#3:2 E3:2 | A3:4 G3:3 G3:1 | F#3:6 r:2 |
A3:4 G#3:2 D4:2 | E4:4 D4:4 | A3:2 G3:2 B3:2 C4:2 | A3:3 G3:1 F#3:2 B3:2 |
B3:2 A3:2 B3:2 C4:2 | B3:4 G3:2 G3:2 | G3:2 F#3:2 G3:2 A3:2 | G3:4 F#3:2 D4:2 |
C4:2 D4:2 A3:2 A3:2 | A3:4 G3:4 | G3:4 F#3:3 G3:1 | G3:6"""

B = """G3:2 | G3:4 B3:2 G3:2 | F#3:4 F#3:4 | G3:2 F#3:2 G3:2 C3:2 | D3:4 D3:2 E3:2 |
E3:4 D3:2 A2:2 | D3:2 B2:2 F#2:2 G2:2 | A2:4 A2:3 A2:1 | D3:6 r:2 |
B2:4 E3:2 E3:2 | A3:4 D3:4 | F#3:2 G3:2 E3:2 C3:2 | D3:4 D3:2 r:2 |
r:8 | r:8 | r:8 | r:6 G#3:2 |
A3:2 G3:2 F#3:2 E3:2 | D3:2 C3:2 B2:2 C3:2 | D3:7 D3:1 | G2:6"""

VERSES = [
    "O Come all ye faith- ful, joy- ful and tri- um- phant, "
    "O come ye, O come _ ye to Beth- _ le- hem. "
    "Come and be- hold Him, born the King of An- _ gels. "
    "O come, let us a- dore Him, O come, let us a- dore Him, "
    "O come, let us a- dore Him, _ Christ _ the Lord!",
    "O Sing, choirs of an- gels, sing in ex- ul- ta- tion, "
    "Sing all that hear in heav- en God's ho- _ ly word. "
    "Give to our Fa- ther glo- ry in the High- _ est; "
    "O come, let us a- dore Him, O come, let us a- dore Him, "
    "O come, let us a- dore Him, _ Christ _ the Lord!",
    "All Hail! Lord, we greet Thee, Born this hap- py morn- ing, "
    "O Je- sus! for ev- er- more be Thy name a- dored. "
    "Word of the Fa- ther, now in flesh ap- pear- _ ing. "
    "O come, let us a- dore Him, O come, let us a- dore Him, "
    "O come, let us a- dore Him, _ Christ _ the Lord!",
]

if __name__ == "__main__":
    build(
        sys.argv[1],
        "O come ye Faithful",
        [("Soprano", S), ("Alto", A), ("Ténor", T), ("Basse", B)],
        VERSES,
        line_starts={12, 24, 36, 43, 50},
        tempo=88,
        timesig=(4, 4),
        gap=2,
    )
