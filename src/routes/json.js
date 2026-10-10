'use strict';

const express = require('express');
const { sendSuccess } = require('../lib/respond');
const { collectParams, asInteger, asEnum } = require('../lib/validate');
const { errors } = require('../lib/errors');
const { findJsonError, locateError } = require('../lib/json-scan');

const router = express.Router();

/** Tamaño máximo del JSON a analizar (además del límite del cuerpo de la petición). */
const MAX_JSON_LENGTH = 100_000;
/** A partir de este tamaño no se devuelve el valor completo, sólo un adelanto. */
const FULL_VALUE_LIMIT = 20_000;

/**
 * Calcula la profundidad máxima de anidamiento de un valor JSON.
 * @param {unknown} value
 * @param {number} [depth]
 */
function maxDepth(value, depth = 1) {
  if (value === null || typeof value !== 'object') return depth;
  const children = Array.isArray(value) ? value : Object.values(value);
  if (children.length === 0) return depth;
  return Math.max(...children.map((child) => maxDepth(child, depth + 1)));
}

/** Tipo JSON legible del valor. */
function jsonType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

/**
 * Combina el error nativo de JSON.parse con el escáner propio (json-scan) para
 * devolver siempre posición, línea, columna y fragmento señalado.
 * El escáner evita depender del formato de mensajes de V8, que cambia entre versiones.
 * @param {string} nativeMessage
 * @param {string} text
 */
function describeSyntaxError(nativeMessage, text) {
  const scanned = findJsonError(text);
  const base =
    scanned && scanned.position !== null
      ? locateError(scanned, text)
      : {
          position: null,
          line: null,
          column: null,
          snippet: null,
          reason: 'SINTAXIS_INVALIDA',
          label: 'Sintaxis inválida',
          hint: 'Revisa comas sobrantes, comillas simples, claves sin comillas y llaves sin cerrar.',
          message: nativeMessage,
        };

  return {
    reason: base.label,
    message: base.message,
    hint: base.hint,
    position: base.position ?? null,
    line: base.line ?? null,
    column: base.column ?? null,
    snippet: base.snippet ?? null,
    nativeMessage,
  };
}

/**
 * Extrae el texto a validar de la petición, admitiendo varias formas:
 *  1. ?json=... en la query.
 *  2. Cuerpo JSON con la forma { "json": "texto a validar" }.
 *  3. Cuerpo de texto plano (Content-Type: text/plain).
 *  4. Un cuerpo JSON normal, que ya es JSON válido por definición.
 * @param {import('express').Request} req
 * @returns {{text: string, source: string, notice?: string}}
 */
function extractJsonInput(req) {
  const params = collectParams(req);
  const queryValue = req.query ? req.query.json : undefined;

  if (typeof queryValue === 'string' && queryValue.trim() !== '') {
    return { text: queryValue, source: 'query (?json=...)' };
  }

  const body = req.body;

  if (typeof body === 'string' && body.trim() !== '') {
    return { text: body, source: 'cuerpo de texto plano' };
  }

  if (body && typeof body === 'object' && !Array.isArray(body) && typeof body.json === 'string') {
    return { text: body.json, source: 'cuerpo JSON con la propiedad "json"' };
  }

  if (body && typeof body === 'object' && Object.keys(body).length > 0) {
    return {
      text: JSON.stringify(body),
      source: 'cuerpo JSON enviado directamente',
      notice:
        'El cuerpo recibido ya era JSON válido (se analizó al recibir la petición). Para validar un texto con errores, envíalo como {"json":"texto"} o con Content-Type: text/plain.',
    };
  }

  const hasParams = Object.keys(params).length > 0;
  throw errors.badRequest(
    'MISSING_PARAM',
    'No se recibió ningún JSON que validar. Envía el texto con ?json=..., en el cuerpo como {"json":"..."} o con Content-Type: text/plain.',
    hasParams ? [{ name: 'recibido', value: Object.keys(params).join(', '), description: 'Parámetros recibidos que no son válidos para este endpoint.' }] : []
  );
}

/** POST|PUT /api/json/validate — valida un texto JSON e informa del error si lo hay. */
function validateHandler(req, res, next) {
  try {
    const { text, source, notice } = extractJsonInput(req);

    if (text.length > MAX_JSON_LENGTH) {
      throw errors.payloadTooLarge(
        `El JSON a validar ocupa ${text.length} caracteres y el máximo es ${MAX_JSON_LENGTH} (100 KB).`
      );
    }

    try {
      const value = JSON.parse(text);
      const tooBig = text.length > FULL_VALUE_LIMIT;
      const duplicates = findJsonError(text);
      const duplicateWarning =
        duplicates && duplicates.reason === 'DUPLICATE_KEY'
          ? { duplicateKeys: duplicates.duplicateKeys, warning: 'El JSON es válido, pero hay claves repetidas en un mismo objeto: al analizarlo sólo se conserva la última.' }
          : {};

      sendSuccess(
        res,
        {
          valid: true,
          source,
          inputLength: text.length,
          sizeBytes: Buffer.byteLength(text, 'utf8'),
          type: jsonType(value),
          depth: maxDepth(value),
          keys: value && typeof value === 'object' && !Array.isArray(value) ? Object.keys(value).slice(0, 50) : null,
          keyCount: value && typeof value === 'object' && !Array.isArray(value) ? Object.keys(value).length : null,
          arrayLength: Array.isArray(value) ? value.length : null,
          ...(tooBig
            ? {
                truncated: true,
                valuePreview: `${text.slice(0, 500)}…`,
                notice: 'El JSON es válido; se omite el valor completo por su tamaño (más de 20 KB).',
              }
            : { truncated: false, value }),
          ...duplicateWarning,
          ...(notice ? { notice } : {}),
        },
        { self: false }
      );
    } catch (error) {
      sendSuccess(
        res,
        {
          valid: false,
          source,
          inputLength: text.length,
          sizeBytes: Buffer.byteLength(text, 'utf8'),
          error: describeSyntaxError(error.message, text),
        },
        { self: false }
      );
    }
  } catch (error) {
    next(error);
  }
}

router.post('/validate', validateHandler);
router.put('/validate', validateHandler);

/** GET|POST /api/json/format — formatea o minifica un JSON. */
router.get('/format', formatHandler);
router.post('/format', formatHandler);

function formatHandler(req, res, next) {
  try {
    const params = collectParams(req);
    const text = params.json === undefined ? null : String(params.json);

    if (text === null || text.trim() === '') {
      throw errors.badRequest(
        'MISSING_PARAM',
        'Falta el parámetro "json" con el texto a formatear. Ejemplo: /api/json/format?json={"a":1}'
      );
    }
    if (text.length > MAX_JSON_LENGTH) {
      throw errors.payloadTooLarge(`El JSON supera el máximo de ${MAX_JSON_LENGTH} caracteres (100 KB).`);
    }

    const mode = asEnum(params.mode, 'mode', ['pretty', 'minify'], 'pretty');
    const indent = asInteger(params.indent, 'indent', 2);
    if (indent < 0 || indent > 8) {
      throw errors.badRequest('INVALID_INTEGER', 'indent debe estar entre 0 y 8.');
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      const detail = describeSyntaxError(error.message, text);
      throw errors.unprocessable('INVALID_JSON', `El texto enviado no es JSON válido: ${detail.message}`, [
        { name: 'motivo', value: detail.reason, description: 'Tipo de error de sintaxis detectado.' },
        { name: 'sugerencia', value: detail.hint, description: 'Cómo corregirlo.' },
        { name: 'posicion', value: detail.position ?? 'desconocida', description: 'Índice del carácter donde falla el análisis.' },
        { name: 'linea', value: detail.line ?? 'desconocida', description: 'Número de línea donde se detectó el error.' },
        { name: 'columna', value: detail.column ?? 'desconocida', description: 'Número de columna donde se detectó el error.' },
        ...(detail.snippet
          ? [{ name: 'fragmento', value: `${detail.snippet.line}\n${detail.snippet.pointer}`, description: 'Fragmento señalando el error.' }]
          : []),
      ]);
    }

    const output = mode === 'pretty' ? JSON.stringify(parsed, null, indent) : JSON.stringify(parsed);

    sendSuccess(
      res,
      {
        mode,
        indent: mode === 'pretty' ? indent : 0,
        parsed: true,
        inputBytes: Buffer.byteLength(text, 'utf8'),
        outputBytes: Buffer.byteLength(output, 'utf8'),
        savedBytes: Buffer.byteLength(text, 'utf8') - Buffer.byteLength(output, 'utf8'),
        output,
      },
      { self: false }
    );
  } catch (error) {
    next(error);
  }
}

module.exports = router;
