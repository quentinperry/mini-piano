"""God Rest Ye Merry, Gentlemen (partoche du chœur, n° 3) -> MIDI SATB avec paroles.

Usage : python3 outils/transcriptions/03_god_rest_ye.py "public/songs/Chants de Noël/03 - God Rest Ye Merry Gentlemen.mid"

Mi mineur, 4/4, levée + 19 mesures, quatre couplets. Partie A (m. 1-8) :
sopranos et altos seuls ; ténors et basses entrent à la levée de B (« To
save us all… ») ; C = refrain « O tidings of comfort and joy ».
Durées en croches ; "r" = silence.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from satb import build  # noqa: E402

S = """E4:2 | E4:2 B4:2 B4:2 A4:2 | G4:2 F#4:2 E4:2 D4:2 | E4:2 F#4:2 G4:2 A4:2 | B4:6 E4:2 |
E4:2 B4:2 B4:2 A4:2 | G4:2 F#4:2 E4:2 D4:2 | E4:2 F#4:2 G4:2 A4:2 | B4:6 B4:2 |
C5:2 A4:2 B4:2 C5:2 | D5:2 E5:2 B4:2 A4:2 | G4:2 E4:2 F#4:2 G4:2 | A4:4 G4:2 A4:2 |
G4:4 C5:2 B4:2 | B4:2 A4:2 G4:2 F#4:2 | E4:4 G4:1 F#4:1 E4:2 | A4:4 G4:2 A4:2 |
B4:2 C5:2 D5:2 E5:2 | B4:2 A4:2 G4:2 F#4:2 | E4:8"""

A = """E4:2 | E4:2 G4:2 F#4:2 D#4:2 | E4:2 D4:2 C4:2 B3:2 | E4:2 D#4:2 E4:2 E4:2 | D#4:6 E4:2 |
E4:2 G4:2 F#4:2 D#4:2 | E4:2 D4:2 C4:2 B3:2 | E4:2 D#4:2 E4:2 E4:2 | D#4:6 E4:2 |
E4:2 D4:2 D4:2 G4:2 | F4:2 E4:2 D4:2 D#4:2 | E4:2 C#4:2 D4:2 G4:2 | F#4:4 G4:2 D4:2 |
D4:4 E4:2 D4:2 | G4:2 F#4:2 E4:2 D#4:2 | E4:4 B3:1 B3:1 C#4:2 | D4:4 E4:2 F#4:2 |
G4:4 G4:2 G4:2 | G4:2 F#4:2 E4:2 D#4:2 | E4:8"""

T = """r:2 | r:8 | r:8 | r:8 | r:8 | r:8 | r:8 | r:8 | r:6 G#3:2 |
A3:2 A3:2 G3:2 G3:2 | G3:2 G3:2 G3:2 F#3:2 | G3:2 G3:2 A3:2 D4:2 | D4:2 C4:2 B3:2 A3:2 |
G3:4 G3:2 G3:2 | D4:2 C4:2 B3:2 B3:2 | G3:4 G3:1 G3:1 G3:2 | F#3:2 A3:2 D4:2 C4:2 |
B3:2 G3:2 D4:2 C4:2 | D4:2 C4:2 B3:2 B3:2 | G3:8"""

B = """r:2 | r:8 | r:8 | r:8 | r:8 | r:8 | r:8 | r:8 | r:6 E3:2 |
A3:2 F#3:2 G3:2 E3:2 | B2:2 C3:2 G2:2 B2:2 | E3:2 E3:2 D3:2 B2:2 | D3:4 E3:2 F#3:2 |
G3:4 C3:2 G3:2 | G2:2 A2:2 B2:2 B2:2 | E3:4 E3:1 E3:1 E3:2 | D3:2 C3:2 B2:2 A2:2 |
G2:2 E3:2 B2:2 C3:2 | G2:2 A2:2 B2:2 B2:2 | E3:8"""

REFRAIN = (
    "O _ ti- dings of com- _ fort and joy, Com- fort and joy, "
    "O _ ti- _ dings of com- _ fort and joy."
)
VERSES = [
    "God rest ye mer- ry, gen- tle- men, let no- thing you dis- may, "
    "Re- mem- ber, Christ our Sa- _ viour was born on Christ- mas day. "
    "To save us all from Sa- tan's pow'r when we were gone a- stray, " + REFRAIN,
    "From God our heav'n- ly Fa- _ ther, a bles- sed An- gel came; "
    "And un- to cer- tain Shep- _ herds brought ti- dings of the same: "
    "How that in Beth- le- hem was born the Son of God by Name. " + REFRAIN,
    "Oh, \"Fear not,\" said the An- _ gel, \"Let no- thing you af- fright, "
    "This day is born a Sa- _ viour of pure _ Vir- gin bright, "
    "To free all those who trust in Him from Sa- tan's pow'r and might.\" " + REFRAIN,
    "Now to the Lord sing prais- _ es, all you with- in this place, "
    "And with true love and bro- ther- hood each o- ther now em- brace; "
    "This ho- ly tide of Christ- _ mas all o- ther doth de- face. " + REFRAIN,
]

if __name__ == "__main__":
    build(
        sys.argv[1],
        "God Rest Ye Merry, Gentlemen",
        [("Soprano", S), ("Alto", A), ("Ténor", T), ("Basse", B)],
        VERSES,
        line_starts={8, 14, 22, 28, 42, 56},
        tempo=100,
        timesig=(4, 4),
        gap=6,
    )
