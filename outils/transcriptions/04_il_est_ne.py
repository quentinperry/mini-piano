"""Il est né le divin enfant (partoche du chœur, n° 4) -> MIDI SATB avec paroles.

Usage : python3 outils/transcriptions/04_il_est_ne.py "public/songs/Chants de Noël/04 - Il est né le divin enfant.mid"

Sol majeur, 4/4, mesures 5 à 20 de la partoche : refrain (m. 5-12) puis
couplet (m. 13-20). Enchaînement : refrain, couplet 1, refrain, couplet 2…
et refrain final.
Durées en croches ; "r" = silence.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from satb import build  # noqa: E402

# Refrain, m. 5-12
RS = """D4:2 G4:2 G4:2 B4:1 G4:1 | D4:2 G4:2 G4:2 r:2 | G4:2 G4:1 A4:1 B4:2 C5:1 B4:1 | A4:2 G4:2 A4:2 A4:2 |
D4:2 G4:2 G4:2 B4:1 G4:1 | D4:2 G4:2 G4:4 | G4:2 A4:2 B4:2 C5:1 B4:1 | A4:2 D5:2 G4:4"""
RA = """D4:16 | E4:2 E4:1 F#4:1 G4:2 E4:1 G4:1 | F#4:2 E4:2 E4:2 F#4:2 |
D4:16 | E4:2 F#4:2 G4:2 G4:1 G4:1 | F#4:2 F#4:2 G4:4"""
RT = """B3:16 | B3:2 B3:1 D4:1 D4:2 C4:1 D4:1 | D4:2 B3:2 C#4:2 D4:2 |
B3:16 | C4:2 C4:2 D4:2 E4:1 D4:1 | C4:2 C4:2 B3:4"""
RB = """D3:2 G3:2 G3:2 B3:1 G3:1 | D3:2 G3:2 G3:3 F#3:1 | E3:2 E3:1 D3:1 G3:2 A3:1 G3:1 | D3:2 E3:2 A2:2 D3:2 |
D3:2 G3:2 G3:2 B3:1 G3:1 | D3:2 G3:2 G3:3 F#3:1 | E3:2 D3:2 G3:2 G3:1 G3:1 | C3:2 D3:2 G2:4"""

# Couplet, m. 13-20
CS = """B4:2 C5:2 D5:2 C5:1 B4:1 | C5:2 E5:2 D5:4 | B4:2 C5:2 D5:2 E5:1 D5:1 | C5:2 B4:2 B4:2 A4:2 |
B4:2 C5:2 D5:2 C5:1 B4:1 | C5:2 E5:2 D5:4 | B4:2 C5:2 D5:2 E5:1 D5:1 | C5:2 B4:2 A4:4"""
CA = """G4:2 A4:2 B4:2 A4:1 G4:1 | A4:2 C5:2 B4:4 | G4:2 A4:2 B4:2 C5:1 B4:1 | A4:2 G4:2 G4:2 F#4:2 |
G4:2 A4:2 B4:2 A4:1 G4:1 | A4:2 C5:2 B4:4 | G4:2 A4:2 B4:2 C5:1 B4:1 | A4:2 G4:2 F#4:4"""
CT = """D4:24 | D4:4 D4:4 | D4:24 | D4:2 E4:2 D4:4"""
CB = """G3:12 G3:1 F#3:1 E3:1 F#3:1 | G3:8 | G3:4 D3:4 |
G3:12 G3:1 F#3:1 E3:1 F#3:1 | G3:8 | C3:2 C#3:2 D3:4"""

REFRAIN = (
    "Il est né le di- vin en- fant, jou- ez haut- bois, ré- son- nez mu- set- tes ; "
    "Il est né le di- vin en- fant, chan- tons tous son a- vè- ne- ment ! "
)
COUPLETS = [
    "De- puis plus de qua- tre mille ans, nous le pro- met- taient les pro- phè- tes ; "
    "De- puis plus de qua- tre mille ans, nous at- ten- dions cet heu- reux temps.",
    "Ah ! qu'il est beau, qu'il est char- mant, que ses grâ- ces sont par- fai- _ tes ! "
    "Ah ! qu'il est beau, qu'il est char- mant, qu'il est doux le di- vin en- fant !",
    "U- ne_é- ta- ble_est son lo- ge- ment, un peu de pail- le, sa cou- chet- te ; "
    "U- ne_é- ta- ble_est son lo- ge- ment, pour un Dieu, quel a- bais- se- ment !",
    "Ô Jé- sus ! Ô Roi tout- puis- sant, tout pe- tit en- fant que vous ê- tes, "
    "Ô Jé- sus ! Ô Roi tout- puis- sant, ré- gnez sur nous en- tiè- re- ment !",
]
REFRAIN_LINES = {8, 18, 26}

if __name__ == "__main__":
    build(
        sys.argv[1],
        "Il est né le divin enfant",
        [("Soprano", RS + " | " + CS), ("Alto", RA + " | " + CA), ("Ténor", RT + " | " + CT), ("Basse", RB + " | " + CB)],
        [REFRAIN + c for c in COUPLETS],
        line_starts=REFRAIN_LINES | {42, 51, 59},
        para_starts={34},
        tempo=120,
        timesig=(4, 4),
        coda=([RS, RA, RT, RB], REFRAIN, REFRAIN_LINES),
    )
