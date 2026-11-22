"""Rameau, « La Nuit » (arr. J. Noyon, chœur à 4 voix mixtes) -> MIDI SATB avec paroles.

Usage : python3 outils/transcriptions/rameau_la_nuit.py "public/songs/Rameau/Hymne à la nuit.mid"

Partition scannée (pages 61-64). Mi bémol majeur, 3/4. Trois parties :
  A. couplet 1, tutti (levée + 19 mesures), puis passage « bouche fermée » ;
  B. couplet 2, soprano solo sur les autres voix en bouche fermée, puis
     bouche fermée ;
  C. reprise tutti de la musique de A sur les paroles du couplet 2, puis
     bouche fermée (morendo).
Ténors : clé de sol 8, écrits ici à la hauteur réelle. Basses divisées
notées « G2+G3 » (deux notes ensemble). Durées en croches (.5 = double
croche) ; "r" = silence. Les paroles suivent la partie de soprano.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from satb import PPQ, build  # noqa: E402


def x2(s):
    """Durées en croches -> doubles croches (unité du fichier)."""
    out = []
    for tok in s.replace("|", " | ").split():
        if tok == "|":
            out.append(tok)
            continue
        p, d = tok.split(":")
        out.append(f"{p}:{round(float(d) * 2)}")
    return " ".join(out)


# --- A : levée + m. 1-19 (la partie C reprend cette musique) -------------
A_S = """G4:2 | F4:6 | Bb4:2 G4:2 Eb4:2 | Ab4:4 G4:1 F4:1 | G4:4 Eb4:2 | Eb5:2 Eb5:1 D5:1 C5:1 Bb4:1 |
A4:4 D5:2 | Bb4:3 Bb4:1 Bb4:1 A4:1 | Bb4:4 r:2 | F4:3 F4:1 G4:1 Ab4:1 | G4:4 F4:1 Eb4:1 | F4:2 F4:2 Bb4:2 |
C5:3 Bb4:1 Ab4:1 C5:1 | Bb4:4 Ab4:1 G4:1 | Ab4:2 Bb4:1 Ab4:1 G4:1 F4:1 | G4:2 Eb4:2 Bb4:2 |
C5:3 C5:1 D5:1 Eb5:1 | D5:2 Bb4:2 G4:2 | Eb4:2 Ab4:3 G4:.5 F4:.5"""
A_A = """Eb4:2 | D4:6 | Eb4:2 Eb4:2 Eb4:2 | F4:4 Eb4:1 D4:1 | Eb4:4 Eb4:2 | G4:2 G4:1 G4:1 G4:1 G4:1 |
F4:4 A4:2 | G4:3 Eb4:1 G4:1 F4:1 | D4:4 r:2 | D4:3 D4:1 Eb4:1 F4:1 | Eb4:4 D4:1 Bb3:1 | D4:2 D4:2 Eb4:2 |
Eb4:3 Eb4:1 Eb4:1 Eb4:1 | Eb4:4 Eb4:1 Eb4:1 | F4:2 Eb4:1 Eb4:1 D4:1 D4:1 | Eb4:2 Eb4:2 Eb4:2 |
Ab4:3 Ab4:1 Ab4:1 Bb4:1 | Bb4:2 G4:2 F4:1 Eb4:1 | D4:1 C4:1 C4:1 B3:1 C4:2"""
A_T = """Bb3:2 | Bb3:6 | Bb3:2 Bb3:2 C4:2 | D4:4 Bb3:1 Bb3:1 | Bb3:4 G3:2 | C4:2 C4:1 F4:1 Eb4:1 D4:1 |
C4:4 F4:2 | D4:3 C4:1 C4:1 Eb4:1 | D4:4 r:2 | Bb3:3 Bb3:1 Bb3:1 Bb3:1 | Bb3:4 Bb3:1 Bb3:1 | Bb3:2 Bb3:2 Bb3:2 |
Ab3:3 Bb3:1 C4:1 Ab3:1 | Bb3:2 G3:2 C4:1 C4:1 | C4:2 C4:1 C4:1 Bb3:1 Ab3:1 | Bb3:2 G3:2 Eb4:2 |
Eb4:3 Eb4:1 F4:1 G4:1 | F4:2 Eb4:2 C4:2 | Bb3:2 Bb3:3 C4:1"""
A_B = """Eb3:2 | Bb2:6 | G2+G3:2 G2+G3:2 Ab2+Ab3:2 | Bb2+F3:4 Bb2:1 Bb2:1 | Eb2+Eb3:4 Eb2+Eb3:2 |
C3:2 C3:1 D3:1 Eb3:1 Eb3:1 | F3:2 F2+F3:2 D2+D3:2 | G2+G3:3 G2+G3:1 Eb2+Eb3:1 F2+F3:1 | Bb2+Bb3:4 r:2 |
r:6 | r:6 | r:4 G3:2 | F3:3 G3:1 Ab3:1 F3:1 | G3:2 Eb3:2 C3:1 C3:1 | F3:2 F2:1 F2:1 Bb2:1 Bb2:1 |
Eb3:2 Eb3:2 G2+G3:2 | Ab2+Ab3:3 G2+G3:1 F2+F3:1 Eb2+Eb3:1 | Bb2:2 Eb3:2 Eb3:2 | Ab2+Ab3:2 F2+F3:3 Ab2+Ab3:1"""
# m. 19 : fin de phrase (A : « rê-ve heu- » ; B et C : « -ran-ce »)
M19 = {"A": ("Eb4:2 D4:4", "Eb4:4 D4:2", "Bb3:4 Ab3:2", "D3+Bb3:4 Bb2:2"),
       "C": ("G4:2 F4:4", "Eb4:4 D4:2", "Bb3:4 Ab3:2", "Bb2+Bb3:4 Bb2:2")}

# --- bouche fermée (m. 20-25), à la fin de chaque partie --------------------
BF = ("Eb4:4 Bb4:2 | C5:4 D5:1 Eb5:1 | D5:2 Bb4:2 G4:2 | Eb4:2 Ab4:3 G4:.5 F4:.5 | G4:2 F4:4 | Eb4:6",
      "Eb4:4 Eb4:2 | Eb4:2 F4:2 Ab4:1 G4:1 | F4:2 D4:2 Db4:2 | C4:2 C4:2 D4:2 | Eb4:4 D4:2 | Eb4:6",
      "G3:4 Bb3:2 | Bb3:2 Ab3:3 Bb3:1 | F3:4 Bb3:2 | Ab3:2 G3:2 Ab3:2 | G3:4 Ab3:2 | G3:6",
      "Eb2+Bb2:4 G2:2 | Ab2:3 G2:1 F2:1 Eb2:1 | Bb2:2 F3:2 Eb2+Eb3:2 | Ab2+Eb3:2 Eb2+Eb3:4 | C3:2 Bb2:4 | Eb2+Bb2:6")

# --- B : couplet 2, soprano solo (m. 26-45) ---------------------------------
B_S = """r:4 G4:2 | F4:6 | Bb4:2 G4:2 Eb4:2 | Ab4:4 G4:1 F4:1 | G4:4 Eb4:2 | Eb5:2 Eb5:1 D5:1 C5:1 Bb4:1 |
A4:4 D5:2 | Bb4:3 Bb4:1 Bb4:1 A4:1 | Bb4:4 r:2 | F4:3 F4:1 G4:1 Ab4:1 | G4:4 F4:1 Eb4:1 | F4:2 F4:2 Bb4:2 |
C5:3 Bb4:1 Ab4:1 C5:1 | Bb4:4 Ab4:1 G4:1 | Ab4:2 Bb4:1 Ab4:1 G4:1 F4:1 | G4:2 Eb4:2 Bb4:2 |
C5:3 C5:1 D5:1 Eb5:1 | D5:2 Bb4:2 G4:2 | Eb4:2 Ab4:3 G4:.5 F4:.5 | G4:2 F4:4"""
B_A = """r:4 Eb4:2 | D4:6 | Eb4:6 | F4:4 Eb4:1 D4:1 | Eb4:6 | Eb4:6 |
F4:4 A4:2 | G4:3 Eb4:1 G4:1 F4:1 | D4:4 r:2 | D4:4 Eb4:1 F4:1 | Eb4:4 D4:1 C4:1 | D4:4 Eb4:2 |
D4:6 | Eb4:6 | F4:2 Eb4:2 D4:2 | Eb4:6 | F4:4 Ab4:1 Bb4:1 | Bb4:2 G4:2 F4:1 Eb4:1 |
D4:1 C4:1 C4:1 B3:1 C4:2 | Eb4:4 D4:2"""
B_T = """r:4 Bb3:2 | Bb3:6 | Bb3:4 C4:2 | C4:4 Bb3:2 | Bb3:4 G3:2 | C4:3 F4:1 Eb4:1 D4:1 |
C4:4 F4:2 | D4:3 C4:1 C4:1 Eb4:1 | D4:4 r:2 | Bb3:6 | Bb3:6 | Bb3:6 |
Ab3:3 Bb3:1 C4:1 Ab3:1 | Bb3:2 G3:2 C4:2 | C4:4 Bb3:1 Ab3:1 | Bb3:2 G3:2 Eb4:2 | Eb4:4 F4:1 G4:1 | F4:2 Eb4:2 Bb3:2 |
Ab3:4 Ab3:1 C4:1 | Bb3:4 Ab3:2"""
B_B = """r:4 Eb3:2 | Bb2:6 | G2+G3:4 Ab2+Ab3:2 | Bb2+F3:4 Bb2:2 | Eb2+Eb3:6 | C3:3 D3:1 Eb3:2 |
F3:2 F2+F3:2 D2+D3:2 | G2+G3:4 Eb2+Eb3:1 F2+F3:1 | Bb2+Bb3:4 r:2 | r:6 | r:6 | r:4 G3:2 |
F3:3 G3:1 Ab3:1 F3:1 | G3:2 Eb3:2 C3:2 | F3:2 F2:2 Bb2:2 | Eb3:4 G2+G3:2 |
Ab2+Ab3:3 G2+G3:1 F2+F3:1 Eb2+Eb3:1 | Bb2:2 Eb3:4 | Ab2+Ab3:2 F2+F3:3 Ab2+Ab3:1 | Bb2+Bb3:4 Bb2:2"""

C_PICKUP = ("r:4", "r:4", "r:4", "r:4")


def voice(i):
    a = [A_S, A_A, A_T, A_B][i]
    b = [B_S, B_A, B_T, B_B][i]
    parts = [a, M19["A"][i], BF[i], b, BF[i], C_PICKUP[i] + " " + a, M19["C"][i], BF[i]]
    return x2(" | ".join(parts))


HUM_S = "(bouche_fermée) " + "_ " * 13  # bouche fermée : 14 notes de soprano après « reux » / « ce »

PAROLES = (
    # A
    "Ô Nuit! viens ap- por- ter à la Ter- re /le calme en- chan- te- ment de ton mys- tè- _ re. "
    "/L'om- bre qui t'es- corte est si dou- ce!... /Si doux est le con- cert de tes voix chan- tant "
    "l'es- pé- ran- ce!... /Si grand est ton pou- voir, trans- for- mant tout en _ rê- ve_heu- reux! "
    "//" + HUM_S +
    # B
    "//Ô Nuit! oh! laisse en- core à la Ter- re /le calme en- chan- te- ment de ton mys- tè- _ re. "
    "/L'om- bre qui t'es- corte est si dou- ce!... /Est-- il u- ne beau- té aus- si bel- le _ que le "
    "rê- ve? /Est-- il de vé- ri- té plus dou- ce que l'es- pé- ran- _ ce? "
    "//" + HUM_S +
    # C
    "//Ô Nuit! oh! laisse en- core à la Ter- re /le calme en- chan- te- ment de ton mys- tè- _ re. "
    "/L'om- bre qui t'es- corte est si dou- ce!... /Est-- il u- ne beau- té aus- si bel- le _ que le "
    "rê- ve? /Est-- il de vé- ri- té plus dou- ce que l'es- pé- ran- _ ce? "
    "//" + HUM_S
)

if __name__ == "__main__":
    build(
        sys.argv[1],
        "La Nuit (Rameau, arr. J. Noyon)",
        [("Soprano", voice(0)), ("Alto", voice(1)), ("Ténor", voice(2)), ("Basse", voice(3))],
        [PAROLES],
        tempo=60,
        timesig=(3, 4),
        unit=PPQ // 4,
    )
