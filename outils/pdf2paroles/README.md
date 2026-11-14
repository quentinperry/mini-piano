# pdf2paroles

Extrait les paroles d'une partition PDF, pupitre par pupitre, et les aligne
note à note sur le fichier MIDI du morceau. Le résultat est un fichier
`.paroles.txt` prêt pour Mini Piano (format décrit dans
[`public/songs/README.md`](../../public/songs/README.md)).

C'est l'outil qui a produit les paroles de la Messe en ut de Mozart du dépôt.

## Installation

Il faut Python 3.8 ou plus récent, trois bibliothèques Python et `pdftoppm`
(qui rend les pages en image pour repérer les portées) :

```bash
pip install pypdf numpy Pillow
```

| Système | `pdftoppm` |
|---|---|
| macOS | `brew install poppler` |
| Debian / Ubuntu | `sudo apt install poppler-utils` |
| Windows | binaires « Poppler for Windows », dossier `bin` ajouté au `PATH` |

Le script tient en un seul fichier : `pdf2paroles.py`.

## Utilisation

```bash
python3 pdf2paroles.py partition.pdf morceau.mid --pages 15-21
```

Le fichier `morceau.paroles.txt` est écrit à côté du MIDI ; il suffit de le
déposer dans `public/songs/` avec le même nom que le MIDI.

Un tableau récapitule chaque pupitre :

```
Piste          Section        Syllabes  Notes  Hauteur OK  Élisions
S              [Soprano]          134    212        100 %  0
A              [Alto]             135    231        100 %  0
```

« Hauteur OK » est la part des syllabes posées sur une note MIDI de même
hauteur que la note écrite dans la partition : au-dessus de 95 %, le
pupitre est fiable ; en dessous de 90 %, la partition et le MIDI diffèrent
probablement par endroits (autre édition, arrangement), à vérifier à
l'écoute.

### Options

| Option | Rôle |
|---|---|
| `--pages 15-21` | pages du **fichier** PDF à lire (pas les numéros imprimés) ; plusieurs plages : `3-5,8` |
| `--debut "Gloria"` | quand une page contient la fin du morceau précédent : titre où commencer (expression régulière) |
| `--fin "Laudamus"` | titre du morceau suivant, où s'arrêter |
| `--pistes "S,A,T,B"` | pistes MIDI des portées vocales, **de haut en bas** ; par défaut, les pistes dont le nom désigne un pupitre (S, Soprano, Canto, A1, Tenore, B II…) |
| `--cles "sol,sol,sol8,fa"` | clé de chaque portée vocale : `sol`, `sol8` (ténor), `fa`, `ut3`, `ut4` ; par défaut sol pour soprano et alto, sol octaviée pour ténor, fa pour basse |
| `-o fichier.txt` | fichier de sortie |
| `--titre "…"` | titre écrit en commentaire en tête du fichier |

### Exemples

```bash
# Morceau qui occupe des pages entières
python3 pdf2paroles.py messe.pdf 02gloria.mid --pages 15-21

# Morceau qui commence et finit en milieu de page
python3 pdf2paroles.py messe.pdf 06credo.mid --pages 75-86 --debut "Credo in unum" --fin "incarnatus"

# Pistes MIDI aux noms non reconnus, ou baryton en clé de fa
python3 pdf2paroles.py motet.pdf motet.mid --pages 1-6 --pistes "Voix 1,Voix 2,Voix 3" --cles "sol,sol8,fa"
```

## Comment ça marche

1. Les pages sont rendues en image pour repérer les portées et les systèmes
   (y compris les doubles chœurs, dont le crochet coupe le trait de système).
2. Le texte et les glyphes de la police musicale sont lus dans le PDF avec
   leur position : syllabes sous chaque portée, têtes de notes sur la portée.
3. Les tirets entre syllabes sont repérés sur l'image (petit trait à
   mi-hauteur des lettres), ce qui reconstitue les mots.
4. Chaque portée donne une suite de notes, dont la hauteur est lue sur la
   portée. Cette suite est alignée sur la piste MIDI du pupitre en comparant
   les hauteurs. Il n'y a donc besoin ni du tempo ni des chiffrages, et un
   MIDI qui commence par une mesure d'amorce ne pose pas de problème.
5. Les notes MIDI entre deux syllabes deviennent des `_` (vocalise). Une
   syllabe dont la note n'existe pas dans le MIDI est reliée à la suivante
   par `~` et chantée sur la même note, pour ne rien décaler.

## Ce qu'il faut à la partition

- **Un PDF généré par un logiciel de gravure** (LilyPond, MuseScore,
  Sibelius, Finale, Dorico…), où paroles et notes sont du texte. Une
  partition **scannée** ne peut pas être lue : le script le signale.
- **Toutes les portées vocales affichées sur chaque système**, dans le même
  ordre que `--pistes`. Les éditions qui masquent une portée quand le
  pupitre se tait (souvent un soliste) ne sont pas prises en charge : traitez
  alors séparément les pages où la disposition est constante.
- Une portée de piano (ou rien) sous les voix : seules les premières portées
  de chaque système, autant que de pistes, sont lues.
- **Un seul couplet** : quand plusieurs lignes de paroles se superposent sous
  une portée, la ligne la plus fournie est retenue.

## Après l'extraction

Le fichier se corrige à la main si besoin (ajouter ou retirer un `_` là où
la syllabe affichée se décale). Pour l'essayer avant de le déposer, ouvrez
le morceau dans Mini Piano, puis « Ajouter des paroles ».
