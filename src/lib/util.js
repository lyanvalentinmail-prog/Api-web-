/**
 * Utilidades compartidas por los generadores de imágenes SVG.
 * Todo lo que hay aquí es puro (sin dependencias de Express) y fácil de probar.
 */

'use strict';

/** Escapa texto para incrustarlo de forma segura en XML/SVG. */
function escapeXml(unsafe) {
  return String(unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Envía un SVG con las cabeceras correctas. */
function sendSvg(res, svg, cacheSeconds = 0) {
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', cacheSeconds > 0 ? `public, max-age=${cacheSeconds}` : 'no-cache');
  res.send(svg);
}

/** Devuelve el hex si es válido, o el fallback. */
function hexColor(value, fallback) {
  return /^#[0-9a-f]{3,8}$/i.test(String(value || '').trim()) ? value.trim() : fallback;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Ancho aproximado (px) de un texto para un font-size dado,
 * calibrado para pilas tipo SF Pro / Helvetica / Arial.
 * Suficiente para maquetar burbujas y tarjetas sin medir con canvas.
 */
function textWidth(text, fontSize) {
  let units = 0;
  for (const ch of String(text)) {
    const code = ch.codePointAt(0);
    if (code > 0x2000) units += 1.05; // símbolos, emoji, CJK…
    else if ('mwMW@%&'.includes(ch)) units += 0.92;
    else if ('iljft.,;:!|()[]{}-\'"'.includes(ch)) units += 0.34;
    else if (ch === ' ') units += 0.3;
    else if ('ABCDEFGHIJLNOPQRSTUVXYZ'.includes(ch)) units += 0.68;
    else if (/^[0-9]$/.test(ch)) units += 0.58;
    else units += 0.55;
  }
  return units * fontSize;
}

/**
 * Word-wrap por ancho máximo en px. Devuelve líneas de texto.
 * `maxLines = 0` significa sin límite.
 */
function wrapText(text, maxWidth, fontSize, maxLines = 0) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (textWidth(candidate, fontSize) <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);

  // Rompe palabras demasiado largas (URLs, tokens).
  const broken = [];
  for (const line of lines) {
    if (textWidth(line, fontSize) <= maxWidth || maxWidth <= 0) {
      broken.push(line);
      continue;
    }
    let piece = '';
    for (const ch of line) {
      if (textWidth(piece + ch, fontSize) > maxWidth && piece) {
        broken.push(piece);
        piece = ch;
      } else {
        piece += ch;
      }
    }
    if (piece) broken.push(piece);
  }

  if (maxLines > 0 && broken.length > maxLines) {
    const cut = broken.slice(0, maxLines);
    cut[cut.length - 1] = cut[cut.length - 1].replace(/.{1,2}$/, '') + '…';
    return cut;
  }
  return broken;
}

/** Trunca un texto a N caracteres añadiendo … */
function truncate(text, max) {
  const s = String(text || '');
  return s.length <= max ? s : s.slice(0, Math.max(0, max - 1)).trimEnd() + '…';
}

/** Iniciales de un nombre ("Lyan Valentin" -> "LV"). */
function initialsOf(name) {
  return String(name || 'U')
    .replace(/[^A-Za-zÀ-ÿ0-9 ]/g, '')
    .split(' ')
    .map(w => w[0] || '')
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'U';
}

/** Convierte "9:41" + opcional a formato "Hoy 9:41" para separadores de chat. */
function seedFrom(str) {
  let h = 0x811c9dc5;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

module.exports = {
  escapeXml,
  sendSvg,
  hexColor,
  clamp,
  textWidth,
  wrapText,
  truncate,
  initialsOf,
  seedFrom
};
