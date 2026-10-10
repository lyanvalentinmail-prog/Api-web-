/**
 * Fuentes tipográficas para los generadores de imágenes.
 *
 * - Carga las caras necesarias desde los paquetes @fontsource (woff2 para
 *   incrustar en SVG, woff → TTF en memoria para el rasterizador resvg).
 * - Lee las tablas `head`, `hhea`, `hmtx`, `OS/2` y `cmap` del TTF para
 *   medir texto con las métricas reales (ancho de avance por glifo), de modo
 *   que el ajuste automático de tamaño y el centrado sean exactos tanto en el
 *   navegador (SVG con la fuente incrustada) como en el PNG/JPG del servidor.
 * - Opcionalmente añade un subconjunto de Noto Serif JP (assets/fonts) para
 *   los textos verticales en japonés de las plantillas Sakura.
 *
 * Todas las fuentes son SIL Open Font License 1.1.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { woffToSfnt } = require('./woff');

const FACES = {
  'cinzel-400': { pkg: '@fontsource/cinzel', file: 'cinzel-latin-400-normal', family: 'Cinzel', weight: 400, style: 'normal' },
  'cinzel-500': { pkg: '@fontsource/cinzel', file: 'cinzel-latin-500-normal', family: 'Cinzel', weight: 500, style: 'normal' },
  'cinzel-700': { pkg: '@fontsource/cinzel', file: 'cinzel-latin-700-normal', family: 'Cinzel', weight: 700, style: 'normal' },
  'cormorant-500i': { pkg: '@fontsource/cormorant-garamond', file: 'cormorant-garamond-latin-500-italic', family: 'Cormorant Garamond', weight: 500, style: 'italic' },
  'cormorant-600i': { pkg: '@fontsource/cormorant-garamond', file: 'cormorant-garamond-latin-600-italic', family: 'Cormorant Garamond', weight: 600, style: 'italic' }
};

/** Pilas de familias: la primera es la que incrustamos; el resto son respaldos del cliente. */
const STACKS = {
  display: "'Cinzel', 'Trajan Pro', 'Cormorant Garamond', Georgia, 'Times New Roman', serif",
  italic: "'Cormorant Garamond', 'EB Garamond', Garamond, Georgia, 'Times New Roman', serif",
  jp: "'Noto Serif JP', 'Hiragino Mincho ProN', 'Yu Mincho', 'MS Mincho', 'Noto Serif CJK JP', 'Cinzel', serif"
};

const FONT_DIR = path.join(__dirname, '..', '..', 'assets', 'fonts');

const loaded = new Map(); // key → { ...FACES[key], ttf, woff2, metrics, stack }

/* ------------------------------------------------------------------ */
/* Lectura de tablas sfnt                                              */
/* ------------------------------------------------------------------ */

function sfntTables(buf) {
  const numTables = buf.readUInt16BE(4);
  const tables = {};
  for (let i = 0; i < numTables; i++) {
    const o = 12 + i * 16;
    tables[buf.toString('latin1', o, o + 4)] = { offset: buf.readUInt32BE(o + 8), length: buf.readUInt32BE(o + 12) };
  }
  return tables;
}

function parseCmap(buf, base) {
  const n = buf.readUInt16BE(base + 2);
  let best = null;
  for (let i = 0; i < n; i++) {
    const o = base + 4 + i * 8;
    const platform = buf.readUInt16BE(o);
    const encoding = buf.readUInt16BE(o + 2);
    const offset = buf.readUInt32BE(o + 4);
    const format = buf.readUInt16BE(base + offset);
    let score = 0;
    if (platform === 3 && encoding === 10 && format === 12) score = 3;
    else if (platform === 3 && encoding === 1 && format === 4) score = 2;
    else if (platform === 0 && (format === 4 || format === 12)) score = 1;
    if (score && (!best || score > best.score)) best = { score, offset: base + offset, format };
  }
  const map = new Map();
  if (!best) return map;
  const o = best.offset;
  if (best.format === 4) {
    const segX2 = buf.readUInt16BE(o + 6);
    const endP = o + 14;
    const startP = endP + segX2 + 2;
    const deltaP = startP + segX2;
    const rangeP = deltaP + segX2;
    for (let s = 0; s < segX2 / 2; s++) {
      const end = buf.readUInt16BE(endP + s * 2);
      const start = buf.readUInt16BE(startP + s * 2);
      const delta = buf.readInt16BE(deltaP + s * 2);
      const rangeOffset = buf.readUInt16BE(rangeP + s * 2);
      if (start === 0xFFFF) continue;
      for (let c = start; c <= end; c++) {
        let gid;
        if (rangeOffset === 0) {
          gid = (c + delta) & 0xFFFF;
        } else {
          const gp = rangeP + s * 2 + rangeOffset + (c - start) * 2;
          if (gp + 2 > buf.length) continue;
          gid = buf.readUInt16BE(gp);
          if (gid !== 0) gid = (gid + delta) & 0xFFFF;
        }
        if (gid) map.set(c, gid);
      }
    }
  } else {
    const nGroups = buf.readUInt32BE(o + 12);
    for (let g = 0; g < nGroups; g++) {
      const p = o + 16 + g * 12;
      const start = buf.readUInt32BE(p);
      const end = buf.readUInt32BE(p + 4);
      const startGid = buf.readUInt32BE(p + 8);
      for (let c = start; c <= end && c - start < 70000; c++) map.set(c, startGid + (c - start));
    }
  }
  return map;
}

function parseMetrics(buf) {
  const t = sfntTables(buf);
  if (!t.head || !t.hhea || !t.hmtx || !t.maxp || !t.cmap) throw new Error('Fuente sin tablas básicas');
  const unitsPerEm = buf.readUInt16BE(t.head.offset + 18);
  const ascender = buf.readInt16BE(t.hhea.offset + 4);
  const descender = buf.readInt16BE(t.hhea.offset + 6);
  const numberOfHMetrics = buf.readUInt16BE(t.hhea.offset + 34);
  const numGlyphs = buf.readUInt16BE(t.maxp.offset + 4);
  const advances = new Uint16Array(numGlyphs);
  let last = 0;
  for (let g = 0; g < numGlyphs; g++) {
    if (g < numberOfHMetrics) last = buf.readUInt16BE(t.hmtx.offset + g * 4);
    advances[g] = last;
  }
  let capHeight = 0;
  if (t['OS/2'] && t['OS/2'].length >= 90 && buf.readUInt16BE(t['OS/2'].offset) >= 2) {
    capHeight = buf.readInt16BE(t['OS/2'].offset + 88);
  }
  return {
    unitsPerEm,
    ascender,
    descender,
    capHeight: capHeight > 0 ? capHeight : Math.round(unitsPerEm * 0.7),
    advances,
    cmap: parseCmap(buf, t.cmap.offset)
  };
}

/* ------------------------------------------------------------------ */
/* Carga                                                               */
/* ------------------------------------------------------------------ */

function fontsourceDir(pkg) {
  return path.join(path.dirname(require.resolve(`${pkg}/package.json`)), 'files');
}

function loadFace(key) {
  if (loaded.has(key)) return loaded.get(key);
  const def = FACES[key];
  if (!def) throw new Error(`Cara tipográfica desconocida: ${key}`);
  const dir = fontsourceDir(def.pkg);
  const woff = fs.readFileSync(path.join(dir, `${def.file}.woff`));
  const woff2 = fs.readFileSync(path.join(dir, `${def.file}.woff2`));
  const ttf = woffToSfnt(woff, { family: def.family });
  const face = {
    key,
    ...def,
    stack: def.family === 'Cinzel' ? STACKS.display : STACKS.italic,
    ttf,
    woff2,
    metrics: parseMetrics(ttf)
  };
  loaded.set(key, face);
  return face;
}

const EXTRA = {
  jp: { file: 'NotoSerifJP-sakura.ttf', family: 'Noto Serif JP', weight: 500 },
  sym: { file: 'SakuraSymbols.ttf', family: 'Sakura Symbols', weight: 400 }
};
const extraCache = new Map();

/** Fuentes de reserva empaquetadas en assets/fonts (japonés y símbolos/cirílico). */
function loadExtra(key) {
  if (extraCache.has(key)) return extraCache.get(key) || undefined;
  const def = EXTRA[key];
  let face = false;
  try {
    const file = path.join(FONT_DIR, def.file);
    const ttf = fs.readFileSync(file);
    let woff2 = null;
    try { woff2 = fs.readFileSync(file.replace(/\.ttf$/, '.woff2')); } catch { /* opcional */ }
    face = { key, family: def.family, weight: def.weight, style: 'normal', stack: key === 'jp' ? STACKS.jp : STACKS.display, ttf, woff2, metrics: parseMetrics(ttf) };
  } catch {
    face = false;
  }
  extraCache.set(key, face);
  return face || undefined;
}

function loadJp() {
  return loadExtra('jp');
}

function face(key) {
  if (EXTRA[key]) return loadExtra(key) || loadFace('cinzel-500');
  return loadFace(key);
}

/**
 * Caras de reserva necesarias para dibujar `text` con la cara `key`
 * (p. ej. ['jp'] si hay kana/kanji, ['sym'] si hay flechas, corazones o cirílico).
 */
function fallbacksFor(text, key) {
  const primary = face(key).metrics.cmap;
  const out = new Set();
  for (const ch of String(text || '')) {
    const cp = ch.codePointAt(0);
    if (primary.has(cp) || cp === 0x20) continue;
    for (const k of ['jp', 'sym']) {
      const f = loadExtra(k);
      if (f && f.metrics.cmap.has(cp)) { out.add(k); break; }
    }
  }
  return Array.from(out);
}

/* ------------------------------------------------------------------ */
/* API pública                                                         */
/* ------------------------------------------------------------------ */

/** true si el carácter se dibuja con la fuente japonesa. */
function isCjk(ch) {
  const c = ch.codePointAt(0);
  return (c >= 0x3000 && c <= 0x30ff) || (c >= 0x4e00 && c <= 0x9fff) || (c >= 0xff00 && c <= 0xffef) || (c >= 0x3400 && c <= 0x4dbf);
}

/** Ancho en px de `text` con la cara `key` a `size` px, más `letterSpacing` px entre caracteres. */
function measure(text, size, key, letterSpacing = 0) {
  const f = face(key);
  const { advances, cmap, unitsPerEm } = f.metrics;
  let units = 0;
  let count = 0;
  let width = 0;
  for (const ch of String(text || '')) {
    const cp = ch.codePointAt(0);
    const gid = cmap.get(cp);
    if (gid !== undefined && gid < advances.length) {
      units += advances[gid];
    } else {
      const fb = ['jp', 'sym'].map(loadExtra).find(x => x && x.metrics.cmap.has(cp));
      if (fb) {
        const m = fb.metrics;
        width += (m.advances[m.cmap.get(cp)] / m.unitsPerEm) * size;
      } else {
        units += isCjk(ch) ? unitsPerEm : ch === ' ' ? unitsPerEm * 0.25 : unitsPerEm * 0.6;
      }
    }
    count++;
  }
  return width + (units / unitsPerEm) * size + Math.max(0, count - 1) * letterSpacing;
}

/** Altura de mayúsculas en px (para centrar verticalmente). */
function capHeight(size, key) {
  const m = face(key).metrics;
  return (m.capHeight / m.unitsPerEm) * size;
}

/** Reglas @font-face con la fuente incrustada en base64 (solo las caras indicadas). */
function fontFaceCss(keys) {
  return Array.from(new Set(keys)).map(k => {
    const f = face(k);
    if (!f.woff2) return '';
    return `@font-face{font-family:'${f.family}';font-weight:${f.weight};font-style:${f.style};src:url(data:font/woff2;base64,${f.woff2.toString('base64')}) format('woff2');}`;
  }).join('');
}

/** Buffers TTF de todas las caras (para resvg). */
function fontBuffers() {
  const list = Object.keys(FACES).map(k => loadFace(k).ttf);
  for (const k of Object.keys(EXTRA)) { const f = loadExtra(k); if (f) list.push(f.ttf); }
  return list;
}

let fontFilesCache = null;

/**
 * Rutas a los TTF en disco para resvg (que solo acepta archivos).
 * Se materializan una vez en el directorio temporal del sistema; el nombre
 * incluye un hash del contenido para no reutilizar versiones antiguas.
 */
function fontFiles() {
  if (fontFilesCache) return fontFilesCache;
  const os = require('os');
  const crypto = require('crypto');
  const dir = path.join(os.tmpdir(), 'api-console-fonts');
  fs.mkdirSync(dir, { recursive: true });
  const entries = Object.keys(FACES).map(k => [k, loadFace(k).ttf]);
  for (const k of Object.keys(EXTRA)) { const f = loadExtra(k); if (f) entries.push([k, f.ttf]); }
  fontFilesCache = entries.map(([k, ttf]) => {
    const hash = crypto.createHash('sha1').update(ttf).digest('hex').slice(0, 10);
    const file = path.join(dir, `${k}-${hash}.ttf`);
    if (!fs.existsSync(file)) fs.writeFileSync(file, ttf);
    return file;
  });
  return fontFilesCache;
}

function hasJapanese() {
  return Boolean(loadJp());
}

module.exports = { FACES, STACKS, face, measure, capHeight, fontFaceCss, fontBuffers, fontFiles, isCjk, hasJapanese, fallbacksFor };
