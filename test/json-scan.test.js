'use strict';

/**
 * Pruebas del escáner de JSON. Se ejecutan con `npm test` (node:test, sin dependencias).
 * El objetivo es doble: que el escáner detecte los errores típicos y que su
 * veredicto coincida siempre con el de JSON.parse.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { findJsonError, locateError } = require('../src/lib/json-scan');

/** JSON válidos: el escáner no debe señalar ningún error. */
const VALID = [
  '{}',
  '[]',
  '{"a":1}',
  '[1,2,3]',
  '[1.5, -2, 3e10, 1E-3]',
  '{"a":{"b":[{"c":null}]}}',
  '{"texto":"línea\\ncon salto","unicode":"\\u00e1","emoji":"😀"}',
  '  {"espacios": true, "salto": false}  ',
  '"cadena suelta"',
  '123',
  'true',
  'null',
  '{"ñ":"acentuado: canción"}',
];

/** JSON inválidos: el escáner y JSON.parse deben rechazarlos. */
const INVALID = [
  ['{"a":1,}', 'TRAILING_COMMA'],
  ['[1,2,]', 'TRAILING_COMMA'],
  ['{"a" 1}', 'EXPECTED_COLON'],
  ['{a:1}', 'EXPECTED_KEY'],
  ['[1,2', 'UNEXPECTED_END'],
  ['{"a":1', 'UNEXPECTED_END'],
  ['{"a": "sin cerrar}', 'UNTERMINATED_STRING'],
  ['{"a": 1} sobra', 'TRAILING_CONTENT'],
  ['{"a": 01}', 'INVALID_NUMBER'],
  ['{"a": .5}', 'UNEXPECTED_TOKEN'],
  ["{'a':1}", 'UNEXPECTED_TOKEN'],
  ['{"texto": "salto\nde línea"}', 'UNESCAPED_CONTROL'],
  ['{"a": "escape \\x inválido"}', 'INVALID_ESCAPE'],
  ['{"a": "\\u12"}', 'INVALID_UNICODE_ESCAPE'],
  ['', 'UNEXPECTED_END'],
];

test('acepta los JSON válidos (igual que JSON.parse)', () => {
  for (const text of VALID) {
    assert.doesNotThrow(() => JSON.parse(text), `JSON.parse debería aceptar: ${text}`);
    assert.equal(findJsonError(text), null, `El escáner no debería señalar error en: ${text}`);
  }
});

test('detecta los JSON inválidos con el motivo correcto', () => {
  for (const [text, reason] of INVALID) {
    assert.throws(() => JSON.parse(text), `JSON.parse debería rechazar: ${text}`);
    const error = findJsonError(text);
    assert.ok(error, `El escáner debería detectar un error en: ${text}`);
    assert.equal(error.reason, reason, `Motivo inesperado en "${text}"`);
    assert.ok(error.label && error.hint, 'Cada motivo debe incluir etiqueta y sugerencia');
  }
});

test('el veredicto coincide con JSON.parse en una muestra amplia', () => {
  const samples = [...VALID, ...INVALID.map(([text]) => text)];
  for (const text of samples) {
    let parses = true;
    try {
      JSON.parse(text);
    } catch {
      parses = false;
    }
    const scanOk = findJsonError(text) === null;
    assert.equal(scanOk, parses, `Discrepancia con "${text}": parse=${parses} scan=${parses}`);
  }
});

test('localiza línea, columna y fragmento con el puntero', () => {
  const text = '{\n  "a": 1,\n  "b": ,\n  "c": 3\n}';
  const error = findJsonError(text);
  assert.ok(error);
  const located = locateError(error, text);
  assert.equal(located.line, 3);
  assert.ok(located.column > 1);
  assert.ok(located.snippet.line.includes('"b"'));
  assert.equal(located.snippet.pointer.trim(), '^');
  assert.ok(located.snippet.pointer.endsWith('^'), 'El puntero debe terminar en el carácter ^');
  assert.ok(located.snippet.pointer.length <= located.snippet.line.length + 1, 'El puntero no debe desbordar la línea mostrada');
});

test('informa de claves duplicadas sin marcar el JSON como inválido', () => {
  const text = '{"a": 1, "a": 2, "b": {"c": 1, "c": 2}}';
  assert.doesNotThrow(() => JSON.parse(text));
  const result = findJsonError(text);
  assert.ok(result, 'Debería avisar de las claves duplicadas');
  assert.equal(result.reason, 'DUPLICATE_KEY');
  assert.deepEqual(result.duplicateKeys, ['a', 'c']);
});

test('rechaza un anidamiento desmedido', () => {
  const text = `${'['.repeat(200)}1${']'.repeat(200)}`;
  const error = findJsonError(text);
  assert.ok(error);
  assert.equal(error.reason, 'TOO_DEEP');
});
