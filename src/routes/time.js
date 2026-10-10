'use strict';

const express = require('express');
const { sendSuccess } = require('../lib/respond');
const { collectParams, asPattern, asInteger } = require('../lib/validate');
const { errors } = require('../lib/errors');

const router = express.Router();

const DAYS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** Número de semana ISO 8601 de una fecha. */
function isoWeek(date) {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil(((target - yearStart) / 86400000 + 1) / 7);
}

/** Día del año (1-366). */
function dayOfYear(date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  return Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start) / 86400000);
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Formatea un número con dos dígitos. */
const pad = (value, size = 2) => String(value).padStart(size, '0');

/**
 * Desfase de una zona horaria respecto a UTC, en minutos, para una fecha dada.
 * Se calcula con Intl (base de datos IANA incluida en Node.js), sin llamadas externas.
 * @param {string} timeZone
 * @param {Date} date
 */
function offsetMinutes(timeZone, date) {
  const truncated = new Date(Math.floor(date.getTime() / 1000) * 1000);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = Object.fromEntries(formatter.formatToParts(truncated).map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second)
  );
  return Math.round((asUtc - truncated.getTime()) / 60000);
}

/** @param {number} minutes */
function formatOffset(minutes) {
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  return `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/** GET /api/time — hora actual del servidor en UTC. */
router.get('/', (req, res, next) => {
  try {
    if (req.path !== '/' && req.path !== '') {
      // Evita que /api/time/algo coincida aquí (Express ya lo separa, pero somos explícitos).
      return next();
    }
    const now = new Date();
    sendSuccess(
      res,
      {
        utc: now.toISOString(),
        iso8601: now.toISOString(),
        epochMs: now.getTime(),
        epochSeconds: Math.floor(now.getTime() / 1000),
        date: now.toISOString().slice(0, 10),
        time: now.toISOString().slice(11, 19),
        timezone: 'UTC',
        offset: '+00:00',
        dayOfWeek: DAYS_ES[now.getUTCDay()],
        dayOfYear: dayOfYear(now),
        isoWeek: isoWeek(now),
        isLeapYear: isLeapYear(now.getUTCFullYear()),
        server: {
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
          locale: Intl.DateTimeFormat().resolvedOptions().locale,
        },
      },
      { self: false }
    );
  } catch (error) {
    next(error);
  }
});

/** GET /api/time/world — hora local en una zona horaria IANA. */
router.get('/world', (req, res, next) => {
  try {
    const params = collectParams(req);
    const timeZone = asPattern(params.timezone ?? 'America/Bogota', 'timezone', /^[A-Za-z_+-]{1,40}(?:\/[A-Za-z0-9_+-]{1,40}){0,2}$/, {
      hint: 'Usa el formato Región/Ciudad, por ejemplo Europe/Madrid. Consulta /api/time/timezones.',
      maxLength: 60,
    });

    let formatter;
    try {
      formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        weekday: 'short',
        timeZoneName: 'short',
      });
    } catch {
      throw errors.badRequest(
        'INVALID_TIMEZONE',
        `La zona horaria "${timeZone}" no existe en la base de datos IANA. Consulta las válidas en /api/time/timezones.`
      );
    }

    const now = new Date();
    const parts = Object.fromEntries(formatter.formatToParts(now).map((part) => [part.type, part.value]));
    const offset = offsetMinutes(timeZone, now);
    const localDate = `${parts.year}-${parts.month}-${parts.day}`;
    const localTime = `${parts.hour === '24' ? '00' : parts.hour}:${parts.minute}:${parts.second}`;

    // El horario de verano se deduce comparando el desfase actual con el mínimo
    // del año (el mínimo corresponde siempre al horario estándar, en cualquier hemisferio).
    const year = now.getUTCFullYear();
    const offsetJanuary = offsetMinutes(timeZone, new Date(Date.UTC(year, 0, 1)));
    const offsetJuly = offsetMinutes(timeZone, new Date(Date.UTC(year, 6, 1)));
    const standardOffset = Math.min(offsetJanuary, offsetJuly);

    sendSuccess(
      res,
      {
        timezone: timeZone,
        iso8601: `${localDate}T${localTime}${formatOffset(offset)}`,
        localDate,
        localTime,
        utc: now.toISOString(),
        offset: formatOffset(offset),
        offsetMinutes: offset,
        dayOfWeek: DAYS_ES[new Date(`${localDate}T00:00:00Z`).getUTCDay()],
        abbreviation: parts.timeZoneName || null,
        daylightSaving: offset !== standardOffset,
        note: 'Hora calculada con la base de datos IANA incluida en Node.js (Intl). No se consulta ningún servicio externo.',
      },
      { self: false }
    );
  } catch (error) {
    next(error);
  }
});

/** GET /api/time/timezones — lista de zonas horarias disponibles. */
router.get('/timezones', (req, res, next) => {
  try {
    const params = collectParams(req);
    const limit = asInteger(params.limit, 'limit', 400);
    if (limit < 1 || limit > 500) {
      throw errors.badRequest('INVALID_INTEGER', 'limit debe estar entre 1 y 500.');
    }
    const search = params.search ? String(params.search).slice(0, 60) : '';

    if (typeof Intl.supportedValuesOf !== 'function') {
      throw errors.internal('Esta versión de Node.js no expone Intl.supportedValuesOf: actualiza a Node 18 o superior.');
    }

    const all = Intl.supportedValuesOf('timeZone');
    const normalize = (text) =>
      text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[_\s]/g, '');

    const needle = normalize(search);
    const matched = needle ? all.filter((zone) => normalize(zone).includes(needle)) : all;

    sendSuccess(
      res,
      {
        total: all.length,
        matched: matched.length,
        returned: Math.min(matched.length, limit),
        search: search || null,
        limit,
        timezones: matched.slice(0, limit),
      },
      { self: false }
    );
  } catch (error) {
    next(error);
  }
});

module.exports = router;
