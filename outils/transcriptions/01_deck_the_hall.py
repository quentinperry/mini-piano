"""Deck the Hall (partoche du chœur, n° 1) -> MIDI SATB avec paroles.

Usage : python3 outils/transcriptions/01_deck_the_hall.py "public/songs/Chants de Noël/01 - Deck the Hall.mid"

Mi bémol majeur, alla breve (noté ici en 4/4), 16 mesures, trois couplets.
Lignes 1, 2 et 4 sur la même musique (la 4e finit autrement), ligne 3 « Don
we now our gay apparel ».
Durées en croches ; "r" = silence.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from satb import build  # noqa: E402

S1 = "Bb4:3 Ab4:1 G4:2 F4:2 | Eb4:2 F4:2 G4:2 Eb4:2 | F4:1 G4:1 Ab4:1 F4:1 G4:3 F4:1 | Eb4:2 D4:2 Eb4:4"
A1 = "G4:3 F4:1 Eb4:2 D4:2 | C4:2 D4:2 Eb4:2 Eb4:2 | D4:1 Eb4:1 F4:1 D4:1 Eb4:3 C4:1 | Bb3:2 Bb3:2 Bb3:4"
T1 = "Bb3:3 Bb3:1 Bb3:2 Bb3:2 | G3:2 Bb3:2 Bb3:2 G3:2 | Bb3:1 Bb3:1 Bb3:1 Bb3:1 Bb3:2 Ab3:2 | G3:2 F3:2 G3:4"
B1 = "Eb3:3 D3:1 Eb3:2 Bb2:2 | C3:2 Bb2:2 Eb3:2 Eb3:2 | Bb2:1 Bb2:1 Bb2:1 Bb2:1 Eb3:2 Ab2:2 | Bb2:2 Bb2:2 Eb3:4"

S3 = "F4:3 G4:1 Ab4:2 F4:2 | G4:3 Ab4:1 Bb4:2 F4:2 | G4:1 A4:1 Bb4:2 C5:1 D5:1 Eb5:2 | D5:2 C5:2 Bb4:4"
A3 = "D4:3 Eb4:1 F4:2 D4:2 | Eb4:3 Eb4:1 Eb4:2 D4:2 | Eb4:1 Eb4:1 F4:2 G4:1 F4:1 Eb4:2 | F4:2 F4:1 Eb4:1 D4:4"
T3 = "Bb3:3 Bb3:1 Bb3:2 Bb3:2 | Bb3:3 Bb3:1 Bb3:2 Bb3:2 | Bb3:1 Bb3:1 Bb3:2 Bb3:1 Bb3:1 C4:2 | Bb3:2 A3:2 Bb3:4"
B3 = "Bb2:3 Bb2:1 D3:2 Bb2:2 | Eb3:3 F3:1 G3:2 Bb2:2 | Eb3:1 Eb3:1 D3:2 Eb3:1 D3:1 C3:2 | F3:2 F3:2 Bb2:4"

# ligne 4 : deux premières mesures comme la ligne 1, puis la fin
S4 = "Bb4:3 Ab4:1 G4:2 F4:2 | Eb4:2 F4:2 G4:2 Eb4:2 | C5:1 C5:1 C5:1 C5:1 Bb4:3 Ab4:1 | G4:2 F4:2 Eb4:4"
A4 = "G4:3 F4:1 Eb4:2 D4:2 | C4:2 D4:2 Eb4:2 Eb4:2 | Eb4:1 Eb4:1 Eb4:1 Eb4:1 Eb4:3 F4:1 | Eb4:2 D4:2 Eb4:4"
T4 = "Bb3:3 Bb3:1 Bb3:2 Bb3:2 | G3:2 Bb3:2 Bb3:2 G3:2 | Ab3:1 Ab3:1 Ab3:1 Ab3:1 Bb3:3 C4:1 | Bb3:2 Ab3:2 G3:4"
B4 = "Eb3:3 D3:1 Eb3:2 Bb2:2 | C3:2 Bb2:2 Eb3:2 Eb3:2 | Ab2:1 Ab2:1 Ab2:1 Ab2:1 G2:3 Ab2:1 | Bb2:2 Bb2:2 Eb3:4"

S = " | ".join([S1, S1, S3, S4])
A = " | ".join([A1, A1, A3, A4])
T = " | ".join([T1, T1, T3, T4])
B = " | ".join([B1, B1, B3, B4])

FA = "fa la la la la la la la la. "
VERSES = [
    "Deck the hall with boughs of hol- ly, " + FA + "'Tis the sea- son to be jol- ly, " + FA
    + "Don we now our gay ap- par- el, " + FA + "Troll the an- cient Yule- tide car- ol, " + FA,
    "See the blaz- ing Yule be- fore us, " + FA + "Strike the harp and join the cho- rus, " + FA
    + "Fol- low me in mer- ry mea- sure, " + FA + "While I tell of Yule- tide trea- sure, " + FA,
    "Fast a- way the old year pass- es, " + FA + "Hail the new, ye lads and lass- es, " + FA
    + "Sing we joy- ous all to- ge- ther, " + FA + "Heed- less of the wind and wea- ther, " + FA,
]

if __name__ == "__main__":
    build(
        sys.argv[1],
        "Deck the Hall",
        [("Soprano", S), ("Alto", A), ("Ténor", T), ("Basse", B)],
        VERSES,
        line_starts={17, 34, 51},
        tempo=112,
        timesig=(4, 4),
        gap=8,
    )
