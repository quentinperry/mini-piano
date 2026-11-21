"""Stille Nacht (partoche du chœur, n° 13) -> MIDI SATB avec paroles.

Usage : python3 outils/transcriptions/13_stille_nacht.py "public/songs/Chants de Noël/13 - Stille Nacht.mid"

Transcription des mesures 8 à 30 de la partoche (3/4, do majeur), chantées
quatre fois (couplets 1 à 4), une mesure de silence entre deux couplets.
Durées en croches ; "r" = silence.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from satb import build  # noqa: E402

S = """G4:3 A4:1 G4:2 | E4:6 | G4:3 A4:1 G4:2 | E4:6 | D5:4 D5:2 | B4:6 | C5:4 C5:2 | G4:4 r:2 |
A4:4 A4:2 | C5:3 B4:1 A4:2 | G4:3 A4:1 G4:2 | E4:6 | A4:4 A4:2 | C5:3 B4:1 A4:2 | G4:3 A4:1 G4:2 | E4:6 |
D5:4 D5:2 | F5:3 D5:1 B4:2 | C5:6 | E5:6 | C5:2 G4:2 E4:2 | G4:3 F4:1 D4:2 | C4:6"""
A = """E4:3 F4:1 E4:2 | C4:6 | E4:3 F4:1 E4:2 | C4:6 | F4:4 F4:2 | F4:6 | E4:4 E4:2 | E4:4 r:2 |
F4:4 F4:2 | A4:3 G4:1 F4:2 | E4:3 F4:1 E4:2 | C4:6 | C4:2 F4:2 F4:2 | F4:3 F4:1 F4:2 | E4:3 F4:1 E4:2 | C4:6 |
F4:4 F4:2 | D4:3 F4:1 F4:2 | E4:6 | G4:6 | E4:2 G4:2 C4:2 | B3:3 B3:1 B3:2 | C4:6"""
T = """C4:4 C4:2 | G3:6 | C4:3 C4:1 C4:2 | G3:6 | B3:4 B3:2 | D4:6 | C4:4 C4:2 | C4:6 |
C4:4 C4:2 | C4:3 C4:1 C4:2 | C4:3 C4:1 C4:2 | G3:6 | F3:2 C4:2 C4:2 | C4:3 C4:1 C4:2 | C4:3 C4:1 C4:2 | G3:6 |
B3:4 B3:2 | B3:3 B3:1 D4:2 | C4:6 | G3:6 | C4:4 G3:2 | G3:3 G3:1 F3:2 | E3:4 r:2"""
B = """C3:4 C3:2 | C3:6 | C3:3 C3:1 C3:2 | C3:6 | G3:4 G3:2 | G3:6 | C3:4 C3:2 | C3:6 |
F3:4 F3:2 | F3:3 F3:1 F3:2 | C3:3 C3:1 C3:2 | C3:6 | F3:4 F3:2 | A3:3 G3:1 F3:2 | C3:3 C3:1 C3:2 | C3:6 |
G3:4 G3:2 | G3:3 G3:1 G3:2 | C3:6 | G3:6 | C3:4 C3:2 | G2:3 G2:1 G2:2 | C3:4 r:2"""

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

if __name__ == "__main__":
    build(
        sys.argv[1],
        "Stille Nacht",
        [("Soprano", S), ("Alto", A), ("Ténor", T), ("Basse", B)],
        VERSES,
        line_starts={8, 14, 23, 32, 38},
        tempo=72,
        timesig=(3, 4),
        gap=6,  # une mesure de silence entre deux couplets
    )
