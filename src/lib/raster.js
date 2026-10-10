/**
 * Rasterizador SVG → PNG / JPG para los endpoints de imagen.
 *
 * Usa @resvg/resvg-js (binario nativo precompilado, sin toolchain) con las
 * fuentes del proyecto, y jpeg-js para codificar JPEG desde los píxeles RGBA.
 * Si el binario nativo no está disponible en la plataforma, `available()`
 * devuelve false y los endpoints responden SVG en su lugar.
 */

'use strict';

const fonts = require('./fonts');

let Resvg = null;
let loadError = null;
try {
  ({ Resvg } = require('@resvg/resvg-js'));
} catch (err) {
  loadError = err;
}

let jpeg = null;
try {
  jpeg = require('jpeg-js');
} catch { /* sin JPEG: solo PNG */ }

const FORMATS = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml' };

function available() {
  return Boolean(Resvg);
}

/** Normaliza el formato pedido; si el rasterizador no existe siempre es svg. */
function pickFormat(value, fallback = 'jpg') {
  const f = String(value || fallback).toLowerCase();
  if (!Resvg) return 'svg';
  if (f === 'jpeg') return 'jpg';
  if (f === 'jpg' && !jpeg) return 'png';
  return FORMATS[f] ? f : (FORMATS[fallback] ? fallback : 'png');
}

/**
 * @param {string} svg
 * @param {{ width?: number, format?: 'png'|'jpg', quality?: number }} options
 * @returns {{ buffer: Buffer, mime: string, width: number, height: number }}
 */
function rasterize(svg, { width, format = 'png', quality = 90 } = {}) {
  if (!Resvg) {
    const err = new Error('Rasterizador no disponible en esta plataforma (usa format=svg).');
    err.code = 'NO_RASTER';
    err.cause = loadError;
    throw err;
  }
  const resvg = new Resvg(svg, {
    fitTo: width ? { mode: 'width', value: Math.round(width) } : { mode: 'original' },
    font: {
      fontFiles: fonts.fontFiles(),
      loadSystemFonts: false,
      defaultFontFamily: 'Cinzel'
    },
    shapeRendering: 2,
    textRendering: 2,
    imageRendering: 0
  });
  const image = resvg.render();

  if (format === 'jpg' && jpeg) {
    const encoded = jpeg.encode({ data: image.pixels, width: image.width, height: image.height }, quality);
    return { buffer: encoded.data, mime: 'image/jpeg', width: image.width, height: image.height };
  }
  return { buffer: image.asPng(), mime: 'image/png', width: image.width, height: image.height };
}

module.exports = { available, pickFormat, rasterize, FORMATS };
