'use strict';

const express = require('express');
const os = require('node:os');
const { sendSuccess } = require('../lib/respond');
const { getEndpoints, getSummary, categories, meta, describeRoute, methodAllowList } = require('../lib/catalog');
const { asEnum, asPattern } = require('../lib/validate');
const { errors } = require('../lib/errors');

const router = express.Router();

const STARTED_AT = Date.now();

/** GET /api/health — liveness: siempre 200 si el proceso responde. */
router.get('/health', (req, res, next) => {
  try {
    const memory = process.memoryUsage();
    const checks = [
      { name: 'catalogo-cargado', ok: getSummary().totalEndpoints > 0, durationMs: 0 },
      { name: 'rutas-registradas', ok: true, durationMs: 0 },
      { name: 'sistema-operativo', ok: typeof os.platform() === 'string', durationMs: 0 },
    ];
    const degraded = checks.some((check) => !check.ok);

    sendSuccess(
      res,
      {
        status: degraded ? 'degraded' : 'ok',
        uptimeSeconds: Number((process.uptime()).toFixed(2)),
        startedAt: new Date(STARTED_AT).toISOString(),
        node: process.version,
        pid: process.pid,
        platform: os.platform(),
        memory: {
          rssMb: Number((memory.rss / 1024 / 1024).toFixed(1)),
          heapUsedMb: Number((memory.heapUsed / 1024 / 1024).toFixed(1)),
        },
        checks,
        environment: process.env.NODE_ENV || 'development',
      },
      { status: degraded ? 503 : 200 }
    );
  } catch (error) {
    next(error);
  }
});

/** GET /api/info — metadatos públicos calculados en el momento. */
router.get('/info', (req, res, next) => {
  try {
    const summary = getSummary();
    sendSuccess(res, {
      name: meta.name,
      version: meta.version,
      tagline: meta.tagline,
      description: meta.description,
      authentication: {
        required: false,
        apiKey: false,
        signup: false,
        login: false,
        note: meta.auth,
      },
      counts: { ...summary },
      documentation: {
        catalog: '/api/catalog',
        status: '/api/status',
        openapi: '/api/openapi.json',
        interface: '/',
        readme: 'https://github.com/lyanvalentinmail-prog/Api-web-/blob/main/README.md',
      },
      rateLimits: meta.rateLimits,
      cors: { enabled: true, origins: req.app.locals.config.corsOrigins.includes('*') ? '*' : req.app.locals.config.corsOrigins, credentials: false },
      license: meta.license,
      server: {
        node: process.version,
        uptimeSeconds: Number(process.uptime().toFixed(2)),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        baseUrl: req.apiBaseUrl,
      },
      externalApis: {
        count: summary.externalEndpoints,
        providers: summary.externalProviders,
        note: 'Los endpoints /api/external/* son proxies de solo lectura a APIs públicas de terceros: no dependen de claves y su disponibilidad la marca cada proveedor. Consulta /api/status.',
      },
      notes: meta.notes,
    }, { self: false });
  } catch (error) {
    next(error);
  }
});

/** GET /api/catalog — catálogo completo o filtrado, con las mismas definiciones que usa la web. */
router.get('/catalog', (req, res, next) => {
  try {
    const type = req.query.type === undefined ? undefined : asEnum(req.query.type, 'type', ['own', 'external', 'demo']);
    const category = req.query.category === undefined ? undefined : asPattern(req.query.category, 'category', /^[a-z-]{2,30}$/, {
      hint: 'Debe ser el identificador de una categoría, por ejemplo texto o aleatorio.',
    });
    const method = req.query.method === undefined ? undefined : asEnum(req.query.method, 'method', methodAllowList);
    const compact = ['true', '1', 'si', 'sí'].includes(String(req.query.compact ?? '').toLowerCase());
    const search = req.query.search === undefined ? undefined : String(req.query.search).slice(0, 100);

    const endpoints = getEndpoints({ type, category, method, compact, search });
    const summary = getSummary();

    const payload = {
      meta: {
        name: meta.name,
        version: meta.version,
        tagline: meta.tagline,
        description: meta.description,
        authentication: { required: false, apiKey: false, note: meta.auth },
        ownEndpointsPrefix: meta.ownEndpointsPrefix,
        externalProxyPrefix: meta.externalProxyPrefix,
        counts: summary,
        rateLimits: meta.rateLimits,
        notes: meta.notes,
        generatedAt: new Date().toISOString(),
      },
      categories,
      filters: {
        type: type || null,
        category: category || null,
        method: method || null,
        search: search || null,
        compact,
      },
      count: endpoints.length,
      endpoints,
    };

    sendSuccess(res, payload, { self: false });
  } catch (error) {
    next(error);
  }
});

/** Convierte los parámetros del catálogo al formato de OpenAPI. */
function buildOperation(endpoint) {
  const queryParams = endpoint.parameters.filter((param) => param.in === 'query' && param.name !== 'cualquiera');
  const pathParams = endpoint.parameters.filter((param) => param.in === 'path');
  const bodyParams = endpoint.parameters.filter((param) => param.in === 'body');

  const typeMap = { integer: 'integer', number: 'number', boolean: 'boolean', string: 'string', 'array<string>': 'array' };

  const parameters = [
    ...pathParams.map((param) => ({
      name: param.name,
      in: 'path',
      required: true,
      description: param.description,
      schema: { type: 'integer' },
      example: Number(param.example) || param.example,
    })),
    ...queryParams.map((param) => ({
      name: param.name,
      in: 'query',
      required: Boolean(param.required),
      description: param.description,
      schema: {
        type: typeMap[param.type] || 'string',
        ...(param.enum ? { enum: param.enum } : {}),
        ...(param.default ? { default: /^-?\d+(\.\d+)?$/.test(param.default) ? Number(param.default) : param.default } : {}),
      },
      example: param.type === 'integer' ? Number(param.example) || param.example : param.example,
    })),
  ];

  const operation = {
    tags: [endpoint.category],
    summary: endpoint.summary,
    description: endpoint.description,
    operationId: endpoint.id,
    parameters,
    responses: {
      200: {
        description: 'Respuesta correcta en formato JSON estándar.',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/SuccessEnvelope' },
            ...(endpoint.exampleResponse?.body ? { example: endpoint.exampleResponse.body } : {}),
          },
        },
      },
      default: {
        description: 'Error en formato JSON estándar.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
      },
    },
  };

  if (endpoint.exampleResponse?.status && endpoint.exampleResponse.status !== 200) {
    operation.responses[endpoint.exampleResponse.status] = operation.responses[200];
  }

  if (bodyParams.length) {
    operation.requestBody = {
      required: bodyParams.some((param) => param.required),
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: Object.fromEntries(
              bodyParams.map((param) => [
                param.name,
                {
                  type: typeMap[param.type] || 'string',
                  ...(param.type === 'array<string>' ? { items: { type: 'string' } } : {}),
                  ...(param.enum ? { enum: param.enum } : {}),
                  description: param.description,
                  example: param.example,
                },
              ])
            ),
            required: bodyParams.filter((param) => param.required).map((param) => param.name),
          },
        },
      },
    };
  }

  return operation;
}

/** GET /api/openapi.json — especificación OpenAPI 3 generada desde el catálogo. */
router.get('/openapi.json', (req, res, next) => {
  try {
    const document = {
      openapi: '3.0.3',
      info: {
        title: meta.name,
        version: meta.version,
        description: `${meta.description}\n\n${meta.auth}`,
        license: { name: meta.license },
      },
      servers: [{ url: req.apiBaseUrl, description: 'Servidor que está sirviendo esta especificación' }],
      tags: categories.map((category) => ({ name: category.id, description: `${category.name}. ${category.description}` })),
      paths: {},
      components: {
        schemas: {
          SuccessEnvelope: {
            type: 'object',
            required: ['ok', 'data'],
            properties: {
              ok: { type: 'boolean', example: true },
              data: { type: 'object', description: 'Contenido específico de cada endpoint.' },
              meta: {
                type: 'object',
                properties: {
                  endpoint: { type: 'string' },
                  method: { type: 'string' },
                  durationMs: { type: 'integer' },
                  timestamp: { type: 'string', format: 'date-time' },
                  requestId: { type: 'string' },
                },
              },
            },
          },
          ErrorEnvelope: {
            type: 'object',
            required: ['ok', 'error'],
            properties: {
              ok: { type: 'boolean', example: false },
              error: {
                type: 'object',
                properties: {
                  code: { type: 'string', example: 'INVALID_NUMBER' },
                  message: { type: 'string' },
                  status: { type: 'integer', example: 400 },
                  details: { type: 'array', items: { type: 'object' } },
                },
              },
              meta: { type: 'object' },
            },
          },
        },
      },
    };

    for (const endpoint of getEndpoints()) {
      const pathKey = endpoint.path.replace(/:(\w+)/g, '{$1}');
      document.paths[pathKey] = document.paths[pathKey] || {};
      for (const method of endpoint.methods) {
        document.paths[pathKey][method.toLowerCase()] = buildOperation(endpoint);
      }
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).send(JSON.stringify(document, null, 2));
  } catch (error) {
    next(error);
  }
});

/** Índice de la API: ayuda cuando alguien abre /api en el navegador. */
router.get('/', (req, res, next) => {
  try {
    const groups = [
      { name: 'Sistema y metadatos', base: '/api', endpoints: ['/api/health', '/api/info', '/api/catalog', '/api/openapi.json', '/api/status'] },
      { name: 'Datos aleatorios', base: '/api/random', endpoints: ['/api/random/number', '/api/random/uuid', '/api/random/string', '/api/random/choice'] },
      { name: 'Fecha y hora', base: '/api/time', endpoints: ['/api/time', '/api/time/world', '/api/time/timezones'] },
      { name: 'Texto', base: '/api/text', endpoints: ['/api/text/reverse', '/api/text/uppercase', '/api/text/slug', '/api/text/stats', '/api/text/count'] },
      { name: 'JSON', base: '/api/json', endpoints: ['/api/json/validate', '/api/json/format'] },
      { name: 'Matemáticas', base: '/api/math', endpoints: ['/api/math/add', '/api/math/multiply', '/api/math/statistics'] },
      { name: 'Utilidades', base: '/api/util', endpoints: ['/api/util/base64', '/api/util/hash', '/api/util/color', '/api/util/echo', '/api/util/validate-regex'] },
      { name: 'CRUD de ejemplo', base: '/api/demo', endpoints: ['/api/demo/tasks', '/api/demo/tasks/:id', '/api/demo/reset'] },
      { name: 'APIs externas', base: '/api/external', endpoints: ['/api/external/weather', '/api/external/geocode', '/api/external/countries/:code'] },
    ];

    sendSuccess(res, {
      message: 'FreeAPI Hub está funcionando. No necesitas registro, login ni API key.',
      counts: getSummary(),
      documentation: { catalog: '/api/catalog', status: '/api/status', openapi: '/api/openapi.json', web: '/' },
      groups,
    }, { self: false });
  } catch (error) {
    next(error);
  }
});

/** Comprueba que las rutas tienen un método definido (se usa en las pruebas). */
router.get('/routes', (req, res, next) => {
  try {
    const routes = getEndpoints().map((endpoint) => ({
      path: endpoint.path,
      methods: endpoint.methods,
      type: endpoint.type,
      known: describeRoute(endpoint.path.replace(/:(\w+)/g, 'x'), endpoint.methods[0]).knownPath,
    }));
    sendSuccess(res, { count: routes.length, routes }, { self: false });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
// La comprobación de rutas exige que el catálogo no esté vacío.
router.stack = router.stack;
if (getEndpoints().length === 0) {
  throw errors.internal('El catálogo de endpoints está vacío: revisa shared/catalog.');
}
