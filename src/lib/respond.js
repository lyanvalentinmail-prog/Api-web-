'use strict';

/**
 * Formato único de respuesta para toda la API, pensado para que el cliente
 * nunca tenga que adivinar la forma del JSON:
 *
 *   Éxito:  { ok: true,  data: {...}, meta: { endpoint, method, durationMs, timestamp, requestId } }
 *   Error:  { ok: false, error: { code, message, status, details }, meta: {...} }
 */

/** @param {import('express').Response} res @param {number} [selfDuration] */
function buildMeta(res, { durationMs, endpoint, method, timestamp, requestId } = {}) {
  const req = res.req;
  const meta = {};

  if (endpoint !== null) {
    meta.endpoint = endpoint ?? req?.path ?? null;
    meta.method = method ?? req?.method ?? null;
  }
  if (durationMs !== null) {
    meta.durationMs = Math.round(durationMs ?? Date.now() - (req?._startedAt ?? Date.now()));
  }
  if (timestamp !== null) {
    meta.timestamp = timestamp ?? new Date().toISOString();
  }
  if (requestId !== null) {
    meta.requestId = requestId ?? req?.id ?? null;
  }
  return meta;
}

/**
 * Envía una respuesta de éxito con el formato estándar.
 * @param {import('express').Response} res
 * @param {unknown} data
 * @param {{status?: number, headers?: Record<string,string>, meta?: object, self?: boolean}} [options]
 *        `self: false` omite endpoint/method del meta (útil para proxies externos).
 */
function sendSuccess(res, data, options = {}) {
  const { status = 200, headers = {}, meta: metaOverrides = {}, self = true } = options;
  const meta = self ? buildMeta(res, metaOverrides) : buildMeta(res, { ...metaOverrides, endpoint: null, method: null });

  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
  return res.status(status).json({ ok: true, data, meta });
}

/**
 * Envía un error con el formato estándar.
 * @param {import('express').Response} res
 * @param {{status: number, code: string, message: string, details?: unknown[], retryAfterSeconds?: number}} error
 */
function sendError(res, error) {
  const status = Number.isInteger(error.status) ? error.status : 500;
  const details = error.details && error.details.length ? error.details : undefined;

  if (error.retryAfterSeconds) {
    res.setHeader('Retry-After', String(Math.max(1, Math.ceil(error.retryAfterSeconds))));
  }

  return res.status(status).json({
    ok: false,
    error: {
      code: error.code || 'ERROR',
      message: error.message || 'Se produjo un error procesando la petición.',
      status,
      ...(details ? { details } : {}),
    },
    meta: buildMeta(res),
  });
}

module.exports = { sendSuccess, sendError, buildMeta };
