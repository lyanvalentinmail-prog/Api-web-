'use strict';

const express = require('express');
const crypto = require('node:crypto');
const { sendSuccess } = require('../lib/respond');
const { collectParams, asNumber, asInteger, asText, asEnum } = require('../lib/validate');
const { errors } = require('../lib/errors');

const router = express.Router();

/** Alfabetos disponibles para /api/random/string. */
const CHARSETS = {
  alphanumeric: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
  letters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  numbers: '0123456789',
  hex: '0123456789abcdef',
};

/**
 * Entero aleatorio uniforme sin sesgo usando el generador criptográfico.
 * @param {number} min
 * @param {number} max
 */
function secureInt(min, max) {
  return crypto.randomInt(min, max + 1);
}

/**
 * Decimal aleatorio en [min, max) a partir de bytes criptográficos.
 * @param {number} min
 * @param {number} max
 */
function secureFloat(min, max) {
  const buffer = crypto.randomBytes(6);
  const fraction = buffer.readUIntBE(0, 6) / 0x1000000000000; // [0, 1)
  return Number((min + fraction * (max - min)).toFixed(10));
}

/** GET /api/random/number — números aleatorios en un rango. */
router.get('/number', (req, res, next) => {
  try {
    const params = collectParams(req);
    const integer = !['false', '0', 'no'].includes(String(params.integer ?? 'true').toLowerCase());
    const count = asInteger(params.count, 'count', 1);
    if (count < 1 || count > 50) {
      throw errors.badRequest('INVALID_INTEGER', 'count debe ser un número entero entre 1 y 50.');
    }

    let min;
    let max;

    if (integer) {
      min = asInteger(params.min, 'min', 1);
      max = asInteger(params.max, 'max', 100);
      if (Math.abs(min) > 2 ** 48 || Math.abs(max) > 2 ** 48) {
        throw errors.badRequest(
          'NUMBER_OUT_OF_RANGE',
          'Para números enteros el rango admitido es ±281474976710656 (límite de crypto.randomInt).'
        );
      }
    } else {
      min = asNumber(params.min ?? 0, 'min');
      max = asNumber(params.max ?? 1, 'max');
    }

    if (max < min) {
      throw errors.badRequest('INVALID_RANGE', `max (${max}) debe ser mayor o igual que min (${min}).`);
    }

    const values = Array.from({ length: count }, () => (integer ? secureInt(min, max) : secureFloat(min, max)));

    sendSuccess(
      res,
      {
        min,
        max,
        integer,
        count,
        values,
        ...(count === 1 ? { value: values[0] } : {}),
        algorithm: integer ? 'crypto.randomInt (uniforme, sin sesgo)' : 'crypto.randomBytes (coma flotante)',
      },
      { self: false }
    );
  } catch (error) {
    next(error);
  }
});

/** GET /api/random/uuid — identificadores UUID v4. */
router.get('/uuid', (req, res, next) => {
  try {
    const params = collectParams(req);
    const count = asInteger(params.count, 'count', 1);
    if (count < 1 || count > 50) {
      throw errors.badRequest('INVALID_INTEGER', 'count debe ser un número entero entre 1 y 50.');
    }
    const uppercase = ['true', '1', 'si', 'sí'].includes(String(params.uppercase ?? '').toLowerCase());

    const uuids = Array.from({ length: count }, () => {
      const value = crypto.randomUUID();
      return uppercase ? value.toUpperCase() : value;
    });

    sendSuccess(
      res,
      {
        version: 'v4',
        count,
        uppercase,
        uuids,
        ...(count === 1 ? { uuid: uuids[0] } : {}),
      },
      { self: false }
    );
  } catch (error) {
    next(error);
  }
});

/** GET /api/random/string — cadenas aleatorias con alfabeto configurable. */
router.get('/string', (req, res, next) => {
  try {
    const params = collectParams(req);
    const length = asInteger(params.length, 'length', 16);
    if (length < 1 || length > 256) {
      throw errors.badRequest('INVALID_INTEGER', 'length debe estar entre 1 y 256.');
    }
    const count = asInteger(params.count, 'count', 1);
    if (count < 1 || count > 50) {
      throw errors.badRequest('INVALID_INTEGER', 'count debe ser un número entero entre 1 y 50.');
    }

    const charsetName = asEnum(params.charset, 'charset', ['alphanumeric', 'letters', 'lowercase', 'uppercase', 'numbers', 'hex', 'base64'], 'alphanumeric');
    const alphabet = charsetName === 'base64' ? null : CHARSETS[charsetName];

    const generate = () => {
      if (charsetName === 'base64') {
        return crypto.randomBytes(Math.ceil((length * 3) / 4)).toString('base64').slice(0, length);
      }
      let out = '';
      for (let i = 0; i < length; i += 1) out += alphabet[secureInt(0, alphabet.length - 1)];
      return out;
    };

    const strings = Array.from({ length: count }, generate);
    const alphabetSize = charsetName === 'base64' ? 64 : alphabet.length;

    sendSuccess(
      res,
      {
        length,
        charset: charsetName,
        alphabetSize,
        bitsOfEntropy: Number((length * Math.log2(alphabetSize)).toFixed(1)),
        count,
        strings,
        ...(count === 1 ? { value: strings[0] } : {}),
      },
      { self: false }
    );
  } catch (error) {
    next(error);
  }
});

/** GET /api/random/choice — elige elementos al azar de una lista. */
router.get('/choice', (req, res, next) => {
  try {
    const params = collectParams(req);
    const raw = asText(params.items, 'items', { max: 2000 });
    const items = raw
      .split(/[,\n|;]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 50);

    if (items.length === 0) {
      throw errors.badRequest('EMPTY_LIST', 'La lista "items" no contiene ningún elemento válido.');
    }
    if (items.some((item) => item.length > 200)) {
      throw errors.badRequest('TEXT_TOO_LONG', 'Ningún elemento de la lista puede superar 200 caracteres.');
    }

    const count = asInteger(params.count, 'count', 1);
    if (count < 1 || count > 50) {
      throw errors.badRequest('INVALID_INTEGER', 'count debe ser un número entero entre 1 y 50.');
    }
    const unique = ['true', '1', 'si', 'sí'].includes(String(params.unique ?? '').toLowerCase());

    if (unique && count > items.length) {
      throw errors.unprocessable(
        'UNIQUE_IMPOSSIBLE',
        `Pides ${count} elementos únicos pero la lista sólo tiene ${items.length}.`,
        [{ name: 'items', value: items.length, description: 'Número de elementos disponibles en la lista.' }]
      );
    }

    const choices = [];
    if (unique) {
      // Barajado parcial de Fisher-Yates con aleatoriedad criptográfica.
      const pool = [...items];
      for (let i = 0; i < count; i += 1) {
        const pick = secureInt(i, pool.length - 1);
        [pool[i], pool[pick]] = [pool[pick], pool[i]];
        choices.push(pool[i]);
      }
    } else {
      for (let i = 0; i < count; i += 1) choices.push(items[secureInt(0, items.length - 1)]);
    }

    sendSuccess(
      res,
      {
        items,
        itemCount: items.length,
        count,
        unique,
        choices,
        ...(count === 1 ? { choice: choices[0] } : {}),
      },
      { self: false }
    );
  } catch (error) {
    next(error);
  }
});

module.exports = router;
