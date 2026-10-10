/**
 * Conversión WOFF 1.0 → SFNT (TTF/OTF) en memoria.
 *
 * Los paquetes @fontsource traen las fuentes en .woff/.woff2. El rasterizador
 * (resvg) solo entiende TTF/OTF, así que reconstruimos el sfnt original:
 * WOFF 1.0 es un sfnt cuyas tablas van comprimidas con zlib una a una.
 *
 * Además permite normalizar el nombre de familia (tabla `name`): los pesos
 * intermedios de Google Fonts (Medium, SemiBold…) se publican con la familia
 * "Cormorant Garamond Medium" en lugar de "Cormorant Garamond" + peso 500, y
 * el emparejador de fuentes de resvg no los encontraría por el nombre CSS.
 */

'use strict';

const zlib = require('zlib');

const WOFF_HEADER = 44;
const WOFF_ENTRY = 20;
const SFNT_HEADER = 12;
const SFNT_ENTRY = 16;

function pad4(n) {
  return (n + 3) & ~3;
}

/** Lee cabecera y tablas (ya descomprimidas) de un WOFF 1.0. */
function parseWoff(woff) {
  if (woff.toString('latin1', 0, 4) !== 'wOFF') {
    throw new Error('No es un archivo WOFF 1.0');
  }
  const flavor = woff.readUInt32BE(4);
  const numTables = woff.readUInt16BE(12);
  const tables = [];
  for (let i = 0; i < numTables; i++) {
    const o = WOFF_HEADER + i * WOFF_ENTRY;
    const offset = woff.readUInt32BE(o + 4);
    const compLength = woff.readUInt32BE(o + 8);
    const origLength = woff.readUInt32BE(o + 12);
    const raw = woff.subarray(offset, offset + compLength);
    tables.push({
      tag: woff.toString('latin1', o, o + 4),
      checksum: woff.readUInt32BE(o + 16),
      data: compLength < origLength ? zlib.inflateSync(raw) : Buffer.from(raw)
    });
  }
  return { flavor, tables };
}

/** Serializa un sfnt a partir de sus tablas. */
function buildSfnt(flavor, tables) {
  const numTables = tables.length;
  let total = SFNT_HEADER + SFNT_ENTRY * numTables;
  for (const t of tables) total += pad4(t.data.length);
  const out = Buffer.alloc(total);

  let entrySelector = 0;
  while ((2 << entrySelector) <= numTables) entrySelector++;
  const searchRange = (1 << entrySelector) * 16;

  out.writeUInt32BE(flavor, 0);
  out.writeUInt16BE(numTables, 4);
  out.writeUInt16BE(searchRange, 6);
  out.writeUInt16BE(entrySelector, 8);
  out.writeUInt16BE(numTables * 16 - searchRange, 10);

  let dataOffset = SFNT_HEADER + SFNT_ENTRY * numTables;
  tables.forEach((t, i) => {
    const o = SFNT_HEADER + i * SFNT_ENTRY;
    out.write(t.tag, o, 4, 'latin1');
    out.writeUInt32BE(t.checksum >>> 0, o + 4);
    out.writeUInt32BE(dataOffset, o + 8);
    out.writeUInt32BE(t.data.length, o + 12);
    t.data.copy(out, dataOffset);
    dataOffset += pad4(t.data.length);
  });
  return out;
}

/**
 * Reescribe la tabla `name` (formato 0) sustituyendo la familia (nameID 1 y 16)
 * por `family`. Devuelve la tabla original si el formato no es el esperado.
 */
function rewriteNameTable(data, family) {
  const format = data.readUInt16BE(0);
  if (format !== 0) return data;
  const count = data.readUInt16BE(2);
  const stringOffset = data.readUInt16BE(4);
  const records = [];
  for (let i = 0; i < count; i++) {
    const o = 6 + i * 12;
    const rec = {
      platformID: data.readUInt16BE(o),
      encodingID: data.readUInt16BE(o + 2),
      languageID: data.readUInt16BE(o + 4),
      nameID: data.readUInt16BE(o + 6)
    };
    const length = data.readUInt16BE(o + 8);
    const offset = data.readUInt16BE(o + 10);
    rec.str = Buffer.from(data.subarray(stringOffset + offset, stringOffset + offset + length));
    if (rec.nameID === 1 || rec.nameID === 16) {
      rec.str = rec.platformID === 1 ? Buffer.from(family, 'latin1') : Buffer.from(family, 'utf16le').swap16();
    }
    records.push(rec);
  }
  const strings = Buffer.concat(records.map(r => r.str));
  const out = Buffer.alloc(6 + count * 12 + strings.length);
  out.writeUInt16BE(0, 0);
  out.writeUInt16BE(count, 2);
  out.writeUInt16BE(6 + count * 12, 4);
  let cursor = 0;
  records.forEach((r, i) => {
    const o = 6 + i * 12;
    out.writeUInt16BE(r.platformID, o);
    out.writeUInt16BE(r.encodingID, o + 2);
    out.writeUInt16BE(r.languageID, o + 4);
    out.writeUInt16BE(r.nameID, o + 6);
    out.writeUInt16BE(r.str.length, o + 8);
    out.writeUInt16BE(cursor, o + 10);
    r.str.copy(out, 6 + count * 12 + cursor);
    cursor += r.str.length;
  });
  return out;
}

/**
 * @param {Buffer} woff
 * @param {{ family?: string }} [options]  `family` fuerza el nombre de familia.
 * @returns {Buffer} sfnt (TTF/OTF)
 */
function woffToSfnt(woff, options = {}) {
  const { flavor, tables } = parseWoff(woff);
  if (options.family) {
    const name = tables.find(t => t.tag === 'name');
    if (name) name.data = rewriteNameTable(name.data, options.family);
  }
  return buildSfnt(flavor, tables);
}

module.exports = { woffToSfnt, parseWoff, buildSfnt, rewriteNameTable };
