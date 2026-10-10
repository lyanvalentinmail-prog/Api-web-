'use strict';

const express = require('express');
const { sendSuccess } = require('../lib/respond');
const { collectParams, asText, asInteger, asEnum, LIMITS } = require('../lib/validate');
const { errors } = require('../lib/errors');

const router = express.Router();

/** Palabras vacías frecuentes en español (para el filtro opcional de stopwords). */
const STOPWORDS = new Set([
  'de', 'la', 'que', 'el', 'en', 'y', 'a', 'los', 'del', 'se', 'las', 'por', 'un', 'para', 'con', 'no', 'una',
  'su', 'al', 'lo', 'como', 'más', 'pero', 'sus', 'le', 'ya', 'o', 'este', 'sí', 'porque', 'esta', 'entre',
  'cuando', 'muy', 'sin', 'sobre', 'también', 'me', 'hasta', 'hay', 'donde', 'quien', 'desde', 'todo', 'nos',
  'durante', 'todos', 'uno', 'les', 'ni', 'contra', 'otros', 'ese', 'eso', 'ante', 'ellos', 'e', 'esto', 'mí',
  'antes', 'algunos', 'qué', 'unos', 'yo', 'otro', 'otras', 'otra', 'él', 'tanto', 'esa', 'estos', 'mucho',
  'quienes', 'nada', 'muchos', 'cual', 'poco', 'ella', 'estar', 'estas', 'algunas', 'algo', 'nosotros', 'mi',
  'es', 'son', 'fue', 'era', 'han', 'ha', 'ser', 'tiene', 'tienen', 'te', 'tu', 'tus', 'mí', 'ti',
]);

/** Invierte el texto por puntos de código (no rompe emojis ni caracteres combinados básicos). */
function reverseCodePoints(text) {
  return [...text].reverse().join('');
}

/**
 * Extrae las palabras de un texto (letras y números, incluidas tildes y ñ).
 * @param {string} text
 */
function extractWords(text) {
  return (text.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []).filter(Boolean);
}

/** GET /api/text/reverse — invierte el texto recibido. */
router.get('/reverse', (req, res, next) => {
  try {
    const params = collectParams(req);
    const input = asText(params.text, 'text', { max: LIMITS.textMaxLength });
    const output = reverseCodePoints(input);
    sendSuccess(
      res,
      {
        input,
        output,
        inputLength: input.length,
        outputLength: output.length,
        algorithm: 'code-point-reverse (seguro para Unicode y emojis)',
      },
      { self: false }
    );
  } catch (error) {
    next(error);
  }
});

/** GET /api/text/uppercase — mayúsculas, minúsculas o capitalización. */
router.get('/uppercase', (req, res, next) => {
  try {
    const params = collectParams(req);
    const input = asText(params.text, 'text', { max: LIMITS.textMaxLength });
    const mode = asEnum(params.mode, 'mode', ['upper', 'lower', 'capitalize'], 'upper');

    let output;
    if (mode === 'lower') output = input.toLocaleLowerCase('es-ES');
    else if (mode === 'capitalize') {
      output = input
        .toLocaleLowerCase('es-ES')
        .replace(/(^|\s)(\p{L})/gu, (match, space, letter) => space + letter.toLocaleUpperCase('es-ES'));
    } else output = input.toLocaleUpperCase('es-ES');

    sendSuccess(
      res,
      { input, output, mode, changed: output !== input, locale: 'es-ES' },
      { self: false }
    );
  } catch (error) {
    next(error);
  }
});

/** GET /api/text/slug — convierte un texto en slug de URL. */
router.get('/slug', (req, res, next) => {
  try {
    const params = collectParams(req);
    const input = asText(params.text, 'text', { max: LIMITS.textMaxLength });
    const separator = asEnum(params.separator, 'separator', ['-', '_', '.'], '-');

    const output = input
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/['’"]/g, '')
      .replace(/[^a-z0-9]+/g, separator)
      .replace(new RegExp(`[${separator === '.' ? '\\.' : separator}]{2,}`, 'g'), separator)
      .replace(new RegExp(`^[${separator === '.' ? '\\.' : separator}]+|[${separator === '.' ? '\\.' : separator}]+$`, 'g'), '');

    sendSuccess(res, { input, output, separator, length: output.length }, { self: false });
  } catch (error) {
    next(error);
  }
});

/** GET /api/text/stats — estadísticas completas del texto. */
router.get('/stats', (req, res, next) => {
  try {
    const params = collectParams(req);
    const input = asText(params.text, 'text', { max: LIMITS.textMaxLength });
    const top = asInteger(params.top, 'top', 5);
    if (top < 1 || top > 50) {
      throw errors.badRequest('INVALID_INTEGER', 'top debe estar entre 1 y 50.');
    }
    const excludeStopwords = ['true', '1', 'si', 'sí'].includes(String(params.stopwords ?? '').toLowerCase());

    const words = extractWords(input);
    const considered = excludeStopwords ? words.filter((word) => !STOPWORDS.has(word)) : words;

    const frequencies = new Map();
    for (const word of considered) frequencies.set(word, (frequencies.get(word) || 0) + 1);

    const topWords = [...frequencies.entries()]
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word, 'es'))
      .slice(0, top);

    const sentences = (input.match(/[^.!?…\n]+[.!?…]+/g) || []).length || (input.trim() ? 1 : 0);
    const lines = input === '' ? 0 : input.split(/\r\n|\r|\n/).length;
    const paragraphs = input.trim() === '' ? 0 : input.split(/\n\s*\n/).filter((block) => block.trim() !== '').length;

    sendSuccess(
      res,
      {
        characters: input.length,
        charactersNoSpaces: input.replace(/\s/g, '').length,
        words: words.length,
        uniqueWords: new Set(words).size,
        sentences,
        lines,
        paragraphs,
        readingTimeSeconds: Math.max(1, Math.ceil(words.length / 200 * 60)),
        longestWord: words.reduce((longest, word) => (word.length > longest.length ? word : longest), ''),
        averageWordLength: words.length ? Number((words.join('').length / words.length).toFixed(2)) : 0,
        topWords,
        stopwordsExcluded: excludeStopwords,
      },
      { self: false }
    );
  } catch (error) {
    next(error);
  }
});

/** GET /api/text/count — cuenta apariciones de una subcadena o expresión regular. */
router.get('/count', (req, res, next) => {
  try {
    const params = collectParams(req);
    const text = asText(params.text, 'text', { max: LIMITS.textMaxLength });
    const search = asText(params.search, 'search', { max: 200 });
    const useRegex = ['true', '1', 'si', 'sí'].includes(String(params.regex ?? '').toLowerCase());
    const ignoreCase = !['false', '0', 'no'].includes(String(params.ignoreCase ?? 'true').toLowerCase());
    const flags = ignoreCase ? 'gi' : 'g';

    if (search === '') {
      throw errors.badRequest('MISSING_PARAM', 'El parámetro "search" no puede estar vacío.');
    }

    const patternSource = useRegex ? search : search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let pattern;
    try {
      pattern = new RegExp(patternSource, flags);
    } catch {
      throw errors.badRequest('INVALID_REGEX', 'El patrón enviado en "search" no es una expresión regular válida.');
    }

    const matches = [];
    const positions = [];
    for (const match of text.matchAll(pattern)) {
      if (matches.length < 50) {
        matches.push(match[0]);
        positions.push(match.index);
      }
      if (matches.length >= 50) break;
    }

    // Recuento exacto e independiente del límite de 50 coincidencias mostradas.
    const total = (text.match(new RegExp(patternSource, flags)) || []).length;

    sendSuccess(
      res,
      {
        text: text.length > 200 ? `${text.slice(0, 200)}…` : text,
        textLength: text.length,
        search,
        isRegex: useRegex,
        ignoreCase,
        count: total,
        positions,
        matches: matches.slice(0, 50),
        note: 'Se devuelven como máximo las 50 primeras coincidencias en "matches" y "positions"; "count" es el total exacto.',
      },
      { self: false }
    );
  } catch (error) {
    next(error);
  }
});

module.exports = router;
