"""Les anges dans nos campagnes (partoche du chœur, n° 6) -> MIDI SATB avec paroles.

Usage : python3 outils/transcriptions/06_les_anges.py "public/songs/Chants de Noël/06 - Les anges dans nos campagnes.mid"

Fa majeur, 4/4 : couplet (m. 1-4, chanté deux fois sur les deux moitiés du
couplet) puis Gloria (m. 5-17) ; quatre couplets, chacun suivi du Gloria.
Durées en croches ; "r" = silence.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from satb import build  # noqa: E402

CS = "A4:2 A4:2 A4:2 A4:1 C5:1 | C5:3 Bb4:1 A4:2 F4:1 r:1 | A4:2 A4:1 G4:1 A4:2 A4:1 C5:1 | C5:3 Bb4:1 A4:2 r:2"
CA = "F4:2 F4:2 F4:2 F4:1 A4:1 | A4:3 G4:1 F4:2 C4:1 r:1 | F4:2 F4:1 E4:1 F4:2 F4:1 A4:1 | A4:3 G4:1 F4:2 r:2"
CT = "C4:2 C4:2 C4:2 C4:2 | A3:3 Bb3:1 Bb3:2 A3:1 r:1 | C4:2 C4:1 Bb3:1 C4:2 C4:1 A3:1 | C4:3 C4:1 C4:2 r:2"
CB = "F3:2 F3:2 F3:2 F3:2 | F3:3 F3:1 F3:2 F3:1 r:1 | F3:2 F3:1 F3:1 F3:2 F3:2 | F3:3 E3:1 F3:2 r:2"

# Gloria : m. 5-8 « Gló…ria », 9-10 « in excélsis Deo », reprise, fin m. 17
GS1 = "C5:4 D5:1 C5:1 Bb4:1 A4:1 | Bb4:4 C5:1 Bb4:1 A4:1 G4:1 | A4:4 Bb4:1 A4:1 G4:1 F4:1 | G4:3 G4:1 C4:4"
GA1 = "A4:1 Bb4:1 A4:1 G4:1 F4:4 | G4:1 A4:1 G4:1 F4:1 E4:4 | F4:1 G4:1 F4:1 E4:1 D4:4 | D4:1 E4:1 F4:1 D4:1 C4:4"
GT1 = "C4:4 A3:2 D4:1 C4:1 | Bb3:4 G3:2 C4:1 Bb3:1 | A3:4 F3:2 Bb3:1 A3:1 | G3:3 F3:1 E3:2 A3:1 G3:1"
GB1 = "F3:1 G3:1 F3:1 E3:1 D3:4 | G3:1 F3:1 E3:1 D3:1 C3:4 | F3:1 E3:1 D3:1 C3:1 Bb2:4 | Bb2:2 B2:2 C3:2 F3:1 E3:1"
GS = " | ".join([GS1, "F4:2 G4:2 A4:2 Bb4:2 | A4:4 G4:4", GS1, "F4:2 G4:2 A4:2 Bb4:2 | A4:4 G4:4 | F4:4 r:4"])
GA = " | ".join([GA1, "D4:2 E4:2 F4:2 G4:2 | F4:4 E4:4", GA1, "D4:2 E4:2 F4:2 G4:2 | F4:4 E4:4 | C4:4 r:4"])
GT = " | ".join([GT1, "A3:2 C4:2 C4:2 D4:2 | C4:2 B3:2 C4:4", GT1, "A3:2 C4:2 C4:2 D4:2 | C4:2 B3:2 C4:2 Bb3:2 | A3:4 r:4"])
GB = " | ".join([GB1, "D3:2 C3:2 F3:2 Bb2:2 | C3:4 C3:4", GB1, "D3:2 C3:2 F3:2 Bb2:2 | C3:8 | F3:4 r:4"])

GLO = "Gló- " + "_ " * 14 + "_ ri- a "
GLORIA = GLO + "in ex- cél- sis De- o, " + GLO + "in ex- cél- sis De- _ o !"
COUPLETS = [
    "Les an- ges dans _ nos cam- pa- gnes ont en- ton- né l'hym- ne des _ cieux, "
    "Et l'é- cho de _ nos mon- ta- gnes re- dit ce chant mé- lo- di- _ eux. ",
    "Ils an- non- cent _ la nais- san- ce du li- bé- ra- teur d'Is- ra- _ ël, "
    "Et pleins de re- _ con- nais- san- ce chan- tent en ce jour so- len- _ nel. ",
    "Cher- chons tous l'heu- _ reux vil- la- ge qui l'a vu naî- tre sous ses _ toits, "
    "Of- frons- lui le ten- dre hom- ma- ge et _ nos cœurs et nos voix _ _ ! ",
    "Il est né le _ roi de Gloi- re, ter- re, tres- sail- le de bon- _ heur ; "
    "Que tes hym- nes _ de vic- toi- re chan- tent, cé- lè- brent ton Sau- _ veur ! ",
]

if __name__ == "__main__":
    build(
        sys.argv[1],
        "Les anges dans nos campagnes",
        [("Soprano", " | ".join([CS, CS, GS])), ("Alto", " | ".join([CA, CA, GA])),
         ("Ténor", " | ".join([CT, CT, GT])), ("Basse", " | ".join([CB, CB, GB]))],
        [c + GLORIA for c in COUPLETS],
        line_starts={9, 18, 27, 60},
        para_starts={36},
        tempo=104,
        timesig=(4, 4),
    )
