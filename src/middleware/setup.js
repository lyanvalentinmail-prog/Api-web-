'use strict';

const crypto = require('node:crypto');
const express = require('express');
const path = require('node:path');
const { createRateLimiter } = require('../lib/rate-limit');

const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');

/** Cabeceras de seguridad razonables para una API pública con interfaz web. */
function securityHeaders({ trustProxy }) {
  return function securityHeadersMiddleware(req, res, next) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "connect-src 'self'",
        "font-src 'self' data:",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'self'",
      ].join('; ')
    );
    // HSTS sólo cuando hay HTTPS delante (evita bloquear hosts locales por HTTP).
    if (trustProxy) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  };
}

/**
 * CORS pensado para que la API sea realmente usable desde cualquier origen:
 * no hay cookies ni credenciales, así que se permite `*` sin riesgo de CSRF.
 * @param {{origins: string[]}} options
 */
function corsMiddleware({ origins }) {
  const allowAll = origins.includes('*');
  const allowed = new Set(origins);

  return function cors(req, res, next) {
    const requestOrigin = req.headers.origin;
    const isAllowed = allowAll || (requestOrigin && allowed.has(requestOrigin));

    if (isAllowed) {
      res.setHeader('Access-Control-Allow-Origin', allowAll ? '*' : requestOrigin);
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.setHeader(
        'Access-Control-Allow-Headers',
        req.headers['access-control-request-headers'] || 'Content-Type, Accept, X-Requested-With'
      );
      res.setHeader('Access-Control-Expose-Headers', 'X-Request-Id, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, X-Upstream-Status');
      res.setHeader('Access-Control-Max-Age', '86400');
      res.setHeader('Vary', 'Origin');
    }

    if (req.method === 'OPTIONS') {
      // Preflight: se responde siempre 204 para no romper clientes que envían
      // cabeceras no listadas; la API no usa credenciales.
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.setHeader(
        'Access-Control-Allow-Headers',
        req.headers['access-control-request-headers'] || 'Content-Type, Accept, X-Requested-With'
      );
      return res.status(204).end();
    }

    return next();
  };
}

function requestIdMiddleware(req, res, next) {
  const provided = typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'].slice(0, 64) : '';
  req.id = provided && /^[\w.-]{1,64}$/.test(provided) ? provided : crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}

function contextMiddleware(req, res, next) {
  req._startedAt = Date.now();
  req.clientIp =
    (typeof req.ip === 'string' && req.ip) ||
    (req.socket && req.socket.remoteAddress) ||
    'desconocida';
  // URL base reconstruida a partir de la petición para generar ejemplos de código.
  req.apiBaseUrl = `${req.protocol}://${req.get('host') || 'localhost:3000'}`;
  next();
}

/** Registro de peticiones: una línea por solicitud, con color según el estado. */
function loggerMiddleware({ enabled = true } = {}) {
  return function logger(req, res, next) {
    if (!enabled) return next();
    res.on('finish', () => {
      const ms = Date.now() - (req._startedAt || Date.now());
      const color = res.statusCode >= 500 ? '\u001b[31m' : res.statusCode >= 400 ? '\u001b[33m' : '\u001b[32m';
      // eslint-disable-next-line no-console
      console.log(`${color}${res.statusCode}\u001b[0m ${req.method} ${req.originalUrl} \u001b[90m${ms}ms\u001b[0m`);
    });
    next();
  };
}

/**
 * Monta todo lo común: seguridad, CORS, límites de peticiones, parsers y
 * contenido estático.
 * @param {import('express').Express} app
 * @param {ReturnType<import('../config')>} config
 */
function setupMiddleware(app, config) {
  app.disable('x-powered-by');
  // Confiamos en el proxy sólo si se ha configurado explícitamente (TRUST_PROXY).
  app.set('trust proxy', config.trustProxy);

  app.use(requestIdMiddleware);
  app.use(contextMiddleware);
  app.use(loggerMiddleware({ enabled: config.logRequests }));
  app.use(securityHeaders({ trustProxy: Boolean(config.trustProxy) }));
  app.use(corsMiddleware({ origins: config.corsOrigins }));

  // Límites de tamaño del cuerpo: JSON (validación) y texto plano.
  app.use(express.json({ limit: config.bodyLimit }));
  app.use(express.text({ limit: config.bodyLimit, type: ['text/plain', 'application/x-www-form-urlencoded'] }));

  // Límites de peticiones por IP.
  const skipSensitive = () => false;
  app.use('/api/external', createRateLimiter({ name: 'external', ...config.rateLimits.external, skip: skipSensitive }));
  app.use('/api', createRateLimiter({ name: 'general', ...config.rateLimits.general, skip: skipSensitive }));
  app.use(
    '/api',
    createRateLimiter({
      name: 'write',
      ...config.rateLimits.write,
      skip: (req) => !['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method),
    })
  );

  // Interfaz web estática (sin caché agresiva para que los cambios se vean).
  app.use(
    express.static(PUBLIC_DIR, {
      etag: true,
      lastModified: true,
      maxAge: config.staticMaxAge,
      index: 'index.html',
      extensions: ['html'],
    })
  );
}

module.exports = { setupMiddleware, PUBLIC_DIR };
