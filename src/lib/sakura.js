/**
 * Motor de los canvas "Sakura Night": plantillas pintadas (assets/canvas/sakura)
 * sobre las que se dibujan dinámicamente avatares, títulos, textos, números,
 * cajas y ornamentos con brillo, respetando el lenguaje visual original
 * (serif romana tipo Cinzel, cursiva Garamond, destellos de 4 puntas,
 * rombos y flores de cinco pétalos).
 *
 * Todos los parámetros son configurables desde la query string:
 *   - contenido: textos, números, avatar (URL o nombre de /assets)
 *   - estilo: color, glow, tint, format (jpg|png|svg), width, quality
 */

'use strict';

const { escapeXml, hexColor, clamp, sendSvg } = require('./util');
const assets = require('./assets');
const fonts = require('./fonts');
const raster = require('./raster');

const PLATES = {
  welcome: { file: 'canvas/sakura/welcome.jpg', w: 1366, h: 768 },
  goodbye: { file: 'canvas/sakura/goodbye.jpg', w: 1366, h: 768 },
  levelup: { file: 'canvas/sakura/levelup.jpg', w: 1366, h: 768 },
  'levelup-v2': { file: 'canvas/sakura/levelup-v2.jpg', w: 1366, h: 768 },
  ship: { file: 'canvas/sakura/ship.jpg', w: 1366, h: 768 },
  gay: { file: 'canvas/sakura/gay.jpg', w: 1024, h: 1024 }
};

const FACE = {
  title: 'cinzel-700',
  label: 'cinzel-500',
  small: 'cinzel-400',
  italic: 'cormorant-500i',
  italicBold: 'cormorant-600i'
};

const bgCache = new Map();
function backgroundUri(plate) {
  if (!bgCache.has(plate.file)) bgCache.set(plate.file, assets.dataUri(plate.file));
  return bgCache.get(plate.file);
}

/* ------------------------------------------------------------------ */
/* Parámetros comunes                                                  */
/* ------------------------------------------------------------------ */

function str(value, fallback, max = 120) {
  const s = value === undefined || value === null ? '' : String(value).replace(/\s+/g, ' ').trim();
  if (/^(none|null|off)$/i.test(s)) return ''; // permite ocultar un elemento opcional
  return (s || fallback || '').slice(0, max);
}

function int(value, fallback, min, max) {
  const n = parseInt(value, 10);
  return clamp(Number.isFinite(n) ? n : fallback, min, max);
}

function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3 || h.length === 4) h = h.split('').map(c => c + c).join('');
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
}

function parseStyle(q, plate) {
  const color = hexColor(q.color, '#ffffff');
  return {
    color,
    glow: hexColor(q.glow, color),
    tint: hexColor(q.tint, '') || null,
    format: raster.pickFormat(q.format, 'jpg'),
    width: int(q.width, plate.w, 320, 2400),
    quality: int(q.quality, 90, 40, 100)
  };
}

/** Parámetros de estilo compartidos por todos los canvas (para el catálogo). */
const STYLE_PARAMS = [
  { name: 'color', type: 'color', required: false, example: '#ffffff', description: 'Color de textos y ornamentos (hex)' },
  { name: 'glow', type: 'color', required: false, example: '', description: 'Color del resplandor (por defecto, el mismo que color)' },
  { name: 'tint', type: 'color', required: false, example: '', description: 'Tiñe el fondo blanco y negro con este color (vacío = original)' },
  { name: 'format', type: 'select', options: ['jpg', 'png', 'svg'], required: false, example: 'jpg', description: 'Formato de salida' },
  { name: 'width', type: 'range', min: 320, max: 2400, step: 10, required: false, example: '', description: 'Ancho de salida en px (vacío = tamaño original)' },
  { name: 'quality', type: 'range', min: 40, max: 100, step: 5, required: false, example: '', description: 'Calidad JPG (por defecto 90)' }
];

/* ------------------------------------------------------------------ */
/* Contexto de dibujo                                                  */
/* ------------------------------------------------------------------ */

function createContext(style) {
  return { style, under: [], glow: [], defs: [], faces: new Set(), ids: 0 };
}

function faceAttrs(ctx, key, extras) {
  const f = fonts.face(key);
  ctx.faces.add(key);
  let family = f.stack;
  if (extras.length) {
    const [first, ...rest] = f.stack.split(',');
    const fams = extras.map(k => { ctx.faces.add(k); return `'${fonts.face(k).family}'`; });
    family = [first, ...fams, ...rest.map(x => x.trim())].join(', ');
  }
  return `font-family="${family}" font-weight="${f.weight}" font-style="${f.style}"`;
}

/**
 * Texto con tamaño ajustado al ancho máximo.
 * `cy` centra verticalmente las mayúsculas; `y` es la línea base.
 */
function text(ctx, value, { x, y, cy, face = FACE.title, size = 32, maxWidth = 0, min = 10, spacing = 0, anchor = 'middle', fill, opacity, upper = false }) {
  let s = upper ? String(value).toUpperCase() : String(value);
  if (!s) return { svg: '', width: 0, size, baseline: y || cy };
  let fontSize = size;
  let ls = spacing * fontSize;
  let width = fonts.measure(s, fontSize, face, ls);
  if (maxWidth > 0 && width > maxWidth) {
    fontSize = Math.max(min, fontSize * (maxWidth / width));
    ls = spacing * fontSize;
    width = fonts.measure(s, fontSize, face, ls);
  }
  const baseline = y !== undefined ? y : cy + fonts.capHeight(fontSize, face) / 2;
  const dx = anchor === 'middle' ? ls / 2 : 0; // compensa el espaciado tras el último carácter
  const svg = `<text x="${(x + dx).toFixed(1)}" y="${baseline.toFixed(1)}" ${faceAttrs(ctx, face, fonts.fallbacksFor(s, face))} font-size="${fontSize.toFixed(1)}"${ls ? ` letter-spacing="${ls.toFixed(2)}"` : ''} text-anchor="${anchor}" fill="${fill || ctx.style.color}"${opacity ? ` opacity="${opacity}"` : ''}>${escapeXml(s)}</text>`;
  return { svg, width, size: fontSize, baseline };
}

/** Divide en líneas por ancho real; reduce el tamaño hasta caber en maxLines. */
function paragraph(value, { face, size, maxWidth, maxLines = 3, min = 14, spacing = 0, balance = true }) {
  let fontSize = size;
  for (;;) {
    const ls = spacing * fontSize;
    let lines = wrap(value, face, fontSize, maxWidth, ls);
    if (lines.length <= maxLines || fontSize <= min) {
      if (lines.length > maxLines) {
        const cut = lines.slice(0, maxLines);
        cut[maxLines - 1] = cut[maxLines - 1].replace(/[\s.,;:!?]*$/, '').replace(/.{1,2}$/, '') + '…';
        return { lines: cut, size: fontSize };
      }
      if (balance && lines.length > 1) lines = balanced(value, face, fontSize, maxWidth, ls, lines);
      return { lines, size: fontSize };
    }
    fontSize = Math.max(min, fontSize * 0.92);
  }
}

/** Reparte las palabras para que las líneas queden de ancho parecido (mismo nº de líneas). */
function balanced(value, face, size, maxWidth, ls, greedy) {
  const n = greedy.length;
  let lo = maxWidth * 0.45;
  let hi = maxWidth;
  let best = greedy;
  for (let i = 0; i < 10; i++) {
    const mid = (lo + hi) / 2;
    const attempt = wrap(value, face, size, mid, ls);
    if (attempt.length === n) { hi = mid; best = attempt; } else lo = mid;
  }
  return best;
}

function wrap(value, face, size, maxWidth, ls = 0) {
  const out = [];
  for (const raw of String(value).split(/\s*\|\s*|\n/)) {
    const words = raw.split(/\s+/).filter(Boolean);
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (!line || fonts.measure(candidate, size, face, ls) <= maxWidth) {
        line = candidate;
      } else {
        out.push(line);
        line = word;
      }
    }
    if (line) out.push(line);
  }
  // parte palabras demasiado largas
  const broken = [];
  for (const line of out) {
    if (fonts.measure(line, size, face, ls) <= maxWidth) { broken.push(line); continue; }
    let piece = '';
    for (const ch of line) {
      if (piece && fonts.measure(piece + ch, size, face, ls) > maxWidth) { broken.push(piece); piece = ch; } else piece += ch;
    }
    if (piece) broken.push(piece);
  }
  return broken.length ? broken : [''];
}

/** Dibuja un párrafo centrado; devuelve la última línea base. */
function lines(ctx, value, { x, y, centerY, face = FACE.italic, size = 28, lineHeight = 1.2, maxWidth, maxLines = 3, min = 14, fill, upper = false, spacing = 0, balance = true }) {
  const p = paragraph(upper ? String(value).toUpperCase() : value, { face, size, maxWidth, maxLines, min, spacing, balance });
  const lh = p.size * lineHeight;
  if (y === undefined) {
    // centra verticalmente el bloque en centerY (línea base de la primera línea)
    const capH = fonts.capHeight(p.size, face);
    y = centerY - ((p.lines.length - 1) * lh) / 2 + capH / 2;
  }
  let baseline = y;
  const parts = p.lines.map((l, i) => {
    baseline = y + i * lh;
    return text(ctx, l, { x, y: baseline, face, size: p.size, fill, spacing }).svg;
  });
  ctx.glow.push(parts.join(''));
  return { last: baseline, size: p.size, count: p.lines.length, lineHeight: lh };
}

/* ------------------------------------------------------------------ */
/* Ornamentos                                                          */
/* ------------------------------------------------------------------ */

function sparkle(ctx, cx, cy, r, opacity = 1) {
  const k = r * 0.18;
  const fill = ctx.style.color;
  return `<path d="M${cx} ${cy - r} C${cx} ${cy - k} ${cx + k} ${cy} ${cx + r} ${cy} C${cx + k} ${cy} ${cx} ${cy + k} ${cx} ${cy + r} C${cx} ${cy + k} ${cx - k} ${cy} ${cx - r} ${cy} C${cx - k} ${cy} ${cx} ${cy - k} ${cx} ${cy - r}Z" fill="${fill}"${opacity !== 1 ? ` opacity="${opacity}"` : ''}/>`;
}

function diamond(ctx, cx, cy, r) {
  const fill = ctx.style.color;
  return `<path d="M${cx} ${cy - r} L${cx + r * 0.62} ${cy} L${cx} ${cy + r} L${cx - r * 0.62} ${cy}Z" fill="${fill}"/><path d="M${cx} ${cy - r * 1.9} L${cx + r * 1.18} ${cy} L${cx} ${cy + r * 1.9} L${cx - r * 1.18} ${cy}Z" fill="none" stroke="${fill}" stroke-width="1"/>`;
}

function flower(ctx, cx, cy, r) {
  const fill = ctx.style.color;
  const petals = [0, 72, 144, 216, 288].map(a =>
    `<ellipse cx="${cx}" cy="${(cy - r * 0.55).toFixed(1)}" rx="${(r * 0.32).toFixed(1)}" ry="${(r * 0.55).toFixed(1)}" transform="rotate(${a} ${cx} ${cy})" fill="${fill}"/>`).join('');
  return `<g>${petals}<circle cx="${cx}" cy="${cy}" r="${(r * 0.22).toFixed(1)}" fill="#111" opacity="0.8"/></g>`;
}

function line(ctx, x1, x2, y, width = 1.4, opacity = 0.9) {
  return `<line x1="${x1.toFixed(1)}" y1="${y}" x2="${x2.toFixed(1)}" y2="${y}" stroke="${ctx.style.color}" stroke-width="${width}" stroke-linecap="round" opacity="${opacity}"/>`;
}

/** Línea horizontal con rombo (o flor) central y destellos en los extremos. */
function divider(ctx, cx, y, half, { center = 'diamond', gap = 16, ends = true, r = 6 } = {}) {
  const parts = [line(ctx, cx - half, cx - gap, y), line(ctx, cx + gap, cx + half, y)];
  if (center === 'diamond') parts.push(diamond(ctx, cx, y, r));
  else if (center === 'flower') parts.push(flower(ctx, cx, y, r * 1.6));
  if (ends) parts.push(sparkle(ctx, cx - half - 10, y, 6), sparkle(ctx, cx + half + 10, y, 6));
  ctx.glow.push(parts.join(''));
}

/** "✦— TÍTULO —✦": líneas y destellos a ambos lados de un texto ya medido. */
function flankers(ctx, left, right, y, { length = 64, gap = 26, r = 10 } = {}) {
  ctx.glow.push(
    line(ctx, left - gap, left - gap - length, y),
    sparkle(ctx, left - gap - length - r - 4, y, r),
    line(ctx, right + gap, right + gap + length, y),
    sparkle(ctx, right + gap + length + r + 4, y, r)
  );
}

/** Texto vertical (un carácter por línea), para los rótulos japoneses. */
function vertical(ctx, value, { x, top, size = 24, gap = 8, bottom = Infinity }) {
  const chars = Array.from(String(value)).filter(c => c !== ' ').slice(0, 10);
  if (!chars.length) return top;
  const step = size + gap;
  let cjk = chars.some(fonts.isCjk);
  const face = cjk ? 'jp' : FACE.label;
  const parts = [line(ctx, x - 14, x + 14, top - 18, 1.2)];
  let y = top;
  chars.forEach((ch, i) => {
    y = top + size + i * step;
    if (y > bottom) return;
    parts.push(text(ctx, cjk ? ch : ch.toUpperCase(), { x, y, face, size }).svg);
  });
  parts.push(sparkle(ctx, x, y + 26, 7));
  ctx.glow.push(parts.join(''));
  return y + 26;
}

/** Avatar circular recortado, colocado sobre el hueco de la plantilla. */
function avatar(ctx, uri, cx, cy, r) {
  if (!uri) return;
  const id = `clip-${++ctx.ids}`;
  const d = r * 2;
  ctx.defs.push(`<clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>`);
  ctx.under.push(`<image href="${uri}" x="${(cx - r).toFixed(1)}" y="${(cy - r).toFixed(1)}" width="${d}" height="${d}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#000" stroke-opacity="0.45" stroke-width="3"/>`);
}

/** Barra de progreso tipo cápsula con brillo. */
function capsule(ctx, x, y, w, h, pct) {
  const id = `bar-${++ctx.ids}`;
  const c = ctx.style.color;
  ctx.defs.push(`<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${c}" stop-opacity="0.55"/><stop offset="1" stop-color="${c}" stop-opacity="1"/></linearGradient>`);
  const inner = Math.max(0, Math.min(1, pct / 100));
  const pad = 5;
  const fillW = inner > 0 ? Math.max(h - pad * 2, (w - pad * 2) * inner) : 0;
  ctx.glow.push(
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${c}" fill-opacity="0.08" stroke="${c}" stroke-width="2"/>`,
    fillW ? `<rect x="${x + pad}" y="${y + pad}" width="${fillW.toFixed(1)}" height="${h - pad * 2}" rx="${(h - pad * 2) / 2}" fill="url(#${id})"/>` : '',
    sparkle(ctx, x - 22, y + h / 2, 9),
    sparkle(ctx, x + w + 22, y + h / 2, 9)
  );
}

/* ------------------------------------------------------------------ */
/* Documento                                                           */
/* ------------------------------------------------------------------ */

function glowFilter(ctx, w, h) {
  const g = ctx.style.glow;
  return `<filter id="glow" filterUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}" color-interpolation-filters="sRGB">
      <feGaussianBlur in="SourceAlpha" stdDeviation="2.5" result="b1"/>
      <feGaussianBlur in="SourceAlpha" stdDeviation="9" result="b2"/>
      <feFlood flood-color="${g}" flood-opacity="0.95" result="f1"/>
      <feComposite in="f1" in2="b1" operator="in" result="g1"/>
      <feFlood flood-color="${g}" flood-opacity="0.55" result="f2"/>
      <feComposite in="f2" in2="b2" operator="in" result="g2"/>
      <feMerge><feMergeNode in="g2"/><feMergeNode in="g1"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>`;
}

function tintFilter(tint) {
  const [r, g, b] = hexToRgb(tint);
  return `<filter id="tint" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${r.toFixed(3)} 0 0 0 0  0 ${g.toFixed(3)} 0 0 0  0 0 ${b.toFixed(3)} 0 0  0 0 0 1 0"/></filter>`;
}

function document(plate, ctx, { embedFonts, outWidth }) {
  const { w, h } = plate;
  const outW = outWidth || w;
  const outH = Math.round(outW * h / w);
  const css = embedFonts ? fonts.fontFaceCss(Array.from(ctx.faces)) : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${outW}" height="${outH}" viewBox="0 0 ${w} ${h}">
  <defs>
    ${css ? `<style type="text/css">${css}</style>` : ''}
    ${glowFilter(ctx, w, h)}
    ${ctx.style.tint ? tintFilter(ctx.style.tint) : ''}
    ${ctx.defs.join('\n    ')}
  </defs>
  <image href="${backgroundUri(plate)}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none"${ctx.style.tint ? ' filter="url(#tint)"' : ''}/>
  ${ctx.under.join('\n  ')}
  <g filter="url(#glow)">
    ${ctx.glow.join('\n    ')}
  </g>
</svg>`;
}

/* ------------------------------------------------------------------ */
/* Respuesta HTTP (con caché LRU de renders)                           */
/* ------------------------------------------------------------------ */

const renderCache = new Map();
const CACHE_MAX = 80;
const CACHE_TTL = 5 * 60 * 1000;

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {string} plateName
 * @param {(ctx: object, style: object) => void} draw  dibuja sobre el contexto
 * @param {{cache?: boolean}} [opts]  cache=false para resultados aleatorios
 */
function respond(req, res, plateName, draw, { cache = true } = {}) {
  const plate = PLATES[plateName];
  const style = parseStyle(req.query, plate);
  const key = `${plateName}|${req.originalUrl}`;
  const cached = cache ? renderCache.get(key) : null;
  if (cached && cached.expires > Date.now()) {
    renderCache.delete(key);
    renderCache.set(key, cached);
    return send(res, cached.payload);
  }

  const ctx = createContext(style);
  draw(ctx, style);
  const embedFonts = style.format === 'svg';
  const svg = document(plate, ctx, { embedFonts, outWidth: style.width });

  let payload;
  if (style.format === 'svg') {
    payload = { buffer: Buffer.from(svg), mime: 'image/svg+xml', width: style.width, height: Math.round(style.width * plate.h / plate.w) };
  } else {
    try {
      payload = raster.rasterize(svg, { width: style.width, format: style.format, quality: style.quality });
    } catch (err) {
      if (err.code !== 'NO_RASTER') throw err;
      payload = { buffer: Buffer.from(document(plate, ctx, { embedFonts: true, outWidth: style.width })), mime: 'image/svg+xml', width: style.width, height: Math.round(style.width * plate.h / plate.w) };
    }
  }

  if (cache) {
    if (renderCache.size >= CACHE_MAX) renderCache.delete(renderCache.keys().next().value);
    renderCache.set(key, { payload, expires: Date.now() + CACHE_TTL });
  }
  return send(res, payload, cache);
}

function send(res, payload, cache = true) {
  res.setHeader('Content-Type', payload.mime);
  res.setHeader('Cache-Control', cache ? 'public, max-age=300' : 'no-store');
  res.setHeader('X-Canvas-Size', `${payload.width}x${payload.height}`);
  res.setHeader('Access-Control-Expose-Headers', 'X-Canvas-Size, X-Response-Time');
  res.send(payload.buffer);
}

module.exports = {
  PLATES,
  FACE,
  STYLE_PARAMS,
  str,
  int,
  parseStyle,
  text,
  lines,
  paragraph,
  sparkle,
  diamond,
  flower,
  divider,
  flankers,
  vertical,
  avatar,
  capsule,
  respond,
  sendSvg
};
