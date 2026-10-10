/**
 * Cargador de assets estáticos (carpeta /assets del repositorio).
 * Los generadores SVG usan este módulo para incrustar imágenes (avatares,
 * fondos, patrones) en sus salidas, de modo que cada respuesta es autónoma.
 * Express también sirve la carpeta completa bajo GET /assets/*.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ASSETS_ROOT = path.join(__dirname, '..', '..', 'assets');

const MIME = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif'
};

const cache = new Map();

function resolveAsset(rel) {
  const abs = path.join(ASSETS_ROOT, rel);
  if (!abs.startsWith(ASSETS_ROOT + path.sep)) {
    throw new Error(`Ruta de asset inválida: ${rel}`);
  }
  return abs;
}

/** Lee el asset en crudo (Buffer), con caché en memoria. */
function readAsset(rel) {
  if (!cache.has(rel)) {
    cache.set(rel, fs.readFileSync(resolveAsset(rel)));
  }
  return cache.get(rel);
}

/** Devuelve un data URI base64 listo para usar en <image href="...">. */
function dataUri(rel) {
  const ext = path.extname(rel).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  return `data:${mime};base64,${readAsset(rel).toString('base64')}`;
}

/**
 * Incrusta un SVG del repositorio como <svg> anidado en la posición indicada.
 * Los SVG de /assets se escriben sin atributos de tamaño para permitir esto.
 */
function inlineSvg(rel, x, y, width, height, extra = '') {
  const src = readAsset(rel).toString('utf8').trim();
  return src.replace(
    '<svg ',
    `<svg x="${x}" y="${y}" width="${width}" height="${height}" ${extra}`
  );
}

/** true si el asset existe en disco. */
function hasAsset(rel) {
  try {
    return fs.existsSync(resolveAsset(rel));
  } catch {
    return false;
  }
}

/** Lista relativa de assets disponibles (útil para documentación/parámetros). */
function listAssets(dir = '') {
  const base = path.join(ASSETS_ROOT, dir);
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base, { withFileTypes: true })
    .filter(e => e.isFile())
    .map(e => path.posix.join(dir, e.name))
    .sort();
}

module.exports = { ASSETS_ROOT, readAsset, dataUri, inlineSvg, hasAsset, listAssets };
