"""The Angel Gabriel (partoche du chœur, n° 14) -> MIDI SATB avec paroles.

Usage : python3 outils/transcriptions/14_the_angel_gabriel.py "public/songs/Chants de Noël/14 - The Angel Gabriel.mid"

La mineur (la partoche garde une armure à deux bémols au premier système,
mais toutes les notes concernées y portent un bécarre : on lit la mineur),
levée « The » puis mesures 4 à 12, en 9/8 et 12/8 alternés, quatre couplets.
Durées en croches ; "r" = silence.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from satb import build  # noqa: E402

# m3 (levée) | m4 9/8 | m5 12/8 | m6 9/8 | m7 12/8 | m8 | m9 | m10 | m11 | m12 (12/8)
S = """E4:1 | A4:2 C5:1 B4:2 D5:1 C5:2 B4:1 | A4:3 B4:3 E4:5 E4:1 |
A4:2 C5:1 B4:2 D5:1 C5:2 B4:1 | A4:5 G4:1 A4:5 C5:1 |
C5:2 D5:1 C5:2 B4:1 C5:2 D5:1 E5:2 E5:1 | D5:3 C5:3 B4:5 C5:1 |
D5:2 C5:1 B4:2 A4:1 B4:3 E4:3 | A4:3 C5:1 B4:1 C5:1 A4:5 G4:1 | A4:6"""

A = """E4:1 | C4:2 E4:1 D4:2 F4:1 E4:2 D4:1 | E4:3 F4:3 D4:5 D4:1 |
C4:2 E4:1 D4:2 F4:1 E4:2 F4:1 | E4:2 F4:1 E4:3 E4:5 E4:1 |
E4:2 F4:1 E4:2 F4:1 G4:2 F4:1 E4:2 E4:1 | A4:6 G4:5 G4:1 |
D4:2 D4:1 D4:2 D4:1 D4:3 D4:3 | C4:1 D4:1 E4:1 F4:3 E4:1 F4:1 E4:1 E4:2 E4:1 | C4:6"""

T = """E3:1 | E3:2 E3:1 E3:2 E3:1 E3:2 E3:1 | C4:3 D4:3 B3:5 B3:1 |
A3:2 A3:1 A3:2 A3:1 A3:2 B3:1 | C4:3 B3:3 C4:5 G3:1 |
C4:2 G3:1 G3:2 D4:1 C4:2 B3:1 C4:2 C4:1 | A3:1 B3:1 C4:1 D4:2 E4:1 D4:5 C4:1 |
A3:2 A3:1 A3:2 A3:1 A3:3 G#3:1 A3:1 B3:1 | A3:6 C4:3 B3:1 C4:1 B3:1 | E3:6"""

B = """E3:1 | A2:2 A2:1 A2:2 A2:1 A2:2 A2:1 | A3:3 A3:3 A3:3 G#3:2 G#3:1 |
A3:2 A2:1 A2:2 A2:1 A2:2 D3:1 | C3:2 D3:1 E3:3 A3:5 C3:1 |
C3:2 B2:1 C3:2 D3:1 E3:2 D3:1 C3:2 C3:1 | F3:3 F#3:3 G3:5 E3:1 |
F3:2 F3:1 F3:2 D3:1 E3:2 F3:1 E3:3 | F3:3 D3:3 C3:1 D3:2 E3:2 E3:1 | A2:6"""

REFRAIN = "high- ly fa- voured la- dy,\" Glo- _ _ _ _ ri- a!"
VERSES = [
    "The An- gel Ga- bri- el from Heav- en came, With wings as drift- ed snow, with eyes as flame: "
    "\"All hail to thee, O low- ly maid- en Ma- _ ry, Most " + REFRAIN,
    "\"For know a bless- ed moth- er thou shalt be, All gen- er- a- tions laud and hon- or thee; "
    "Thy Son shall be Em- man- u- el, by seers fore- told, Most " + REFRAIN,
    "Then gen- tle Ma- ry meek- ly bowed her head; \"To me be as it pleas- eth God,\" she said. "
    "\"My soul shall laud and mag- ni- fy God's ho- ly name.\" Most " + REFRAIN,
    "Of her, Em- man- u- el, the Christ, was born In Beth- le- hem, all on a Christ- mas morn, "
    "And Chris- tian folk through- out the world will ev- er say: \"Most " + REFRAIN,
]

if __name__ == "__main__":
    build(
        sys.argv[1],
        "The Angel Gabriel",
        [("Soprano", S), ("Alto", A), ("Ténor", T), ("Basse", B)],
        VERSES,
        line_starts={10, 20, 32, 39},
        tempo=96,
        timesig=(12, 8),
        gap=5,  # fin de la mesure 12 : la levée du couplet suivant tombe sur la dernière croche
    )
