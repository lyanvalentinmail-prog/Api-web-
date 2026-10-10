'use strict';

const express = require('express');
const { sendSuccess } = require('../lib/respond');
const { collectParams, asNumber, asText, LIMITS } = require('../lib/validate');
const { errors } = require('../lib/errors');

const router = express.Router();

/** Redondea a 10 decimales para evitar ruido de coma flotante en las respuestas. */
const round = (value) => Number(value.toFixed(10));

/** GET /api/math/add — suma de dos números. */
router.get('/add', (req, res, next) => {
  try {
    const params = collectParams(req);
    const a = asNumber(params.a, 'a');
    const b = asNumber(params.b, 'b');
    const result = round(a + b);
    sendSuccess(
      res,
      { a, b, operation: 'addition', result, expression: `${a} + ${b} = ${result}` },
      { self: false }
    );
  } catch (error) {
    next(error);
  }
});

/** GET /api/math/multiply — producto de dos números. */
router.get('/multiply', (req, res, next) => {
  try {
    const params = collectParams(req);
    const a = asNumber(params.a, 'a');
    const b = asNumber(params.b, 'b');
    const result = round(a * b);
    sendSuccess(
      res,
      { a, b, operation: 'multiplication', result, expression: `${a} × ${b} = ${result}` },
      { self: false }
    );
  } catch (error) {
    next(error);
  }
});

/** Cuantil con interpolación lineal (método R-7, el mismo que usan Excel y NumPy). */
function quantile(sorted, q) {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (position - lower) * (sorted[upper] - sorted[lower]);
}

/** GET /api/math/statistics — medidas estadísticas de una lista de números. */
router.get('/statistics', (req, res, next) => {
  try {
    const params = collectParams(req);
    const raw = asText(params.numbers ?? params.values, 'numbers', { max: 2000 });
    const parts = raw
      .split(/[\s,;]+/)
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length === 0) {
      throw errors.badRequest('EMPTY_LIST', 'La lista "numbers" no contiene ningún número.');
    }
    if (parts.length > LIMITS.itemsMaxCount) {
      throw errors.badRequest(
        'TOO_MANY_ITEMS',
        `Se admiten como máximo ${LIMITS.itemsMaxCount} números por petición (recibidos ${parts.length}).`
      );
    }

    const invalid = parts.filter((part) => !/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(part));
    if (invalid.length > 0) {
      throw errors.badRequest('INVALID_NUMBER_LIST', `Estos valores no son números válidos: ${invalid.slice(0, 5).join(', ')}.`);
    }

    const values = parts.map(Number);
    const sample = ['true', '1', 'si', 'sí'].includes(String(params.sample ?? '').toLowerCase());

    const sorted = [...values].sort((x, y) => x - y);
    const sum = values.reduce((acc, value) => acc + value, 0);
    const mean = sum / values.length;
    const median = quantile(sorted, 0.5);
    const variance = values.reduce((acc, value) => acc + (value - mean) ** 2, 0) / (sample ? Math.max(1, values.length - 1) : values.length);

    const frequencies = new Map();
    for (const value of values) frequencies.set(value, (frequencies.get(value) || 0) + 1);
    const maxFrequency = Math.max(...frequencies.values());
    const mode = maxFrequency > 1 ? [...frequencies.entries()].filter(([, count]) => count === maxFrequency).map(([value]) => value).sort((x, y) => x - y) : [];

    sendSuccess(
      res,
      {
        count: values.length,
        values,
        sorted,
        sum: round(sum),
        mean: round(mean),
        median: round(median),
        mode,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        range: round(sorted[sorted.length - 1] - sorted[0]),
        variance: round(variance),
        standardDeviation: round(Math.sqrt(variance)),
        sample,
        quartiles: {
          q1: round(quantile(sorted, 0.25)),
          q2: round(median),
          q3: round(quantile(sorted, 0.75)),
        },
        interquartileRange: round(quantile(sorted, 0.75) - quantile(sorted, 0.25)),
      },
      { self: false }
    );
  } catch (error) {
    next(error);
  }
});

module.exports = router;
