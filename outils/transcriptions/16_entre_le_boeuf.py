"""Entre le bœuf et l'âne gris (partoche du chœur, n° 16) -> MIDI SATB avec paroles.

Usage : python3 outils/transcriptions/16_entre_le_boeuf.py "public/songs/Chants de Noël/16 - Entre le boeuf et l'âne gris.mid"

Ré mineur, 2/4, 20 mesures en écriture imitative (chaque pupitre a ses
propres paroles) puis accord final de ré majeur. Joué quatre fois : seule
la première phrase change d'un couplet à l'autre (altos et ténors).
Ténors : notés une octave au-dessus sur la partoche (clé de sol 8),
écrits ici à la hauteur réelle. Durées en croches ; "r" = silence.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from satb import build  # noqa: E402

S = """r:4 | r:4 | r:4 | r:4 | D5:4 | A4:4 | A4:1 G4:1 F4:1 G4:1 | A4:4 |
D4:1 E4:1 F4:1 G4:1 | G4:4 | A4:1 G4:1 F4:1 E4:1 | D4:4 | r:4 | r:4 |
F4:4 | F4:2 E4:2 | D4:4 | D4:1 E4:1 F4:1 G4:1 | A4:4 | D4:4"""
A = """D4:2 D4:1 E4:1 | F4:2 D4:2 | A4:2 A4:2 | A4:4 | F4:4 | D4:4 | D4:4 | C#4:4 |
A3:3 B3:1 | C4:1 C4:1 C4:2 | C4:2 C4:2 | D4:4 | D4:1 E4:1 F4:1 G4:1 | A4:1 F4:1 G4:1 A4:1 |
D4:4 | C#4:4 | A3:4 | D4:4 | D4:4 | D4:1 C#4:1 D4:1 E4:1"""
T = """r:4 | r:4 | D3:2 D3:1 E3:1 | F3:2 D3:2 | Bb3:4 | F3:4 | F3:2 D3:2 | E3:1 F3:1 G3:1 E3:1 |
F3:4 | E3:1 F3:1 G3:1 E3:1 | F3:1 E3:1 G3:1 F3:1 | F3:4 | r:4 | C#3:1 D3:1 E3:1 F3:1 |
Bb3:4 | G3:1 A3:1 G3:1 E3:1 | F3:4 | Bb3:4 | A3:1 Bb3:1 C4:1 A3:1 | Bb3:1 A3:1 Bb3:1 G3:1"""
B = """r:4 | r:4 | r:4 | r:4 | r:4 | r:4 | Bb2:4 | A2:4 |
D3:2 C3:2 | C3:1 D3:1 E3:1 C3:1 | A2:2 C3:2 | Bb2:4 | r:4 | r:4 |
G2:1 A2:1 Bb2:1 G2:1 | A2:4 | D3:1 E3:1 F3:1 G3:1 | G3:4 | F#3:1 G3:1 A3:1 F#3:1 | G3:4"""
CODA = ["D4:4", "F#4:4", "A3:4", "D3:4"]  # accord final (ré majeur)

PREMIERE = [
    ("En- tre le boeuf et l'â- ne gris,", "l'â- ne _ gris, _"),
    ("En- tre les pas- tou- reaux jo- lis,", "jo- _ _ lis, _"),
    ("En- tre les ro- ses et les lys,", "et les _ lys, _"),
    ("En- tre les deux bras de Ma- rie,", "Ma- _ _ rie, _"),
]
TEXTE_S = ("Dors, dors, dors le pe- tit fils, mille an- ges di- vins, mil- le sé- ra- phins ; "
           "Dieu d'a- _ mour, ouh _ _ _ _ _", {7, 12, 17})
TEXTE_A = (" dors, dors, dors, fils ; mille an- ges di- vins, mil- _ le "
           "vo- lent à l'en- tour de ce grand Dieu d'a- mour, oh _ _ _ _ _")
TEXTE_T = (" dors, dors, dors le pe- _ tit fi- ls ; di- _ vins _ mil- le sé- ra- phins, "
           "oh de ce grand Dieu d'a- _ mou- _ r, oh _ _ _ _ _ _ _ _")
TEXTE_B = ("Dors, fils ; mille an- ges di- vins _ mil- _ le Dieu _ d'a- _ mour, "
           "oh _ _ _ _ _ _ _ _ _", {2, 8, 11})

if __name__ == "__main__":
    build(
        sys.argv[1],
        "Entre le bœuf et l'âne gris",
        [("Soprano", S), ("Alto", A), ("Ténor", T), ("Basse", B)],
        [alto + TEXTE_A for alto, _ in PREMIERE],
        line_starts={8, 12, 17, 20},
        lead=1,
        voice_verses={
            0: [TEXTE_S] * 4,
            2: [(ten + TEXTE_T, {5, 14, 23}) for _, ten in PREMIERE],
            3: [TEXTE_B] * 4,
        },
        tempo=66,
        timesig=(2, 4),
        gap=4,
        coda=(CODA, "_", ()),
    )
