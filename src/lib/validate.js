'use strict';

const { errors } = require('./errors');

/** Límites globales de validación (evitan abusos de memoria/CPU). */
const LIMITS = {
  textMaxLength: 5000,
  itemsMaxCount: 50,
  numberAbsMax: 1e15,
  jsonBodyMaxLength: 100_000,
};

/**
 * Recoge los parámetros de una petición desde query y body sin depender del
 * método HTTP. Para el probador de endpoints permitimos `GET` con parámetros en
 * querystring y `POST/PUT/PATCH` con parámetros en el body JSON (o en la query).
 *
 * @param {import('express').Request} req
 * @returns {Record<string, unknown>}
 */
function collectParams(req) {
  const fromQuery = req.query && typeof req.query === 'object' ? req.query : {};
  let fromBody = {};
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    fromBody = req.body;
  }
  return { ...fromQuery, ...fromBody };
}

/**
 * @param {unknown} raw
 * @param {string} name
 * @returns {string}
 */
function asString(raw, name) {
  if (raw === undefined || raw === null) {
    throw errors.badRequest('MISSING_PARAM', `Falta el parámetro obligatorio "${name}".`);
  }
  if (typeof raw === 'object') {
    throw errors.badRequest(
      'INVALID_PARAM_TYPE',
      `El parámetro "${name}" debe ser un texto, número o booleano, no un objeto o array.`
    );
  }
  return String(raw);
}

/**
 * Normaliza un número aceptando notación simple y rechazando NaN/Infinity.
 * @param {unknown} raw
 * @param {string} name
 * @returns {number}
 */
function asNumber(raw, name) {
  const text = asString(raw, name).trim().replace(',', '.');
  if (text === '' || !/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(text)) {
    throw errors.badRequest(
      'INVALID_NUMBER',
      `El parámetro "${name}" debe ser un número válido. Valor recibido: "${text || '(vacío)'}".`
    );
  }
  const value = Number(text);
  if (!Number.isFinite(value)) {
    throw errors.badRequest('INVALID_NUMBER', `El parámetro "${name}" no es un número finito.`);
  }
  if (Math.abs(value) > LIMITS.numberAbsMax) {
    throw errors.badRequest(
      'NUMBER_OUT_OF_RANGE',
      `El parámetro "${name}" supera el valor máximo admitido (±${LIMITS.numberAbsMax}).`
    );
  }
  return value;
}

/**
 * @param {unknown} raw
 * @param {string} name
 * @param {number} [fallback]
 * @returns {number} número dentro del rango, o el valor por defecto
 */
function asInteger(raw, name, fallback) {
  if ((raw === undefined || raw === null || raw === '') && fallback !== undefined) return fallback;
  const value = asNumber(raw, name);
  if (!Number.isInteger(value)) {
    throw errors.badRequest('INVALID_INTEGER', `El parámetro "${name}" debe ser un número entero.`);
  }
  return value;
}

/**
 * @param {unknown} raw
 * @param {string} name
 * @param {{min?: number, max?: number, required?: boolean, fallback?: string}} [options]
 * @returns {string}
 */
function asText(raw, name, options = {}) {
  const { min = 0, max = LIMITS.textMaxLength, required = true, fallback } = options;
  if (raw === undefined || raw === null || raw === '') {
    if (fallback !== undefined) return fallback;
    if (!required) return '';
    throw errors.badRequest('MISSING_PARAM', `Falta el parámetro obligatorio "${name}".`);
  }
  const text = asString(raw, name);
  if (text.length < min) {
    throw errors.badRequest('TEXT_TOO_SHORT', `El parámetro "${name}" debe tener al menos ${min} caracteres.`);
  }
  if (text.length > max) {
    throw errors.badRequest('TEXT_TOO_LONG', `El parámetro "${name}" no puede superar ${max} caracteres.`);
  }
  return text;
}

/**
 * Comprueba un valor contra una lista permitida.
 * @param {unknown} raw
 * @param {string} name
 * @param {string[]} allowed
 * @param {string} [fallback]
 */
function asEnum(raw, name, allowed, fallback) {
  if ((raw === undefined || raw === null || raw === '') && fallback !== undefined) return fallback;
  const value = asString(raw, name);
  if (!allowed.includes(value)) {
    throw errors.badRequest(
      'INVALID_ENUM',
      `El parámetro "${name}" debe ser uno de: ${allowed.join(', ')}. Valor recibido: "${value}".`
    );
  }
  return value;
}

/**
 * Valida contra una expresión regular (se usa para los parámetros que se
 * envían a APIs externas: nunca construimos una URL con datos sin validar).
 * @param {unknown} raw
 * @param {string} name
 * @param {RegExp} pattern
 * @param {{required?: boolean, fallback?: string, hint?: string, maxLength?: number}} [options]
 */
function asPattern(raw, name, pattern, options = {}) {
  const { required = true, fallback, hint = '', maxLength = 200 } = options;
  if ((raw === undefined || raw === null || raw === '') && fallback !== undefined) return fallback;
  if ((raw === undefined || raw === null || raw === '') && !required) return '';
  const value = asString(raw, name);
  if (value.length > maxLength) {
    throw errors.badRequest('TEXT_TOO_LONG', `El parámetro "${name}" no puede superar ${maxLength} caracteres.`);
  }
  if (!pattern.test(value)) {
    throw errors.badRequest(
      'INVALID_FORMAT',
      `El formato del parámetro "${name}" no es válido.${hint ? ` ${hint}` : ''}`
    );
  }
  return value;
}

/**
 * Valida una expresión regular recibida como texto (con límites de tamaño y
 * longitud para evitar expresiones catastróficas).
 * @param {unknown} raw
 * @param {string} name
 */
function asRegexSource(raw, name) {
  const source = asText(raw, name, { max: 200 });
  try {
    // eslint-disable-next-line no-new
    new RegExp(source);
  } catch {
    throw errors.badRequest('INVALID_REGEX', `La expresión regular enviada en "${name}" no es válida.`);
  }
  return source;
}

module.exports = {
  LIMITS,
  collectParams,
  asString,
  asNumber,
  asInteger,
  asText,
  asEnum,
  asPattern,
  asRegexSource,
};
