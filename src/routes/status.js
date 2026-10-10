'use strict';

const express = require('express');
const { sendSuccess } = require('../lib/respond');
const { asEnum } = require('../lib/validate');
const { TtlCache } = require('../lib/cache');
const { request, UpstreamError } = require('../lib/http-client');
const { providers, meta } = require('../lib/catalog');

const router = express.Router();

/** Caché de resultados: evita machacar a los proveedores externos en cada visita. */
const statusCache = new TtlCache({ maxEntries: 8 });
const CACHE_KEY = 'status';

const CONCURRENCY = 6;

/**
 * Autocomprobaciones funcionales: se ejecutan de verdad contra este mismo
 * servidor por HTTP (loopback) y se verifica el valor esperado. No son
 * simulaciones: si algo se rompiera, la prueba aparecería en rojo.
 */
const SELF_TESTS = [
  {
    id: 'math-add',
    name: 'La suma responde 5 + 3 = 8',
    endpoint: 'GET /api/math/add?a=5&b=3',
    request: { path: '/api/math/add?a=5&b=3' },
    check: (body) => (body?.data?.result === 8 ? { ok: true, actual: '8' } : { ok: false, actual: String(body?.data?.result) }),
  },
  {
    id: 'math-multiply',
    name: 'La multiplicación responde 5 × 3 = 15',
    endpoint: 'GET /api/math/multiply?a=5&b=3',
    request: { path: '/api/math/multiply?a=5&b=3' },
    check: (body) => (body?.data?.result === 15 ? { ok: true, actual: '15' } : { ok: false, actual: String(body?.data?.result) }),
  },
  {
    id: 'random-number',
    name: 'El rango cerrado devuelve el único valor posible (5 y 5 → 5)',
    endpoint: 'GET /api/random/number?min=5&max=5',
    request: { path: '/api/random/number?min=5&max=5' },
    check: (body) => (body?.data?.value === 5 ? { ok: true, actual: '5' } : { ok: false, actual: String(body?.data?.value) }),
  },
  {
    id: 'random-uuid',
    name: 'El UUID generado cumple el formato v4',
    endpoint: 'GET /api/random/uuid',
    request: { path: '/api/random/uuid' },
    check: (body) => {
      const value = body?.data?.uuid;
      const valid = typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
      return { ok: valid, actual: valid ? `${value.slice(0, 8)}… (v4)` : String(value) };
    },
  },
  {
    id: 'time',
    name: 'La hora del servidor coincide con el reloj del proceso (±5 s)',
    endpoint: 'GET /api/time',
    request: { path: '/api/time' },
    check: (body) => {
      const diff = Math.abs(Number(body?.data?.epochMs) - Date.now());
      return { ok: diff <= 5000, actual: `desfase ${Math.round(diff)} ms`, expected: '±5000 ms' };
    },
  },
  {
    id: 'text-reverse',
    name: 'Invertir "hola" devuelve "aloh"',
    endpoint: 'GET /api/text/reverse?text=hola',
    request: { path: '/api/text/reverse?text=hola' },
    check: (body) => {
      const value = body?.data?.output;
      return { ok: value === 'aloh', actual: String(value), expected: 'aloh' };
    },
  },
  {
    id: 'text-uppercase',
    name: '"hola" en mayúsculas devuelve "HOLA"',
    endpoint: 'GET /api/text/uppercase?text=hola',
    request: { path: '/api/text/uppercase?text=hola' },
    check: (body) => {
      const value = body?.data?.output;
      return { ok: value === 'HOLA', actual: String(value), expected: 'HOLA' };
    },
  },
  {
    id: 'json-validate-ok',
    name: 'El validador acepta un JSON correcto',
    endpoint: 'POST /api/json/validate',
    request: { path: '/api/json/validate', method: 'POST', body: { json: '{"ok":true}' } },
    check: (body) => ({ ok: body?.data?.valid === true, actual: `valid=${body?.data?.valid}`, expected: 'valid=true' }),
  },
  {
    id: 'json-validate-error',
    name: 'El validador detecta un JSON roto e indica la posición',
    endpoint: 'POST /api/json/validate',
    request: { path: '/api/json/validate', method: 'POST', body: { json: '{"roto": }' } },
    check: (body) => ({
      ok: body?.data?.valid === false && Boolean(body?.data?.error),
      actual: body?.data?.valid === false ? body?.data?.error?.message?.slice(0, 60) : 'no se detectó el error',
      expected: 'valid=false con detalle del error',
    }),
  },
  {
    id: 'validation-400',
    name: 'La validación de parámetros devuelve 400 con código de error',
    endpoint: 'GET /api/math/add?a=abc&b=3',
    request: { path: '/api/math/add?a=abc&b=3' },
    expectStatus: 400,
    check: (body, response) => ({
      ok: response.status === 400 && body?.error?.code === 'INVALID_NUMBER',
      actual: `${response.status} ${body?.error?.code || ''}`,
      expected: '400 INVALID_NUMBER',
    }),
  },
  {
    id: 'hash-sha256',
    name: 'SHA-256 de "hola" coincide con el valor conocido',
    endpoint: 'GET /api/util/hash?text=hola',
    request: { path: '/api/util/hash?text=hola' },
    check: (body) => {
      const expected = 'b221d9dbb083a7f33428d7c2a3c3198ae925614d70210e28716ccaa7cd4ddb79';
      return { ok: body?.data?.hash === expected, actual: String(body?.data?.hash).slice(0, 16) + '…', expected: expected.slice(0, 16) + '…' };
    },
  },
  {
    id: 'crud-cycle',
    name: 'El CRUD de ejemplo crea, lee, modifica y borra en memoria',
    endpoint: 'POST/GET/PATCH/DELETE /api/demo/tasks',
    request: { path: '/api/demo/tasks', method: 'POST', body: { title: '[prueba-de-estado] ciclo completo', priority: 'baja' } },
    check: (body, response, context) => {
      const id = body?.data?.item?.id;
      const ok = response.status === 201 && Number.isInteger(id);
      if (ok && context) context.createdId = id;
      return { ok, actual: ok ? `creada con id ${id}` : `respuesta ${response.status}`, expected: '201 con id' };
    },
    // Pasos adicionales del ciclo, en orden. Se ejecutan sólo en /api/status.
    followUp: [
      { method: 'GET', path: (id) => `/api/demo/tasks/${id}` },
      { method: 'PATCH', path: (id) => `/api/demo/tasks/${id}`, body: { completed: true } },
      { method: 'DELETE', path: (id) => `/api/demo/tasks/${id}` },
    ],
  },
  {
    id: 'catalog-selfcheck',
    name: 'El catálogo incluye más de un endpoint propio',
    endpoint: 'GET /api/catalog?type=own&compact=true',
    request: { path: '/api/catalog?type=own&compact=true' },
    check: (body) => {
      const count = body?.data?.count;
      return { ok: Number.isInteger(count) && count > 0, actual: `${count} endpoints propios`, expected: '≥ 1' };
    },
  },
];

/**
 * @param {string} baseUrl URL del propio servidor
 * @param {{path: string, method?: string, body?: unknown}} spec
 */
async function selfRequest(baseUrl, spec) {
  const options = { method: spec.method || 'GET', timeoutMs: 4000, maxBytes: 200_000, headers: {} };
  if (spec.body !== undefined) {
    options.body = typeof spec.body === 'string' ? spec.body : JSON.stringify(spec.body);
    options.headers['content-type'] = 'application/json';
  }
  return request(baseUrl + spec.path, options);
}

/**
 * Ejecuta todas las autocomprobaciones contra el propio servidor.
 * @param {string} baseUrl
 */
async function runSelfTests(baseUrl) {
  return Promise.all(
    SELF_TESTS.map(async (test) => {
      const startedAt = Date.now();
      const result = {
        id: test.id,
        name: test.name,
        endpoint: test.endpoint,
        ok: false,
        durationMs: 0,
        httpStatus: null,
        expected: 'respuesta correcta',
        actual: '',
        message: '',
      };

      try {
        const response = await selfRequest(baseUrl, test.request);
        result.httpStatus = response.status;
        const check = test.check(response.body, response, result);
        result.ok = check.ok;
        result.actual = check.actual ?? '';
        if (check.expected) result.expected = check.expected;
        if (!check.ok) result.message = `Valor inesperado en ${test.endpoint}.`;

        // Ciclo completo del CRUD: se ejecutan los pasos siguientes y se limpia.
        if (test.followUp && result.ok && result.createdId) {
          for (const step of test.followUp) {
            const stepResponse = await selfRequest(baseUrl, {
              path: step.path(result.createdId),
              method: step.method,
              body: step.body,
            });
            if (stepResponse.status >= 400) {
              result.ok = false;
              result.message = `El paso ${step.method} ${step.path(result.createdId)} devolvió ${stepResponse.status}.`;
              break;
            }
          }
        }
      } catch (error) {
        result.message =
          error instanceof UpstreamError
            ? `La autocomprobación no pudo completarse: ${error.message}`
            : `Error inesperado ejecutando la prueba: ${error.message}`;
        result.actual = 'sin respuesta';
      }

      result.durationMs = Date.now() - startedAt;
      if (result.ok && !result.message) result.message = 'Comprobación superada.';
      return result;
    })
  );
}

/**
 * Consulta real a un proveedor externo.
 * @param {{id: string, name: string, baseUrl: string, checkPath: string, binary?: boolean, host: string, docUrl: string, limits: string, examplePath: string}} provider
 * @param {{timeoutMs: number, maxBytes: number, binaryMaxBytes: number}} upstream
 */
async function checkProvider(provider, upstream) {
  const url = `${provider.baseUrl}${provider.checkPath}`;
  const startedAt = Date.now();
  const entry = {
    id: provider.id,
    name: provider.name,
    host: provider.host,
    status: 'down',
    httpStatus: null,
    durationMs: 0,
    checkedAt: new Date().toISOString(),
    cached: false,
    message: '',
    docUrl: provider.docUrl,
    limits: provider.limits,
    exampleEndpoint: `${provider.exampleMethod} ${provider.examplePath}`,
    url,
  };

  try {
    const response = await request(url, {
      timeoutMs: upstream.timeoutMs,
      maxBytes: provider.binary ? upstream.binaryMaxBytes : upstream.maxBytes,
    });
    entry.httpStatus = response.status;
    entry.durationMs = response.durationMs;

    if (response.status >= 200 && response.status < 300) {
      entry.status = 'operational';
      entry.message = `Respuesta correcta en ${response.durationMs} ms.`;
    } else if (response.status === 429) {
      entry.status = 'degraded';
      entry.message = 'El proveedor ha respondido 429: se ha superado su cuota gratuita de peticiones. Vuelve a intentarlo más tarde.';
    } else if (response.status >= 500) {
      entry.status = 'down';
      entry.message = `El proveedor ha respondido con un error de servidor (${response.status}).`;
    } else {
      entry.status = 'degraded';
      entry.message = `El proveedor ha respondido ${response.status} a la comprobación (puede ser normal si el endpoint exige parámetros concretos).`;
    }
  } catch (error) {
    entry.durationMs = Date.now() - startedAt;
    if (error instanceof UpstreamError && error.kind === 'timeout') {
      entry.message = `Sin respuesta en ${upstream.timeoutMs} ms (timeout del servidor).`;
    } else if (error instanceof UpstreamError) {
      entry.message = error.message;
    } else {
      entry.message = `Error inesperado al comprobar el proveedor: ${error.message}`;
    }
  }

  return entry;
}

/** Ejecuta tareas asíncronas con un límite de concurrencia para no saturar la red. */
async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let index = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const current = index++;
      if (current >= items.length) return;
      results[current] = await worker(items[current], current);
    }
  });

  await Promise.all(runners);
  return results;
}

/**
 * Construye el informe completo de estado (autocomprobaciones + proveedores).
 * @param {import('express').Request} req
 */
async function buildStatusReport(req) {
  const config = req.app.locals.config;
  // Loopback al propio servidor usando el puerto real de la conexión actual:
  // funciona igual en local, en contenedores y detrás de proxies.
  const localPort = req.socket?.localPort || config.port;
  const baseUrl = `http://127.0.0.1:${localPort}`;

  const [selfTests, externalResults] = await Promise.all([
    runSelfTests(baseUrl),
    mapLimit(providers, CONCURRENCY, (provider) => checkProvider(provider, config.upstream)),
  ]);

  const passed = selfTests.filter((test) => test.ok).length;
  const ownStatus = passed === selfTests.length ? 'operational' : passed === 0 ? 'down' : 'degraded';

  const counts = externalResults.reduce(
    (acc, entry) => {
      acc[entry.status] = (acc[entry.status] || 0) + 1;
      return acc;
    },
    { operational: 0, degraded: 0, down: 0 }
  );

  const networkHint =
    externalResults.length > 0 && counts.operational === 0
      ? 'Ningún servicio externo ha respondido. Lo más probable es que este servidor no tenga salida a Internet (firewall, red corporativa o sandbox): los endpoints propios y la interfaz web siguen funcionando.'
      : null;

  return {
    generatedAt: new Date().toISOString(),
    cached: false,
    cacheTtlSeconds: Math.round(config.statusCacheTtlMs / 1000),
    durationMs: 0,
    scope: 'all',
    summary: {
      totalServices: 1 + externalResults.length,
      operational: (ownStatus === 'operational' ? 1 : 0) + counts.operational,
      degraded: (ownStatus === 'degraded' ? 1 : 0) + counts.degraded,
      down: (ownStatus === 'down' ? 1 : 0) + counts.down,
      ownSelfTests: { total: selfTests.length, passed, failed: selfTests.length - passed },
      externalProviders: externalResults.length,
    },
    own: {
      id: 'freeapi-hub',
      name: meta.name,
      type: 'own',
      status: ownStatus,
      version: meta.version,
      node: process.version,
      uptimeSeconds: Number(process.uptime().toFixed(2)),
      baseUrl,
      selfTests,
    },
    external: externalResults,
    networkHint,
  };
}

/**
 * GET /api/status — informe de estado con comprobaciones reales.
 * ?refresh=true ignora la caché, ?scope=own|external|all limita el alcance.
 */
router.get('/status', async (req, res, next) => {
  const startedAt = Date.now();
  try {
    const scope = asEnum(req.query.scope, 'scope', ['all', 'own', 'external'], 'all');
    const refresh = ['true', '1', 'si', 'sí'].includes(String(req.query.refresh ?? '').toLowerCase());

    const cached = refresh ? null : statusCache.get(CACHE_KEY);
    let report;

    if (cached) {
      report = { ...cached.value, cached: true, cacheAgeMs: cached.ageMs };
    } else {
      report = await buildStatusReport(req);
      statusCache.set(CACHE_KEY, report, req.app.locals.config.statusCacheTtlMs);
    }

    // El filtro de alcance se aplica al responder, para que la caché siga siendo única.
    const payload = { ...report, scope, durationMs: Date.now() - startedAt };
    if (scope === 'own') delete payload.external;
    if (scope === 'external') delete payload.own;

    sendSuccess(res, payload, { self: false, durationMs: Date.now() - startedAt });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
