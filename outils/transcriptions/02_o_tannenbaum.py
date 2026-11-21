"""O Tannenbaum (partoche du chœur, n° 2) -> MIDI SATB avec paroles.

Usage : python3 outils/transcriptions/02_o_tannenbaum.py "public/songs/Chants de Noël/02 - O Tannenbaum.mid"

Fa majeur, 3/4, levée + 12 mesures (SA / TB sur deux portées), trois
couplets : allemand, puis deux couplets français.
Durées en DOUBLES croches ; "r" = silence.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from satb import PPQ, build  # noqa: E402

# levée | m1 … m4 | m5 … m8 | m9 … m12
S = """C4:4 | F4:3 F4:1 F4:6 G4:2 | A4:3 A4:1 A4:6 A4:2 | G4:2 A4:2 Bb4:4 E4:4 | G4:4 F4:4 r:2 C5:2 |
C5:2 A4:2 D5:6 C5:2 | C5:3 Bb4:1 Bb4:6 Bb4:2 | Bb4:2 G4:2 C5:6 Bb4:2 | Bb4:3 A4:1 A4:4 C4:4 |
F4:3 F4:1 F4:6 G4:2 | A4:3 A4:1 A4:6 A4:2 | G4:2 A4:2 Bb4:4 E4:4 | G4:4 F4:8"""

A = """C4:4 | F4:3 F4:1 F4:6 E4:2 | F4:3 F4:1 F4:6 F4:2 | D4:2 F#4:2 G4:4 C4:4 | E4:4 F4:4 r:2 A4:2 |
A4:2 F4:2 Bb4:6 A4:2 | F4:3 F#4:1 G4:6 G4:2 | G4:2 E4:2 A4:6 G4:2 | E4:3 E4:1 F4:4 C4:4 |
F4:3 F4:1 F4:6 E4:2 | F4:3 F4:1 F4:6 F4:2 | D4:2 F#4:2 G4:4 C4:4 | E4:4 F4:8"""

T = """C4:4 | C4:3 C4:1 C4:6 C4:2 | C4:3 C4:1 C4:6 C4:2 | D4:2 D4:2 D4:4 C4:4 | Bb3:4 A3:4 r:2 D4:2 |
D4:2 D4:2 D4:4 D4:4 | D4:3 D4:1 D4:6 D4:2 | C4:2 C4:2 C4:6 C4:2 | G3:3 G3:1 F3:4 C4:4 |
C4:3 C4:1 C4:6 C4:2 | C4:3 C4:1 C4:6 C4:2 | D4:2 D4:2 D4:4 C4:4 | Bb3:4 A3:8"""

B = """r:4 | A3:3 A3:1 A3:6 G3:2 | F3:3 F3:1 F3:6 F3:2 | Bb3:2 A3:2 G3:4 C3:4 | C3:4 F3:4 r:2 F3:2 |
F3:2 F3:2 Bb2:4 F3:4 | D3:3 D3:1 G3:6 G3:2 | G3:2 G3:2 C3:6 E3:2 | C3:3 C#3:1 D3:4 r:4 |
A3:3 A3:1 A3:6 G3:2 | F3:3 F3:1 F3:6 F3:2 | Bb3:2 A3:2 G3:4 C3:4 | C3:4 F3:8"""

VERSES = [
    "O Tan- nen- baum, o Tan- nen- baum, wie treu sind dei- ne Blät- ter. "
    "Du grünst nicht nur zur Som- mer- zeit, nein auch im Win- ter wenn es schneit. "
    "O Tan- nen- baum, o Tan- nen- baum, wie grün sind dei- ne Blät- ter!",
    "Mon beau sa- pin, roi des fo- rêts, que j'ai- me ta ver- du- re. "
    "Quand par l'hi- ver, bois et gué- rets sont dé- pouil- lés de leurs at- traits, "
    "Mon beau sa- pin, roi des fo- rêts, tu gar- des ta pa- ru- re.",
    "Toi que No- ël plan- ta chez nous au saint an- ni- ver- sai- re. "
    "Jo- li sa- pin, comme ils sont doux, et tes bon- bons, et tes jou- joux. "
    "Toi que No- ël plan- ta chez nous, tout bril- lant de lu- miè- re !",
]

if __name__ == "__main__":
    build(
        sys.argv[1],
        "O Tannenbaum",
        [("Soprano", S), ("Alto", A), ("Ténor", T), ("Basse", B)],
        VERSES,
        line_starts={8, 15, 23, 31, 39},
        tempo=80,
        timesig=(3, 4),
        gap=8,
        unit=PPQ // 4,
    )
