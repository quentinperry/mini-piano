#!/usr/bin/env python3
"""
pdf2paroles — extrait les paroles d'une partition PDF, pupitre par pupitre,
et les aligne note à note sur un fichier MIDI, au format « .paroles.txt »
de Mini Piano (une syllabe par note, « _ » pour les vocalises, « ~ » pour
deux syllabes sur une même note).

    python3 pdf2paroles.py partition.pdf morceau.mid --pages 15-21

Principe :
  1. Les portées sont repérées sur l'image de chaque page (pdftoppm).
  2. Les syllabes et les têtes de notes sont lues dans le PDF lui-même
     (texte et glyphes de la police musicale, avec leur position).
  3. Chaque portée vocale donne une suite de notes (hauteur lue sur la
     portée) portant parfois une syllabe ; cette suite est alignée sur la
     piste MIDI du pupitre par la hauteur des notes (Needleman-Wunsch).
     Aucun tempo ni chiffrage n'est nécessaire.

Dépendances : Python 3.8+, pypdf, numpy, Pillow, et pdftoppm (poppler-utils).
Voir README.md pour les options et les limites.
"""
import argparse, collections, math, os, re, shutil, struct, subprocess, sys, tempfile

try:
    import numpy as np
    from PIL import Image
    from pypdf import PdfReader
    from pypdf.generic import ContentStream
except ImportError as err:  # pragma: no cover
    sys.exit(f"Dépendance manquante ({err.name}). Installez-les avec :\n"
             f"    pip install pypdf numpy Pillow")

import logging
logging.getLogger("pypdf").setLevel(logging.ERROR)  # PDF imparfaits : avertissements sans conséquence

DPI = 144
SCALE = DPI / 72.0

# ---------------------------------------------------------------------------
# MIDI
# ---------------------------------------------------------------------------

def read_midi(path):
    """Pistes du fichier : [{name, notes: [(début, fin, hauteur)] en ticks}]."""
    b = open(path, "rb").read()
    if b[:4] != b"MThd":
        sys.exit(f"{path} n'est pas un fichier MIDI standard.")
    hlen = struct.unpack(">I", b[4:8])[0]
    ntr = struct.unpack(">H", b[10:12])[0]
    div = struct.unpack(">H", b[12:14])[0]
    pos = 8 + hlen
    tracks = []

    def vlq(p):
        v = 0
        while True:
            c = b[p]; p += 1
            v = (v << 7) | (c & 0x7F)
            if c < 0x80:
                return v, p

    while pos + 8 <= len(b) and len(tracks) < ntr:
        if b[pos:pos + 4] != b"MTrk":
            break
        ln = struct.unpack(">I", b[pos + 4:pos + 8])[0]
        p, end = pos + 8, min(pos + 8 + ln, len(b))
        tick, run, name, notes, open_ = 0, 0, "", [], {}
        while p < end:
            d, p = vlq(p); tick += d
            st = b[p]
            if st < 0x80:
                st = run
            else:
                p += 1
                if st < 0xF0:
                    run = st
            if st == 0xFF:
                typ = b[p]; ln2, p2 = vlq(p + 1)
                if typ == 0x03 and not name:
                    name = b[p2:p2 + ln2].decode("latin-1").strip()
                if typ == 0x2F:
                    break
                p = p2 + ln2
            elif st in (0xF0, 0xF7):
                ln2, p2 = vlq(p); p = p2 + ln2
            else:
                typ = st & 0xF0
                if typ in (0x80, 0x90):
                    pitch, vel = b[p], b[p + 1]; p += 2
                    key = (st & 0x0F, pitch)
                    if typ == 0x90 and vel > 0:
                        open_[key] = tick
                    elif key in open_:
                        notes.append((open_.pop(key), tick, pitch))
                elif typ in (0xC0, 0xD0):
                    p += 1
                else:
                    p += 2
        for (ch, pitch), t0 in open_.items():
            notes.append((t0, max(tick, t0 + 1), pitch))
        notes.sort()
        tracks.append(dict(name=name or f"Piste {len(tracks) + 1}", notes=notes))
        pos += 8 + ln
    return div, [t for t in tracks if t["notes"]]


def onsets(notes, div):
    """Attaques successives d'une piste (un accord = une seule attaque)."""
    out = []
    tol = max(1, div // 32)
    for s, e, p in notes:
        if out and s - out[-1]["t"] <= tol:
            out[-1]["p"].add(p)
            continue
        out.append(dict(t=s, p={p}))
    return out

# ---------------------------------------------------------------------------
# Pupitres : reconnaissance d'après le nom des pistes (comme dans l'app)
# ---------------------------------------------------------------------------

VOICE_NAMES = {
    "soprano": ["s", "so", "sop", "soprano", "sopran", "soprani", "sopranos", "canto", "cantus", "dessus"],
    "alto": ["a", "al", "alt", "alto", "alti", "altos", "altus", "contralto", "mezzo"],
    "tenor": ["t", "te", "ten", "tenor", "tenore", "tenori", "tenors", "taille", "tenore"],
    "basse": ["b", "ba", "bas", "basse", "basses", "basso", "bass", "bassus", "baryton", "baritone", "bariton"],
}
LABEL = {"soprano": "Soprano", "alto": "Alto", "tenor": "Ténor", "basse": "Basse"}
DEFAULT_CLEF = {"soprano": "sol", "alto": "sol", "tenor": "sol8", "basse": "fa"}
INSTRUMENTS = {"sax", "flute", "flauto", "recorder", "clarinet", "trombone", "horn", "viola", "viol",
               "guitar", "piano", "organ", "organo", "orgue", "strings", "oboe", "bassi", "cb"}


def norm(s):
    import unicodedata
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn").lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def parse_voice(name):
    """(pupitre, numéro de chœur) ou (None, 0)."""
    toks = [t for t in norm(name).split() if t not in ("choir", "chorus", "coro", "choeur", "voix", "voice")]
    if not toks or any(t in INSTRUMENTS for t in toks):
        return None, 0
    first, rest = toks[0], toks[1:]
    m = re.match(r"^([a-z]{1,2}?)(i{1,3}|\d)$", first)
    if m and any(m.group(1) in v for v in VOICE_NAMES.values()):
        first, rest = m.group(1), [m.group(2)] + rest
    num = 0
    if rest and re.fullmatch(r"i{1,3}|\d", rest[0]):
        num = int(rest[0]) if rest[0].isdigit() else len(rest[0])
        rest = rest[1:]
    for v, names in VOICE_NAMES.items():
        if first in names and (not rest or rest == ["solo"]):
            return v, num
    return None, 0


def header_for(name):
    v, num = parse_voice(name)
    if not v:
        return name
    solo = " Solo" if "solo" in norm(name).split() else ""
    return LABEL[v] + ({1: " I", 2: " II", 3: " III"}.get(num, "") if num else "") + solo

# ---------------------------------------------------------------------------
# PDF : glyphes positionnés (texte et police musicale)
# ---------------------------------------------------------------------------

def mul(a, b):
    return [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3],
            a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3],
            a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5]]


GLYPH_NAMES = {"ae": "æ", "oe": "œ", "AE": "Æ", "OE": "Œ", "fi": "fi", "fl": "fl", "ff": "ff",
               "endash": "–", "emdash": "—", "hyphen": "-", "quoteright": "’", "quoteleft": "‘",
               "comma": ",", "period": ".", "space": " ", "exclam": "!", "question": "?",
               "semicolon": ";", "colon": ":", "quotesingle": "'", "parenleft": "(", "parenright": ")",
               "bracketleft": "[", "bracketright": "]", "dieresis": "¨", "germandbls": "ß",
               "eacute": "é", "egrave": "è", "ecircumflex": "ê", "edieresis": "ë", "agrave": "à",
               "acircumflex": "â", "adieresis": "ä", "aacute": "á", "ccedilla": "ç", "icircumflex": "î",
               "idieresis": "ï", "iacute": "í", "ocircumflex": "ô", "odieresis": "ö", "oacute": "ó",
               "ugrave": "ù", "ucircumflex": "û", "udieresis": "ü", "uacute": "ú", "ntilde": "ñ",
               "Eacute": "É", "Agrave": "À", "Ccedilla": "Ç"}


def parse_tounicode(stream):
    """Table code -> texte d'un CMap ToUnicode (bfchar / bfrange)."""
    try:
        data = stream.get_data().decode("latin-1")
    except Exception:
        return {}
    out = {}
    def u(h):
        try:
            return bytes.fromhex(h).decode("utf-16-be")
        except Exception:
            return ""
    for blk in re.findall(r"beginbfchar(.*?)endbfchar", data, re.S):
        for a, b in re.findall(r"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]*)>", blk):
            out[int(a, 16)] = u(b)
    for blk in re.findall(r"beginbfrange(.*?)endbfrange", data, re.S):
        for a, b, rest in re.findall(r"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(\[[^\]]*\]|<[0-9A-Fa-f]+>)", blk):
            lo, hi = int(a, 16), int(b, 16)
            if rest.startswith("["):
                for i, h in enumerate(re.findall(r"<([0-9A-Fa-f]+)>", rest)):
                    out[lo + i] = u(h)
            else:
                base = int(rest[1:-1], 16); width = len(rest) - 2
                for c in range(lo, min(hi, lo + 4096) + 1):
                    out[c] = u(format(base + c - lo, f"0{width}X"))
    return out


class Font:
    def __init__(self, obj):
        obj = obj.get_object()
        self.name = str(obj.get("/BaseFont", obj.get("/Name", "?")))
        self.sub = str(obj.get("/Subtype"))
        self.two = self.sub == "/Type0"
        self.fm = 0.001
        if self.sub == "/Type3" and "/FontMatrix" in obj:
            self.fm = float(obj["/FontMatrix"][0])
        self.widths = {}
        self.dw = 1000 if self.two else 0
        if self.two:
            desc = obj["/DescendantFonts"][0].get_object()
            self.dw = float(desc.get("/DW", 1000))
            w = desc.get("/W", [])
            i = 0
            while i < len(w):
                c = int(w[i])
                if isinstance(w[i + 1].get_object() if hasattr(w[i + 1], "get_object") else w[i + 1], list):
                    for k, x in enumerate(w[i + 1]):
                        self.widths[c + k] = float(x)
                    i += 2
                else:
                    for c2 in range(c, int(w[i + 1]) + 1):
                        self.widths[c2] = float(w[i + 2])
                    i += 3
        else:
            fc = int(obj.get("/FirstChar", 0))
            for k, x in enumerate(obj.get("/Widths", []) or []):
                self.widths[fc + k] = float(x)
        self.map = {}
        enc = obj.get("/Encoding")
        enc = enc.get_object() if hasattr(enc, "get_object") else enc
        if isinstance(enc, dict) or hasattr(enc, "get"):
            diffs = enc.get("/Differences", []) if hasattr(enc, "get") else []
            code = 0
            for d in diffs:
                if isinstance(d, (int, float)) or d.__class__.__name__ in ("NumberObject", "FloatObject"):
                    code = int(d)
                else:
                    g = str(d)[1:]
                    if g in GLYPH_NAMES:
                        self.map[code] = GLYPH_NAMES[g]
                    elif len(g) == 1:
                        self.map[code] = g
                    elif re.fullmatch(r"uni[0-9A-Fa-f]{4}", g):
                        self.map[code] = chr(int(g[3:], 16))
                    code += 1
        if "/ToUnicode" in obj:
            self.map.update(parse_tounicode(obj["/ToUnicode"].get_object()))

    def codes(self, raw):
        if self.two:
            return [raw[i] << 8 | raw[i + 1] for i in range(0, len(raw) - 1, 2)]
        return list(raw)

    def text(self, code):
        if code in self.map:
            return self.map[code]
        if not self.two and 32 <= code < 127:
            return chr(code)
        if not self.two and 160 <= code < 256:
            return bytes([code]).decode("cp1252", "replace")
        return ""

    def width(self, code):
        return self.widths.get(code, self.dw)


def page_glyphs(reader, pno):
    page = reader.pages[pno - 1]
    mb = page.mediabox
    top = float(mb.top)
    left = float(mb.left)
    out = []

    def run(content, resources, ctm0):
        fonts = {}
        for k, f in ((resources or {}).get("/Font") or {}).items():
            try:
                fonts[k] = Font(f)
            except Exception:
                pass
        xobjs = (resources or {}).get("/XObject") or {}
        cs = ContentStream(content, reader)
        ctm, stack = ctm0[:], []
        tm = tlm = [1, 0, 0, 1, 0, 0]
        font, size, tc, tw, th, tl, rise = None, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0

        def show(raw):
            nonlocal tm
            f = fonts.get(font)
            if f is None:
                return
            for code in f.codes(raw):
                m = mul([size * th, 0, 0, size, 0, rise], mul(tm, ctm))
                w = f.width(code) * f.fm * size
                eff = math.hypot(m[2], m[3])
                out.append(dict(font=f.name, code=code, ch=f.text(code), x=m[4] - left, y=top - m[5],
                                size=eff, w=w * th * math.hypot(tm[0], tm[1]) * math.hypot(ctm[0], ctm[1])))
                adv = (w + tc + (tw if (code == 32 and not f.two) else 0)) * th
                tm = mul([1, 0, 0, 1, adv, 0], tm)

        def raw_of(s):
            if hasattr(s, "original_bytes"):
                return s.original_bytes
            if isinstance(s, bytes):
                return s
            return str(s).encode("latin-1", "replace")

        for operands, op in cs.operations:
            op = op.decode() if isinstance(op, bytes) else op
            try:
                if op == "q": stack.append(ctm[:])
                elif op == "Q": ctm = stack.pop() if stack else ctm
                elif op == "cm": ctm = mul([float(x) for x in operands], ctm)
                elif op == "BT": tm = tlm = [1, 0, 0, 1, 0, 0]
                elif op == "Tf": font, size = operands[0], float(operands[1])
                elif op == "Tc": tc = float(operands[0])
                elif op == "Tw": tw = float(operands[0])
                elif op == "Tz": th = float(operands[0]) / 100
                elif op == "TL": tl = float(operands[0])
                elif op == "Ts": rise = float(operands[0])
                elif op == "Tm": tm = tlm = [float(x) for x in operands]
                elif op in ("Td", "TD"):
                    if op == "TD": tl = -float(operands[1])
                    tlm = mul([1, 0, 0, 1, float(operands[0]), float(operands[1])], tlm); tm = tlm
                elif op == "T*": tlm = mul([1, 0, 0, 1, 0, -tl], tlm); tm = tlm
                elif op == "Tj": show(raw_of(operands[0]))
                elif op in ("'", '"'):
                    tlm = mul([1, 0, 0, 1, 0, -tl], tlm); tm = tlm; show(raw_of(operands[-1]))
                elif op == "TJ":
                    for item in operands[0]:
                        if item.__class__.__name__ in ("FloatObject", "NumberObject") or isinstance(item, (int, float)):
                            tm = mul([1, 0, 0, 1, -float(item) / 1000 * size * th, 0], tm)
                        else:
                            show(raw_of(item))
                elif op == "Do":
                    xo = xobjs.get(operands[0])
                    xo = xo.get_object() if xo is not None else None
                    if xo is not None and xo.get("/Subtype") == "/Form":
                        mtx = [float(x) for x in xo.get("/Matrix", [1, 0, 0, 1, 0, 0])]
                        run(xo, xo.get("/Resources") or resources, mul(mtx, ctm))
            except Exception:
                continue

    run(page.get_contents(), page.get("/Resources"), [1, 0, 0, 1, 0, 0])
    return out


def classify_fonts(glyphs):
    """Polices de texte : celles dont les glyphes sont surtout des lettres."""
    stat = collections.defaultdict(lambda: [0, 0])
    for g in glyphs:
        s = stat[g["font"]]
        s[1] += 1
        if g["ch"] and all(c.isalpha() or c in ".,;:!?'’-–()[]" for c in g["ch"]):
            s[0] += 1
    return {f for f, (a, n) in stat.items() if n and a / n > 0.6}

# ---------------------------------------------------------------------------
# Image : portées et systèmes
# ---------------------------------------------------------------------------

def render(pdf, pages, tmp):
    for p in pages:
        out = os.path.join(tmp, f"p{p}")
        subprocess.run(["pdftoppm", "-r", str(DPI), "-gray", "-f", str(p), "-l", str(p), "-singlefile", pdf, out],
                       check=True, stderr=subprocess.DEVNULL)
    return {p: np.array(Image.open(os.path.join(tmp, f"p{p}.pgm"))) < 128 for p in pages}


def find_staves(im):
    h, w = im.shape
    rows = im.sum(axis=1)
    cand = np.where(rows > 0.4 * w)[0]
    lines = []
    for y in cand:
        if lines and y - lines[-1][-1] <= 1:
            lines[-1].append(y)
        else:
            lines.append([y])
    lines = [sum(l) / len(l) for l in lines]
    out, i = [], 0
    while i + 4 < len(lines):
        grp = lines[i:i + 5]
        gaps = np.diff(grp)
        if gaps.max() - gaps.min() < 2.5 and 4 < gaps.mean() < 30:
            y = int(round(grp[0]))
            xs = np.where(im[y])[0]
            out.append(dict(top=grp[0] / SCALE, bot=grp[4] / SCALE, x0=xs.min() / SCALE, x1=xs.max() / SCALE))
            i += 5
        else:
            i += 1
    return out


def staff_groups(im, staves):
    """Portées reliées par le trait de début de système (ou une accolade)."""
    if not staves:
        return []
    groups = [[staves[0]]]
    for a, b in zip(staves, staves[1:]):
        x = int(round(max(a["x0"], b["x0"]) * SCALE))
        y0, y1 = int(a["bot"] * SCALE), int(b["top"] * SCALE)
        linked = False
        for xx in range(x - 4, x + 5):
            col = im[y0:y1 + 1, max(0, xx - 1):xx + 2].any(axis=1)
            if col.size and col.mean() > 0.95:
                linked = True
                break
        if linked:
            groups[-1].append(b)
        else:
            groups.append([b])
    return groups

# ---------------------------------------------------------------------------
# Extraction
# ---------------------------------------------------------------------------

# Indications qui peuvent se trouver sur la ligne des paroles (les autres
# textes — tempo, expressions — sont sur une autre ligne et déjà écartés).
SKIP = {"tutti", "solo", "solo:", "soli", "tr", "cresc", "cresc.", "crescendo", "dim", "dim.", "decresc.",
        "decresc", "diminuendo", "rit.", "ritard.", "rall.", "a2", "unis.", "div."}
DYN = re.compile(r"^[\[(]?(p+|f+|mp|mf|fp|sfz?|fz)[\])]?\.?$")


def is_lyric_word(t, title_words):
    s = t.strip()
    if not re.search(r"[^\W\d_]", s):
        return False
    if DYN.match(s) or s.lower() in SKIP:
        return False
    return s not in title_words


def extract(pdf, pages, k, start_re, end_re, ims, glyphs_by_page, text_fonts):
    """Pour chaque portée vocale (0..k-1), suite des systèmes : syllabes + glyphes de la portée."""
    staffs = [[] for _ in range(k)]
    started = start_re is None
    for p in pages:
        g = glyphs_by_page[p]
        texts = [o for o in g if o["font"] in text_fonts]
        music = [o for o in g if o["font"] not in text_fonts]
        sizes = collections.Counter(round(o["size"], 1) for o in texts if o["ch"].strip())
        body = sizes.most_common(1)[0][0] if sizes else 10
        # titres : texte nettement plus grand que le corps des paroles
        rows = collections.defaultdict(list)
        for o in texts:
            if o["size"] > body * 1.35:
                rows[round(o["y"])].append(o)
        titles = [(y, "".join(c["ch"] for c in sorted(cs, key=lambda c: c["x"]))) for y, cs in rows.items()]
        start_y, stop_y = -1, 1e9
        for y, t in titles:
            if start_re and re.search(start_re, t, re.I):
                start_y, started = y, True
            elif started and end_re and re.search(end_re, t, re.I) and y > start_y:
                stop_y = min(stop_y, y)
        if not started:
            continue
        im = ims[p]
        groups = staff_groups(im, find_staves(im))
        i = 0
        while i < len(groups):
            g0 = groups[i]
            if g0[0]["top"] < start_y or g0[0]["top"] > stop_y:
                i += 1
                continue
            st = list(g0)
            if len(st) < k and i + 1 < len(groups) and len(groups[i + 1]) >= k:
                i += 1  # petit groupe isolé (piano seul) avant un système complet
                continue
            j = i
            while len(st) < k and j + 1 < len(groups) and groups[j + 1][0]["top"] < stop_y:
                j += 1
                st += groups[j]
            i = j + 1
            if len(st) < k:
                continue
            nxt_tops = [s["top"] for s in st[1:]] + [st[k - 1]["bot"] + 60]
            for vi in range(k):
                s = st[vi]
                top, bot, below = s["top"], s["bot"], nxt_tops[vi]
                hs = (bot - top) / 8
                band_t = [o for o in texts if bot + 1 < o["y"] < below - 1 and o["ch"].strip()]
                # mots : caractères contigus d'une même ligne
                band_t.sort(key=lambda o: (round(o["y"]), o["x"]))
                words = []
                for c in band_t:
                    if words and abs(words[-1]["y"] - c["y"]) < 1.5 and abs(c["x"] - words[-1]["x1"]) < 0.15:
                        words[-1]["t"] += c["ch"]; words[-1]["x1"] = c["x"] + c["w"]
                    else:
                        words.append(dict(t=c["ch"], x0=c["x"], x1=c["x"] + c["w"], y=c["y"], size=c["size"]))
                words = [w for w in words if is_lyric_word(w["t"], set())]
                if words:
                    main = collections.Counter(round(w["y"]) for w in words).most_common(1)[0][0]
                    words = sorted([w for w in words if abs(w["y"] - main) < 2], key=lambda w: w["x0"])
                lyric_y = words[0]["y"] if words else None
                band = [o for o in music if top - 10 * hs < o["y"] < bot + 10 * hs
                        and not (lyric_y is not None and abs(o["y"] - lyric_y) < 0.6 * words[0]["size"])]
                staffs[vi].append(dict(page=p, top=top, bot=bot, hs=hs, x1=s["x1"], words=words, glyphs=band))
        if stop_y < 1e9:
            break
    return staffs


def detect_hyphens(staffs, ims, glyphs_by_page, text_fonts):
    """Tiret entre deux syllabes : petit trait horizontal à mi-hauteur des lettres."""
    def dash(im, x0, x1, y, size, texts):
        # le texte voisin (nuances, nom de pupitre…) est masqué : la barre
        # d'un « e » ou d'un « f » ressemble à un tiret
        for o in texts:
            if abs(o["y"] - y) < size and o["x"] < x1 and o["x"] + o["w"] > x0:
                if o["x"] <= x0 + 0.5:
                    x0 = max(x0, o["x"] + o["w"])
                else:
                    x1 = min(x1, o["x"])
        if x1 - x0 < 0.15 * size:
            return False
        # tiret : vers 0,3 em au-dessus de la ligne de base, long de 0,2 à 1 em ;
        # un trait de vocalise est posé sur la ligne de base et bien plus long
        ya, yb = int((y - 0.42 * size) * SCALE), int((y - 0.2 * size) * SCALE) + 1
        xa, xb = int((x0 + 0.3) * SCALE), int((x1 - 0.3) * SCALE)
        if xb <= xa or yb <= ya:
            return False
        zone = im[ya:yb, xa:xb]
        lo, hi = max(2, int(0.18 * size * SCALE)), int(1.0 * size * SCALE)
        for row in zone:
            run = 0
            for v in list(row) + [False]:
                if v:
                    run += 1
                else:
                    if lo <= run <= hi:
                        return True
                    run = 0
        return False

    for vi, systems in enumerate(staffs):
        for s in systems:
            im = ims[s["page"]]
            ws = s["words"]
            texts = [o for o in glyphs_by_page[s["page"]] if o["font"] in text_fonts and o["ch"].strip()
                     and ws and abs(o["y"] - ws[0]["y"]) < ws[0]["size"]]
            for a, b in zip(ws, ws[1:] + [None]):
                if a["t"].endswith(("-", "–")) and len(a["t"]) > 1:
                    a["t"] = a["t"].rstrip("-–"); a["hyph"] = True; continue
                end = b["x0"] if b else min(s["x1"], a["x1"] + 40)
                # syllabes collées (moins de 0,06 em) : le graveur a omis le tiret faute
                # de place ; un vrai espace entre deux mots est nettement plus large
                touching = b is not None and end - a["x1"] < 0.06 * a["size"]
                a["hyph"] = touching or dash(im, a["x1"], end, a["y"], a["size"], texts)
            s["lead_hyph"] = bool(ws) and dash(im, max(0, ws[0]["x0"] - 20), ws[0]["x0"], ws[0]["y"], ws[0]["size"], texts)


def head_codes(staffs):
    """Codes des têtes de notes : glyphes qu'on trouve sous les syllabes."""
    hit, tot = collections.Counter(), collections.Counter()
    for systems in staffs:
        for s in systems:
            for h in s["glyphs"]:
                tot[(h["font"], h["code"])] += 1
            for w in s["words"]:
                c = (w["x0"] + w["x1"]) / 2
                near = [h for h in s["glyphs"] if w["x0"] - 4 < h["x"] < w["x1"] + 1 and s["top"] - 6 * s["hs"] < h["y"] < s["bot"] + 6 * s["hs"]]
                if near:
                    h = min(near, key=lambda h: abs(h["x"] + h["w"] / 2 - c))
                    hit[(h["font"], h["code"])] += 1
    return {key for key in tot if hit[key] >= 3 and hit[key] / tot[key] >= 0.08}


CLEF_TOP = {"sol": 38, "g": 38, "sol8": 31, "g8": 31, "fa": 26, "f": 26, "ut3": 32, "ut4": 30}
STEP = {0: [0], 1: [0, 1], 2: [1], 3: [1, 2], 4: [2], 5: [3], 6: [3, 4], 7: [4], 8: [4, 5], 9: [5], 10: [5, 6], 11: [6]}


def msteps(m):
    o = m // 12 - 1
    return {o * 7 + s for s in STEP[m % 12]}


def build_events(systems, codes, top_line, offset=0):
    seq = []
    for s in systems:
        heads = [h for h in s["glyphs"] if (h["font"], h["code"]) in codes]
        inside = collections.Counter(round(h["size"], 1) for h in heads)
        if inside:  # notes d'agrément plus petites : ignorées
            normal = inside.most_common(1)[0][0]
            heads = [h for h in heads if h["size"] > 0.8 * normal]
        heads.sort(key=lambda h: h["x"])
        cols = []
        for h in heads:
            st = top_line - round((h["y"] - s["top"]) / s["hs"]) + offset
            if cols and abs(h["x"] - cols[-1]["x"]) < 1.5:
                cols[-1]["steps"].add(st)
            else:
                cols.append(dict(x=h["x"], w=h["w"], steps={st}, syl=None, join=False))
        if s.get("lead_hyph") and seq:
            last = next((c for c in reversed(seq) if c["syl"]), None)
            if last:
                last["join"] = True
        for w in s["words"]:
            c = (w["x0"] + w["x1"]) / 2
            cand = [col for col in cols if w["x0"] - 5 < col["x"] < w["x1"] + 1 and col["syl"] is None]
            if not cand:
                continue
            col = min(cand, key=lambda col: min(abs(col["x"] + col["w"] / 2 - c), abs(col["x"] - w["x0"])))
            col["syl"], col["join"] = w["t"], w.get("hyph", False)
        seq += cols
    return seq


def align(seq, O):
    n, m = len(seq), len(O)
    MS = [set().union(*(msteps(p) for p in o["p"])) for o in O]
    S = [[0] * (m + 1) for _ in range(n + 1)]
    B = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        S[i][0] = S[i - 1][0] - (4 if seq[i - 1]["syl"] else 1); B[i][0] = 1
    for j in range(1, m + 1):
        S[0][j] = S[0][j - 1] - 1; B[0][j] = 2
    for i in range(1, n + 1):
        si = seq[i - 1]["steps"]; gp = 4 if seq[i - 1]["syl"] else 1
        Si, Sp, Bi = S[i], S[i - 1], B[i]
        for j in range(1, m + 1):
            d = Sp[j - 1] + (3 if si & MS[j - 1] else -2)
            u = Sp[j] - gp
            l = Si[j - 1] - 1
            if d >= u and d >= l:
                Si[j] = d; Bi[j] = 0
            elif u >= l:
                Si[j] = u; Bi[j] = 1
            else:
                Si[j] = l; Bi[j] = 2
    i, j = n, m
    match, good = [None] * n, [False] * n
    while i > 0 or j > 0:
        b = B[i][j]
        if i > 0 and j > 0 and b == 0:
            match[i - 1] = j - 1; good[i - 1] = bool(seq[i - 1]["steps"] & MS[j - 1]); i -= 1; j -= 1
        elif i > 0 and (j == 0 or b == 1):
            i -= 1
        else:
            j -= 1
    return match, good


def place_syllables(seq, O):
    match, good = align(seq, O)
    syl, nxt = [], None
    for i in range(len(seq) - 1, -1, -1):
        if match[i] is not None:
            nxt = match[i]
        if seq[i]["syl"]:
            syl.append(dict(t=seq[i]["syl"], join=seq[i]["join"], j=match[i] if match[i] is not None else nxt,
                            ok=good[i], gap=match[i] is None))
    syl.reverse()
    # syllabe sans note dans le MIDI : chantée sur la note de la suivante
    for i in range(len(syl) - 2, -1, -1):
        if syl[i]["gap"]:
            a, b = syl[i], syl[i + 1]
            b["t"] = a["t"] + ("" if a["join"] else "~") + b["t"]
            del syl[i]
    while syl and syl[-1]["j"] is None:
        syl.pop()
    prev = -1
    for s in syl:
        if s["j"] <= prev:
            s["j"] = prev + 1
        prev = s["j"]
    while len(syl) > 1 and syl[-1]["j"] >= len(O):
        last = syl.pop()
        syl[-1]["t"] += ("" if syl[-1]["join"] else "~") + last["t"]
        syl[-1]["join"] = last["join"]
    return syl


def to_lines(syl, m):
    words, cur = [], []
    for i, s in enumerate(syl):
        nxt = syl[i + 1]["j"] if i + 1 < len(syl) else m
        cur.append(s["t"] + "_" * max(0, nxt - s["j"] - 1))
        if not s["join"]:
            words.append("-".join(cur)); cur = []
    if cur:
        words.append("-".join(cur))
    lines, line, n = [], [], 0
    for w in words:
        line.append(w); n += w.count("-") + 1
        core = w.rstrip("_")
        if core.endswith((".", "!", "?")) or (core.endswith((",", ";", ":")) and n >= 6) or n >= 14:
            lines.append(" ".join(line)); line, n = [], 0
    if line:
        lines.append(" ".join(line))
    if syl and syl[0]["j"] > 0 and lines:
        lines[0] = "_" * syl[0]["j"] + " " + lines[0]
    return lines

# ---------------------------------------------------------------------------
# Programme principal
# ---------------------------------------------------------------------------

def parse_pages(spec):
    pages = []
    for part in spec.split(","):
        a, _, b = part.partition("-")
        pages += list(range(int(a), int(b or a) + 1))
    return pages


def main():
    ap = argparse.ArgumentParser(description="Paroles par pupitre d'une partition PDF, alignées sur un MIDI "
                                             "(format .paroles.txt de Mini Piano).")
    ap.add_argument("pdf", help="partition PDF (générée par un logiciel, pas scannée)")
    ap.add_argument("midi", help="fichier MIDI du morceau, une piste par pupitre")
    ap.add_argument("--pages", required=True, help="pages du PDF (numérotation du fichier), ex. 15-21")
    ap.add_argument("--debut", help="titre où commence le morceau dans ces pages (expression régulière)")
    ap.add_argument("--fin", help="titre du morceau suivant, où s'arrêter")
    ap.add_argument("--pistes", help="pistes MIDI des portées vocales, de haut en bas, séparées par des virgules "
                                     "(par défaut : pistes reconnues comme S/A/T/B, dans l'ordre du MIDI)")
    ap.add_argument("--cles", help="clé de chaque portée vocale : sol, sol8, fa, ut3, ut4 "
                                   "(par défaut : sol pour S/A, sol8 pour T, fa pour B)")
    ap.add_argument("-o", "--sortie", help="fichier de sortie (par défaut : <midi>.paroles.txt)")
    ap.add_argument("--titre", help="titre écrit en commentaire en tête du fichier")
    args = ap.parse_args()

    if not shutil.which("pdftoppm"):
        sys.exit("pdftoppm est introuvable : installez poppler-utils (Linux), poppler (Homebrew) "
                 "ou les binaires Poppler pour Windows.")
    div, tracks = read_midi(args.midi)
    if args.pistes:
        wanted = [t.strip() for t in args.pistes.split(",")]
        by_name = {t["name"]: t for t in tracks}
        missing = [w for w in wanted if w not in by_name]
        if missing:
            sys.exit(f"Pistes introuvables : {missing}. Pistes du MIDI : {[t['name'] for t in tracks]}")
        voices = [by_name[w] for w in wanted]
    else:
        voices = [t for t in tracks if parse_voice(t["name"])[0]]
        if not voices:
            sys.exit(f"Aucune piste de pupitre reconnue. Pistes du MIDI : {[t['name'] for t in tracks]}\n"
                     f"Précisez-les avec --pistes.")
    k = len(voices)
    if args.cles:
        clefs = [c.strip().lower() for c in args.cles.split(",")]
        if len(clefs) != k or any(c not in CLEF_TOP for c in clefs):
            sys.exit(f"--cles doit donner {k} clés parmi {sorted(set(CLEF_TOP))}.")
    else:
        clefs = [DEFAULT_CLEF.get(parse_voice(v["name"])[0] or "soprano") for v in voices]
    print(f"Portées vocales attendues ({k}) : " + ", ".join(f"{v['name']} [{c}]" for v, c in zip(voices, clefs)))

    pages = parse_pages(args.pages)
    reader = PdfReader(args.pdf)
    glyphs = {p: page_glyphs(reader, p) for p in pages}
    text_fonts = classify_fonts([g for p in pages for g in glyphs[p]])
    if not any(g["font"] not in text_fonts for p in pages for g in glyphs[p]):
        sys.exit("Aucune police musicale trouvée : les notes de ce PDF sont dessinées (pas du texte). "
                 "Ce PDF ne peut pas être lu par cet outil.")
    if not text_fonts:
        sys.exit("Aucun texte lisible dans ces pages : la partition est-elle scannée ?")
    with tempfile.TemporaryDirectory() as tmp:
        ims = render(args.pdf, pages, tmp)
    staffs = extract(args.pdf, pages, k, args.debut, args.fin, ims, glyphs, text_fonts)
    if not staffs[0]:
        sys.exit("Aucun système trouvé avec autant de portées vocales : vérifiez --pages, --debut, "
                 "--pistes (nombre de pupitres) ou que toutes les portées vocales sont affichées.")
    detect_hyphens(staffs, ims, glyphs, text_fonts)
    codes = head_codes(staffs)

    # calage vertical : on vérifie sur la première voix qu'aucun décalage ne fait mieux
    def score(offset, vi):
        seq = build_events(staffs[vi], codes, CLEF_TOP[clefs[vi]], offset)
        O = onsets(voices[vi]["notes"], div)
        syl = place_syllables(seq, O)
        return sum(s["ok"] for s in syl)
    offset = max(range(-2, 3), key=lambda o: (score(o, 0), -abs(o)))

    title = args.titre or os.path.splitext(os.path.basename(args.midi))[0]
    out = [f"# {title}",
           f"# Paroles extraites de {os.path.basename(args.pdf)} (pages {args.pages}) et alignées sur "
           f"{os.path.basename(args.midi)} par pdf2paroles :",
           "# une syllabe par note de la piste du pupitre, « _ » = la syllabe tient une note de plus,",
           "# « ~ » = syllabes chantées sur une même note.", ""]
    print(f"Systèmes lus : {len(staffs[0])}")
    print(f"{'Piste':<14} {'Section':<14} {'Syllabes':>8} {'Notes':>6} {'Hauteur OK':>11}  Élisions")
    worst = 100
    for vi, v in enumerate(voices):
        seq = build_events(staffs[vi], codes, CLEF_TOP[clefs[vi]], offset)
        O = onsets(v["notes"], div)
        syl = place_syllables(seq, O)
        ok = sum(s["ok"] for s in syl)
        pct = 100 * ok / max(1, len(syl))
        worst = min(worst, pct if syl else 0)
        el = sum(s["t"].count("~") for s in syl)
        head = header_for(v["name"])
        print(f"{v['name']:<14} [{head}]{'':<{max(0, 11 - len(head))}} {len(syl):>8} {len(O):>6} {pct:>10.0f} %  {el}")
        if not syl:
            continue
        out.append(f"[{head}]")
        out += to_lines(syl, len(O))
        out.append("")
    dest = args.sortie or os.path.splitext(args.midi)[0] + ".paroles.txt"
    open(dest, "w", encoding="utf-8").write("\n".join(out).rstrip() + "\n")
    print(f"\nÉcrit : {dest}")
    if worst < 90:
        print("Attention : un pupitre concorde à moins de 90 % — partition et MIDI diffèrent peut-être "
              "(autre édition, piste mal choisie, mauvaise clé). Vérifiez ce pupitre à l'écoute.")


if __name__ == "__main__":
    main()
