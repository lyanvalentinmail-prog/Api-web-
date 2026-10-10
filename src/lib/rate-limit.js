'use strict';

const { errors } = require('./errors');

/**
 * Limitador de peticiones en memoria (ventana deslizante por IP).
 *
 * Es deliberadamente sencillo y sin dependencias: cumple el objetivo de evitar
 * abusos en un despliegue de un solo proceso (el caso habitual de este
 * proyecto). Con varias instancias detrás de un balanceador, cada proceso
 * aplicaría su propia cuota; el README explica cómo usar un almacén compartido.
 *
 * @param {{windowMs: number, max: number, name: string, message?: string, skip?: (req) => boolean}} options
 */
function createRateLimiter({ windowMs, max, name, message, skip }) {
  /** @type {Map<string, number[]>} IP -> marcas de tiempo de las peticiones */
  const hits = new Map();

  // Limpieza periódica para que el Map no crezca sin control.
  const cleanup = setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [key, timestamps] of hits) {
      const kept = timestamps.filter((time) => time > cutoff);
      if (kept.length === 0) hits.delete(key);
      else hits.set(key, kept);
    }
  }, Math.min(windowMs, 60_000));
  if (cleanup.unref) cleanup.unref();

  /** @param {import('express').Request} req */
  const keyFor = (req) => req.clientIp || req.ip || 'desconocida';

  return function rateLimiter(req, res, next) {
    if (skip && skip(req)) return next();

    const now = Date.now();
    const key = keyFor(req);
    const cutoff = now - windowMs;
    const timestamps = (hits.get(key) || []).filter((time) => time > cutoff);

    if (timestamps.length >= max) {
      const oldest = timestamps[0];
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', String(Math.ceil((oldest + windowMs) / 1000)));
      // Se usa ApiError para que el manejador central responda 429 (y no 500)
      // con el formato de error habitual y la cabecera Retry-After.
      return next(
        errors.tooManyRequests(
          message ||
            `Has superado el límite de ${max} peticiones cada ${Math.round(windowMs / 1000)} segundos en "${name}". Vuelve a intentarlo en ${retryAfterSeconds} s.`,
          retryAfterSeconds
        )
      );
    }

    timestamps.push(now);
    hits.set(key, timestamps);

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - timestamps.length)));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil((now + windowMs) / 1000)));
    return next();
  };
}

module.exports = { createRateLimiter };
