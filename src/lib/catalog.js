'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { errors } = require('./errors');

const CATALOG_DIR = path.join(__dirname, '..', '..', 'shared', 'catalog');

/** @param {string} file @returns {any} */
function readJsonFile(file) {
  const fullPath = path.join(CATALOG_DIR, file);
  try {
    return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  } catch (error) {
    throw new Error(`No se pudo cargar el archivo de catálogo ${file}: ${error.message}`);
  }
}

/** Congela en profundidad para evitar mutaciones accidentales del catálogo en tiempo de ejecución. */
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}

const meta = deepFreeze(readJsonFile('meta.json'));
const categories = deepFreeze(readJsonFile('categories.json'));
const endpoints = deepFreeze([
  ...readJsonFile('endpoints.own.core.json'),
  ...readJsonFile('endpoints.own.tools.json'),
  ...readJsonFile('endpoints.external.json'),
]);

const byId = new Map(endpoints.map((endpoint) => [endpoint.id, endpoint]));

/** Agrupa los endpoints por origen para contarlos y filtrarlos con rapidez. */
const counts = endpoints.reduce(
  (acc, endpoint) => {
    acc.byType[endpoint.type] = (acc.byType[endpoint.type] || 0) + 1;
    acc.byCategory[endpoint.category] = (acc.byCategory[endpoint.category] || 0) + 1;
    return acc;
  },
  { byType: {}, byCategory: {} }
);

/**
 * Proveedores externos únicos (varios endpoints pueden compartir proveedor).
 * Se usan para el chequeo de estado, así no repetimos la misma comprobación.
 */
const providers = (() => {
  const map = new Map();
  for (const endpoint of endpoints) {
    if (endpoint.type !== 'external' || !endpoint.source) continue;
    const key = endpoint.source.providerId;
    if (!map.has(key)) {
      map.set(key, {
        id: key,
        name: endpoint.source.provider,
        host: endpoint.source.host,
        docUrl: endpoint.source.docUrl,
        baseUrl: endpoint.source.baseUrl,
        checkPath: endpoint.source.checkPath,
        binary: Boolean(endpoint.source.binary),
        endpoints: [],
        limits: endpoint.source.limits,
        examplePath: endpoint.path,
        exampleMethod: endpoint.methods[0],
      });
    }
    map.get(key).endpoints.push(endpoint.id);
  }
  return Object.freeze([...map.values()]);
})();

const categoryIds = new Set(categories.map((category) => category.id));
const methodAllowList = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * Rutas con parámetros de Express (por ejemplo /api/demo/tasks/:id) convertidas
 * a expresiones regulares para poder responder 405 en lugar de 404 cuando la
 * ruta existe pero el método no está permitido, y para el mensaje de ayuda.
 */
const routeMatchers = (() => {
  const map = new Map();
  for (const endpoint of endpoints) {
    const regexSource = `^${endpoint.path
      .split('/')
      .map((segment) => (segment.startsWith(':') ? '[^/]+' : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      .join('/')}/?$`;
    for (const method of endpoint.methods) {
      if (!map.has(regexSource)) map.set(regexSource, { regex: new RegExp(regexSource), methods: new Set(), endpointIds: [] });
      const entry = map.get(regexSource);
      entry.methods.add(method);
      entry.endpointIds.push(endpoint.id);
    }
  }
  return [...map.values()];
})();

/**
 * @param {string} requestPath Ruta solicitada (sin query)
 * @param {string} method Método HTTP en mayúsculas
 * @returns {{knownPath: boolean, allowedMethods: string[]}}
 */
function describeRoute(requestPath, method) {
  const match = routeMatchers.find((entry) => entry.regex.test(requestPath));
  if (!match) return { knownPath: false, allowedMethods: [] };
  const allowedMethods = [...match.methods];
  return { knownPath: true, allowedMethods };
}

/**
 * Filtra el catálogo. Todos los filtros son opcionales.
 * @param {{type?: string, category?: string, search?: string, method?: string, compact?: boolean}} [filters]
 */
function getEndpoints(filters = {}) {
  const { type, category, search, method, compact = false } = filters;

  if (type && !['own', 'external', 'demo'].includes(type)) {
    throw errors.badRequest('INVALID_ENUM', 'El parámetro type debe ser own, external o demo.');
  }
  if (category && !categoryIds.has(category)) {
    throw errors.badRequest(
      'INVALID_ENUM',
      `La categoría "${category}" no existe. Categorías disponibles: ${[...categoryIds].join(', ')}.`
    );
  }
  if (method && !methodAllowList.includes(method)) {
    throw errors.badRequest('INVALID_ENUM', `El método debe ser uno de: ${methodAllowList.join(', ')}.`);
  }

  const needle = search ? search.toLowerCase() : null;
  const filtered = endpoints.filter((endpoint) => {
    if (type && endpoint.type !== type) return false;
    if (category && endpoint.category !== category) return false;
    if (method && !endpoint.methods.includes(method)) return false;
    if (needle) {
      const haystack = [endpoint.name, endpoint.summary, endpoint.path, endpoint.category, endpoint.id, ...(endpoint.tags || [])]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });

  return compact
    ? filtered.map((endpoint) => ({
        id: endpoint.id,
        name: endpoint.name,
        type: endpoint.type,
        category: endpoint.category,
        path: endpoint.path,
        methods: endpoint.methods,
        provider: endpoint.provider || null,
      }))
    : filtered;
}

/** Resumen del catálogo usado por /api/info y /api/catalog. */
function getSummary() {
  return {
    ownEndpoints: counts.byType.own || 0,
    demoEndpoints: counts.byType.demo || 0,
    externalEndpoints: counts.byType.external || 0,
    totalEndpoints: endpoints.length,
    categories: categories.length,
    externalProviders: providers.length,
  };
}

module.exports = {
  meta,
  categories,
  endpoints,
  providers,
  byId,
  getEndpoints,
  getSummary,
  describeRoute,
  methodAllowList,
  counts,
  categoryIds,
};
