#!/usr/bin/env python3
"""
Genera el subconjunto de Noto Serif JP usado por los canvas Sakura
(assets/fonts/NotoSerifJP-sakura.{ttf,woff2}).

Solo hace falta ejecutarlo si quieres cambiar los caracteres incluidos.
Requisitos:  pip install fonttools brotli   y   npm i -D @fontsource/noto-serif-jp

Uso:
  python3 scripts/build-jp-subset.py node_modules/@fontsource/noto-serif-jp/files/noto-serif-jp-japanese-500-normal.woff2
"""
import sys, os, io
from fontTools.ttLib import TTFont
from fontTools import subset

if len(sys.argv) < 2:
    sys.exit(__doc__)

SRC = sys.argv[1]
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets', 'fonts')
os.makedirs(OUT_DIR, exist_ok=True)

# Hiragana + Katakana + puntuación CJK + kanji frecuentes en tarjetas de comunidad
RANGES = [(0x3000, 0x303F), (0x3041, 0x309F), (0x30A0, 0x30FF), (0xFF01, 0xFF0F), (0xFF1A, 0xFF20)]
KANJI = (
    '歓迎昇格級位恋愛相性新人卒業別友心月夜桜花祝勝運命永遠夢星光神王姫最強伝説'
    '一二三四五六七八九十百千万年日名家族仲間旅道力魂剣竜龍風水火雨雪空海山世界'
    '無限絆勇気希望平和自由利戦闇影鬼悪死生大小中高上下前後先今元初終始全完'
    '君私達皆様者会社団体部屋城国村町街門鍵宝金銀宴祭歌音楽笑顔涙声言葉'
    '出入退場参加挑成長進化覚醒再到着帰還歩未来過去時間瞬永久'
)

unicodes = set()
for a, b in RANGES:
    unicodes.update(range(a, b + 1))
unicodes.update(ord(c) for c in KANJI)

font = TTFont(SRC)
options = subset.Options()
options.flavor = None
options.layout_features = ['*']
options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]
options.notdef_outline = True
options.recalc_bounds = True
subsetter = subset.Subsetter(options)
subsetter.populate(unicodes=unicodes)
subsetter.subset(font)

# Familia limpia para que CSS/resvg la encuentren como "Noto Serif JP" peso 500
for rec in font['name'].names:
    if rec.nameID in (1, 16):
        rec.string = 'Noto Serif JP'
    elif rec.nameID == 2:
        rec.string = 'Regular'
    elif rec.nameID == 4:
        rec.string = 'Noto Serif JP'
    elif rec.nameID == 6:
        rec.string = 'NotoSerifJP-Sakura'

ttf_path = os.path.join(OUT_DIR, 'NotoSerifJP-sakura.ttf')
font.flavor = None
font.save(ttf_path)
font.flavor = 'woff2'
font.save(os.path.join(OUT_DIR, 'NotoSerifJP-sakura.woff2'))

print('glifos:', font['maxp'].numGlyphs)
for p in ('NotoSerifJP-sakura.ttf', 'NotoSerifJP-sakura.woff2'):
    print(p, os.path.getsize(os.path.join(OUT_DIR, p)), 'bytes')
