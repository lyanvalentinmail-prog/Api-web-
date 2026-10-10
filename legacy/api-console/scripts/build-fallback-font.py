#!/usr/bin/env python3
"""
Genera assets/fonts/SakuraSymbols.ttf (+ .woff2): fuente TrueType de reserva
para los canvas "Sakura Night" con símbolos (→ ★ ♥ ✓ ∞ …) y alfabeto cirílico
que no existen en Cinzel / Cormorant Garamond.

Las formas se extraen de los cortes de Noto Serif JP (OFL 1.1, CFF → TrueType
con cu2qu) y ✦ ✧ ❤ se dibujan a mano.

Uso:
  pip install fonttools brotli
  python3 scripts/build-fallback-font.py node_modules/@fontsource/noto-serif-jp/files
"""
import glob
import os
import sys

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont

if len(sys.argv) < 2:
    sys.exit(__doc__)

SRC_DIR = sys.argv[1]
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'fonts')
os.makedirs(OUT_DIR, exist_ok=True)

SYMBOLS = '→←↔↑↓★☆♥♡♦♠♣❀✿✽❖➡✓⚠☀☁☂♪♫♬∞♂♀※≈≠≤≥√†‡•◦…–—‹›«»°±×÷©®™€£¥§¶'
UPM = 1000

glyphs = {}      # nombre → TTGlyph
advances = {}    # nombre → ancho
cmap = {}        # codepoint → nombre


def glyph_name(cp):
    return 'uni%04X' % cp


def convert(src_font, src_cmap, cp):
    gname = src_cmap[cp]
    gs = src_font.getGlyphSet()
    tt_pen = TTGlyphPen(None)
    pen = Cu2QuPen(tt_pen, max_err=1.0, reverse_direction=True)
    gs[gname].draw(pen)
    scale = UPM / src_font['head'].unitsPerEm
    name = glyph_name(cp)
    glyph = tt_pen.glyph()
    if scale != 1:
        # Noto Serif JP ya usa 1000 upm; se deja por seguridad
        from fontTools.pens.transformPen import TransformPen
        tt_pen = TTGlyphPen(None)
        gs[gname].draw(Cu2QuPen(TransformPen(tt_pen, (scale, 0, 0, scale, 0, 0)), max_err=1.0, reverse_direction=True))
        glyph = tt_pen.glyph()
    glyphs[name] = glyph
    advances[name] = int(round(src_font['hmtx'][gname][0] * scale))
    cmap[cp] = name


def synth(cp, draw, advance):
    pen = TTGlyphPen(None)
    draw(pen)
    name = glyph_name(cp)
    glyphs[name] = pen.glyph()
    advances[name] = advance
    cmap[cp] = name


def star4(pen, cx, cy, r, k, filled=True):
    pts = []
    for i in range(4):
        import math
        a = math.pi / 2 * i
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
        pts.append((cx + r * k * math.cos(a + math.pi / 4), cy + r * k * math.sin(a + math.pi / 4)))
    # contorno con curvas suaves hacia el centro
    pen.moveTo(pts[0])
    for i in range(1, 8, 2):
        pen.qCurveTo(pts[i], pts[(i + 1) % 8])
    pen.closePath()
    if not filled:
        inner = [(cx + (x - cx) * 0.55, cy + (y - cy) * 0.55) for (x, y) in pts]
        pen.moveTo(inner[0])
        for i in range(7, 0, -2):
            pen.qCurveTo(inner[i], inner[i - 1])
        pen.closePath()


def heart(pen, cx, cy, s):
    # corazón sólido ❤ (sentido horario)
    pen.moveTo((cx, cy - s))
    pen.qCurveTo((cx - 1.15 * s, cy - 0.15 * s), (cx - 0.95 * s, cy + 0.55 * s))
    pen.qCurveTo((cx - 0.5 * s, cy + 1.0 * s), (cx, cy + 0.45 * s))
    pen.qCurveTo((cx + 0.5 * s, cy + 1.0 * s), (cx + 0.95 * s, cy + 0.55 * s))
    pen.qCurveTo((cx + 1.15 * s, cy - 0.15 * s), (cx, cy - s))
    pen.closePath()


# 1) símbolos desde los cortes de Noto Serif JP
slices = sorted(glob.glob(os.path.join(SRC_DIR, 'noto-serif-jp-*-500-normal.woff2')))
wanted = {ord(c) for c in SYMBOLS}
fonts = {}
for path in slices:
    f = TTFont(path)
    c = f.getBestCmap()
    hits = [cp for cp in wanted if cp in c and cp not in cmap]
    if 'cyrillic-' in os.path.basename(path):
        hits += [cp for cp in c if 0x0400 <= cp <= 0x045F and cp not in cmap]
    for cp in hits:
        convert(f, c, cp)
    if hits:
        print('%-50s %s' % (os.path.basename(path), ''.join(chr(cp) for cp in hits[:40])))

missing = ''.join(chr(cp) for cp in wanted if cp not in cmap)
print('sin glifo en Noto Serif JP:', missing or '-')

# 2) glifos dibujados a mano
synth(0x2726, lambda p: star4(p, 350, 330, 330, 0.22, True), 700)    # ✦
synth(0x2727, lambda p: star4(p, 350, 330, 330, 0.22, False), 700)   # ✧
synth(0x2764, lambda p: heart(p, 420, 340, 400), 840)                # ❤
synth(0x2714, lambda p: [p.moveTo((80, 380)), p.lineTo((200, 500)), p.lineTo((330, 360)), p.lineTo((660, 760)),
                         p.lineTo((760, 680)), p.lineTo((330, 120)), p.closePath()], 840)  # ✔

# 3) ensamblar la fuente TrueType
order = ['.notdef'] + sorted(glyphs)
fb = FontBuilder(UPM, isTTF=True)
fb.setupGlyphOrder(order)
fb.setupCharacterMap(cmap)
notdef = TTGlyphPen(None)
notdef.moveTo((60, 0)); notdef.lineTo((60, 700)); notdef.lineTo((440, 700)); notdef.lineTo((440, 0)); notdef.closePath()
glyphs['.notdef'] = notdef.glyph()
advances['.notdef'] = 500
fb.setupGlyf(glyphs)
metrics = {}
glyf = fb.font['glyf']
for name in order:
    g = glyf[name]
    lsb = g.xMin if hasattr(g, 'xMin') else 0
    metrics[name] = (advances[name], lsb)
fb.setupHorizontalMetrics(metrics)
fb.setupHorizontalHeader(ascent=880, descent=-120)
fb.setupNameTable({'familyName': 'Sakura Symbols', 'styleName': 'Regular',
                   'uniqueFontIdentifier': 'SakuraSymbols-Regular;1.0', 'fullName': 'Sakura Symbols',
                   'version': 'Version 1.0', 'psName': 'SakuraSymbols-Regular',  # fontdb exige nameID 6
                   'copyright': 'Glyphs from Noto Serif JP (c) Adobe/Google, SIL Open Font License 1.1',
                   'licenseDescription': 'This Font Software is licensed under the SIL Open Font License, Version 1.1.'})
fb.setupOS2(sTypoAscender=880, sTypoDescender=-120, sTypoLineGap=0, usWinAscent=1000, usWinDescent=200,
            sCapHeight=700, sxHeight=500, fsSelection=0x40, achVendID='SKRA')
fb.setupPost()

ttf_path = os.path.join(OUT_DIR, 'SakuraSymbols.ttf')
fb.save(ttf_path)
font = TTFont(ttf_path)
font.flavor = 'woff2'
font.save(os.path.join(OUT_DIR, 'SakuraSymbols.woff2'))
print('glifos:', len(order), '→', ttf_path, os.path.getsize(ttf_path), 'B /', os.path.getsize(os.path.join(OUT_DIR, 'SakuraSymbols.woff2')), 'B (woff2)')
