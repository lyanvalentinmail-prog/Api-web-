'use strict';

const express = require('express');
const { sendSuccess } = require('../lib/respond');
const { asInteger, asNumber, asText, asEnum, asPattern, collectParams } = require('../lib/validate');
const { errors } = require('../lib/errors');
const { TtlCache } = require('../lib/cache');
const { request, requestBinary, UpstreamError } = require('../lib/http-client');
const { byId } = require('../lib/catalog');

/**
 * Proxies de solo lectura hacia APIs públicas de terceros.
 *
 * Reglas que se aplican a TODOS los proxies:
 *  - La URL se construye aquí a partir de una base fija y parámetros validados:
 *    nunca se acepta una URL del usuario (evita SSRF).
 *  - Timeout y tamaño máximo de respuesta configurables.
 *  - Caché con TTL para respetar los límites de cada proveedor.
 *  - La respuesta original se conserva en data.raw, sin modificarla.
 */

const cache = new TtlCache({ maxEntries: 300 });

const router = express.Router();

/** Convierte "true"/"1"/"si" en booleano (para parámetros de consulta). */
const isTrue = (value) => ['true', '1', 'si', 'sí', 'yes'].includes(String(value ?? '').toLowerCase());

/** Obtiene la definición del catálogo para documentar la respuesta con datos reales. */
const definition = (id) => byId.get(id);

/**
 * Crea el manejador de un proxy externo.
 * @param {{id: string, build: (req: import('express').Request) => {url: string}, binary?: boolean, keyMode?: string}} spec
 */
function createProxy(spec) {
  const endpoint = definition(spec.id);
  if (!endpoint) throw new Error(`El proxy ${spec.id} no está en el catálogo: añádelo a shared/catalog.`);

  const ttlMs = (endpoint.source?.cacheSeconds ?? 60) * 1000;
  const provider = endpoint.source?.provider || endpoint.provider;

  return async function proxyHandler(req, res, next) {
    const startedAt = Date.now();
    try {
      const { url } = spec.build(req);

      const cached = cache.get(url);
      if (cached) {
        res.setHeader('X-Upstream-Status', String(cached.value.httpStatus));
        return sendSuccess(
          res,
          { ...cached.value, cached: true, durationMs: 0, cachedAt: cached.value.checkedAt, cacheAgeMs: cached.ageMs },
          { self: false, durationMs: Date.now() - startedAt }
        );
      }

      const config = req.app.locals.config;
      const response = spec.binary
        ? await requestBinary(url, { timeoutMs: config.upstream.timeoutMs, maxBytes: config.upstream.binaryMaxBytes })
        : await request(url, { timeoutMs: config.upstream.timeoutMs, maxBytes: config.upstream.maxBytes });

      res.setHeader('X-Upstream-Status', String(response.status));

      if (response.status === 404) {
        throw errors.notFound(
          `El proveedor ${provider} no tiene datos para esa consulta (HTTP 404). Revisa los parámetros enviados.`,
          'UPSTREAM_NOT_FOUND'
        );
      }

      if (response.status === 429) {
        throw errors.badGateway(
          `El proveedor ${provider} ha respondido 429: se ha superado su cuota gratuita de peticiones. Espera unos minutos y vuelve a intentarlo.`,
          [
            { name: 'proveedor', value: provider, description: 'API externa que ha rechazado la petición.' },
            { name: 'limites', value: endpoint.source?.limits || '', description: 'Condiciones de uso publicadas por el proveedor.' },
          ]
        );
      }

      if (!response.ok) {
        throw errors.badGateway(
          `El proveedor ${provider} ha respondido con HTTP ${response.status}. No es un problema de este servidor: el servicio externo no está disponible ahora mismo.`,
          [
            { name: 'proveedor', value: provider, description: 'API externa consultada.' },
            { name: 'estado', value: response.status, description: 'Código HTTP devuelto por el proveedor.' },
          ]
        );
      }

      const base = {
        passthrough: true,
        provider,
        providerUrl: response.url || url,
        httpStatus: response.status,
        checkedAt: new Date().toISOString(),
        cached: false,
        durationMs: response.durationMs,
        limits: endpoint.source?.limits || null,
        notice: 'Datos servidos por un proveedor externo; no los genera FreeAPI Hub.',
      };

      let payload;
      if (spec.binary) {
        payload = {
          ...base,
          raw: null,
          contentType: response.contentType || 'application/octet-stream',
          sizeBytes: response.sizeBytes,
          base64: response.buffer.toString('base64'),
          dataUrl: `data:${response.contentType || 'application/octet-stream'};base64,${response.buffer.toString('base64')}`,
        };
      } else if (response.parseError) {
        payload = {
          ...base,
          raw: null,
          rawText: response.rawBody,
          notice: `El proveedor respondió con HTTP ${response.status} pero el cuerpo no era JSON válido; se devuelve como texto.`,
        };
      } else {
        payload = { ...base, raw: response.body };
      }

      cache.set(url, payload, ttlMs);
      return sendSuccess(res, { ...payload, cacheTtlSeconds: Math.round(ttlMs / 1000) }, { self: false, durationMs: Date.now() - startedAt });
    } catch (error) {
      if (error instanceof UpstreamError) {
        const details = [
          { name: 'proveedor', value: provider, description: 'API externa consultada.' },
          { name: 'limites', value: endpoint.source?.limits || '', description: 'Condiciones de uso del proveedor.' },
          { name: 'estado', value: '/api/status', description: 'Página de estado con la disponibilidad real de cada proveedor.' },
        ];
        if (error.kind === 'timeout') {
          return next(errors.gatewayTimeout(`El proveedor ${provider} no respondió a tiempo. ${error.message}`, details));
        }
        return next(errors.badGateway(`No se pudo obtener respuesta de ${provider}. ${error.message}`, details));
      }
      return next(error);
    }
  };
}

/** Patrón de IPv4 o IPv6 (validación previa a construir la URL del proveedor). */
const IP_PATTERN = /^(?:\d{1,3}(?:\.\d{1,3}){3}|[0-9a-fA-F]{0,4}(?::[0-9a-fA-F]{0,4}){2,7})$/;
const TIMEZONE_PATTERN = /^[A-Za-z_+-]{1,40}(?:\/[A-Za-z0-9_+-]{1,40}){0,2}$/;
const NAME_PATTERN = /^[\p{L}][\p{L}' -]{0,49}$/u;
const ISO2_PATTERN = /^[A-Za-z]{2}$/;

const WIKI_HOSTS = {
  es: 'es.wikipedia.org',
  en: 'en.wikipedia.org',
  pt: 'pt.wikipedia.org',
  fr: 'fr.wikipedia.org',
  de: 'de.wikipedia.org',
  it: 'it.wikipedia.org',
};

const NAT_CODES = ['es', 'fr', 'gb', 'us', 'mx', 'br', 'au', 'ca', 'de', 'dk', 'fi', 'ie', 'ir', 'nl', 'no', 'nz', 'tr', 'ch'];

/* ------------------------------------------------------------------ *
 * 1. Cat Fact Ninja
 * ------------------------------------------------------------------ */
router_get('/catfact/fact', createProxy({
  id: 'ext-catfact-fact',
  build: (req) => {
    const params = collectParams(req);
    const url = new URL('https://catfact.ninja/fact');
    if (params.max_length !== undefined && params.max_length !== '') {
      const maxLength = asInteger(params.max_length, 'max_length', 120);
      if (maxLength < 10 || maxLength > 500) {
        throw errors.badRequest('INVALID_INTEGER', 'max_length debe estar entre 10 y 500.');
      }
      url.searchParams.set('max_length', String(maxLength));
    }
    return { url: url.toString() };
  },
}));

router_get('/catfact/facts', createProxy({
  id: 'ext-catfact-facts',
  build: (req) => {
    const params = collectParams(req);
    const limit = asInteger(params.limit, 'limit', 5);
    const page = asInteger(params.page, 'page', 1);
    if (limit < 1 || limit > 50) throw errors.badRequest('INVALID_INTEGER', 'limit debe estar entre 1 y 50.');
    if (page < 1 || page > 20) throw errors.badRequest('INVALID_INTEGER', 'page debe estar entre 1 y 20.');
    const url = new URL('https://catfact.ninja/facts');
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('page', String(page));
    return { url: url.toString() };
  },
}));

/* ------------------------------------------------------------------ *
 * 2. Dog CEO
 * ------------------------------------------------------------------ */
router_get('/dogs/random', createProxy({
  id: 'ext-dogs-random',
  build: () => ({ url: 'https://dog.ceo/api/breeds/image/random' }),
}));

router_get('/dogs/breed/:breed/random', createProxy({
  id: 'ext-dogs-breed',
  build: (req) => {
    const breed = asPattern(req.params.breed, 'breed', /^[a-z]{3,30}(?:-[a-z]{3,30})?$/, {
      hint: 'La raza debe ir en minúsculas, sólo letras y guiones (por ejemplo husky o german-shepherd).',
      maxLength: 40,
    });
    return { url: `https://dog.ceo/api/breed/${encodeURIComponent(breed)}/images/random` };
  },
}));

/* ------------------------------------------------------------------ *
 * 3. IP: ipify e ipwho.is
 * ------------------------------------------------------------------ */
router_get('/ip', createProxy({
  id: 'ext-ip',
  build: () => ({ url: 'https://api.ipify.org?format=json' }),
}));

router_get('/ip-geo', createProxy({
  id: 'ext-ip-geo',
  build: (req) => {
    const params = collectParams(req);
    const ip = asPattern(params.ip, 'ip', IP_PATTERN, {
      hint: 'Debe ser una dirección IPv4 (8.8.8.8) o IPv6 válida.',
      maxLength: 45,
    });
    return { url: `https://ipwho.is/${encodeURIComponent(ip)}?fields=ip,success,type,continent,country,country_code,region,city,latitude,longitude,connection,timezone` };
  },
}));

/* ------------------------------------------------------------------ *
 * 4. Open-Meteo (clima y geocodificación)
 * ------------------------------------------------------------------ */
router_get('/weather', createProxy({
  id: 'ext-weather',
  build: (req) => {
    const params = collectParams(req);
    const latitude = asNumber(params.latitude, 'latitude');
    const longitude = asNumber(params.longitude, 'longitude');
    if (latitude < -90 || latitude > 90) throw errors.badRequest('INVALID_NUMBER', 'latitude debe estar entre -90 y 90.');
    if (longitude < -180 || longitude > 180) throw errors.badRequest('INVALID_NUMBER', 'longitude debe estar entre -180 y 180.');

    const includeCurrent = params.current === undefined ? true : isTrue(params.current);
    const includeHourly = isTrue(params.hourly);
    const includeDaily = params.daily === undefined ? true : isTrue(params.daily);
    const timezone = asPattern(params.timezone ?? 'auto', 'timezone', /^(auto|[A-Za-z_+-]{1,40}(?:\/[A-Za-z0-9_+-]{1,40}){0,2})$/, {
      hint: 'Usa "auto" o una zona IANA como Europe/Madrid.',
      maxLength: 60,
    });

    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', String(latitude));
    url.searchParams.set('longitude', String(longitude));
    if (includeCurrent) {
      url.searchParams.set('current', 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m');
    }
    if (includeHourly) {
      url.searchParams.set('hourly', 'temperature_2m,precipitation_probability,weather_code');
      url.searchParams.set('forecast_hours', '24');
    }
    if (includeDaily) {
      url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset');
      url.searchParams.set('forecast_days', '7');
    }
    url.searchParams.set('timezone', timezone);
    return { url: url.toString() };
  },
}));

router_get('/geocode', createProxy({
  id: 'ext-geocode',
  build: (req) => {
    const params = collectParams(req);
    const name = asText(params.name, 'name', { min: 2, max: 80 });
    const count = asInteger(params.count, 'count', 3);
    if (count < 1 || count > 10) throw errors.badRequest('INVALID_INTEGER', 'count debe estar entre 1 y 10.');
    const language = asEnum(params.language, 'language', ['es', 'en', 'pt', 'fr', 'de', 'it'], 'es');

    const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
    url.searchParams.set('name', name);
    url.searchParams.set('count', String(count));
    url.searchParams.set('language', language);
    url.searchParams.set('format', 'json');
    return { url: url.toString() };
  },
}));

/* ------------------------------------------------------------------ *
 * 5. Rest Countries
 * ------------------------------------------------------------------ */
const COUNTRY_FIELDS = 'name,cca2,cca3,capital,region,subregion,population,currencies,languages,flag,flags,timezones,area,languages';

router_get('/countries', createProxy({
  id: 'ext-countries-search',
  build: (req) => {
    const params = collectParams(req);
    const name = asText(params.name, 'name', { min: 3, max: 60 });
    return { url: `https://restcountries.com/v3.1/name/${encodeURIComponent(name)}?fields=${COUNTRY_FIELDS}` };
  },
}));

router_get('/countries/:code', createProxy({
  id: 'ext-countries-code',
  build: (req) => {
    const code = asPattern(req.params.code, 'code', /^[A-Za-z]{2,3}$/, {
      hint: 'Debe ser un código ISO de 2 o 3 letras, por ejemplo ES o ESP.',
      maxLength: 3,
    });
    return { url: `https://restcountries.com/v3.1/alpha/${encodeURIComponent(code)}?fields=${COUNTRY_FIELDS}` };
  },
}));

/* ------------------------------------------------------------------ *
 * 6. Genderize / Nationalize / Agify (mismo proveedor, cuota por IP)
 * ------------------------------------------------------------------ */
function nameBasedSpec(id, baseUrl) {
  return createProxy({
    id,
    build: (req) => {
      const params = collectParams(req);
      const name = asPattern(params.name, 'name', NAME_PATTERN, {
        hint: 'Sólo se admiten letras, espacios y guiones (1 a 50 caracteres).',
        maxLength: 50,
      });
      const url = new URL(baseUrl);
      url.searchParams.set('name', name);
      if (params.country_id !== undefined && params.country_id !== '') {
        const countryId = asPattern(params.country_id, 'country_id', ISO2_PATTERN, {
          hint: 'El país debe ser un código ISO de dos letras, por ejemplo ES.',
          maxLength: 2,
        });
        url.searchParams.set('country_id', countryId.toUpperCase());
      }
      return { url: url.toString() };
    },
  });
}

router_get('/genderize', nameBasedSpec('ext-genderize', 'https://api.genderize.io/'));
router_get('/nationalize', nameBasedSpec('ext-nationalize', 'https://api.nationalize.io/'));
router_get('/agify', nameBasedSpec('ext-agify', 'https://api.agify.io/'));

/* ------------------------------------------------------------------ *
 * 7. Códigos QR (respuesta binaria)
 * ------------------------------------------------------------------ */
router_get('/qr', createProxy({
  id: 'ext-qr',
  binary: true,
  build: (req) => {
    const params = collectParams(req);
    const data = asText(params.data, 'data', { min: 1, max: 500 });
    const size = asInteger(params.size, 'size', 300);
    const margin = asInteger(params.margin, 'margin', 4);
    if (size < 100 || size > 1000) throw errors.badRequest('INVALID_INTEGER', 'size debe estar entre 100 y 1000 píxeles.');
    if (margin < 0 || margin > 50) throw errors.badRequest('INVALID_INTEGER', 'margin debe estar entre 0 y 50 píxeles.');

    const url = new URL('https://api.qrserver.com/v1/create-qr-code/');
    url.searchParams.set('size', `${size}x${size}`);
    url.searchParams.set('margin', String(margin));
    url.searchParams.set('data', data);
    return { url: url.toString() };
  },
}));

/* ------------------------------------------------------------------ *
 * 8. Usuarios ficticios
 * ------------------------------------------------------------------ */
router_get('/users/random', createProxy({
  id: 'ext-users-random',
  build: (req) => {
    const params = collectParams(req);
    const results = asInteger(params.results, 'results', 1);
    if (results < 1 || results > 5) throw errors.badRequest('INVALID_INTEGER', 'results debe estar entre 1 y 5.');
    const nat = asEnum(params.nat, 'nat', NAT_CODES, 'es');

    const url = new URL('https://randomuser.me/api/');
    url.searchParams.set('results', String(results));
    url.searchParams.set('nat', nat);
    return { url: url.toString() };
  },
}));

/* ------------------------------------------------------------------ *
 * 9. Humor
 * ------------------------------------------------------------------ */
router_get('/jokes/random', createProxy({
  id: 'ext-dad-joke',
  build: () => ({ url: 'https://icanhazdadjoke.com/' }),
}));

/* ------------------------------------------------------------------ *
 * 10. Libros de dominio público (Gutendex)
 * ------------------------------------------------------------------ */
router_get('/books', createProxy({
  id: 'ext-books',
  build: (req) => {
    const params = collectParams(req);
    const search = asText(params.search, 'search', { min: 2, max: 100 });
    const page = asInteger(params.page, 'page', 1);
    if (page < 1 || page > 20) throw errors.badRequest('INVALID_INTEGER', 'page debe estar entre 1 y 20.');

    const url = new URL('https://gutendex.com/books');
    url.searchParams.set('search', search);
    url.searchParams.set('page', String(page));
    if (params.language !== undefined && params.language !== '') {
      const language = asPattern(params.language, 'language', ISO2_PATTERN, {
        hint: 'El idioma debe ser un código de dos letras, por ejemplo es.',
        maxLength: 2,
      });
      url.searchParams.set('languages', language);
    }
    return { url: url.toString() };
  },
}));

/* ------------------------------------------------------------------ *
 * 11. Wikipedia (API oficial de MediaWiki)
 * ------------------------------------------------------------------ */
router_get('/wikipedia/search', createProxy({
  id: 'ext-wikipedia',
  build: (req) => {
    const params = collectParams(req);
    const search = asText(params.search, 'search', { min: 2, max: 200 });
    const limit = asInteger(params.limit, 'limit', 5);
    if (limit < 1 || limit > 20) throw errors.badRequest('INVALID_INTEGER', 'limit debe estar entre 1 y 20.');
    const language = asEnum(params.language, 'language', Object.keys(WIKI_HOSTS), 'es');
    const host = WIKI_HOSTS[language];

    const url = new URL(`https://${host}/w/api.php`);
    url.searchParams.set('action', 'query');
    url.searchParams.set('list', 'search');
    url.searchParams.set('srsearch', search);
    url.searchParams.set('srlimit', String(limit));
    url.searchParams.set('srprop', 'snippet|wordcount|timestamp');
    url.searchParams.set('format', 'json');
    url.searchParams.set('utf8', '1');
    url.searchParams.set('origin', '*');
    return { url: url.toString() };
  },
}));

/* ------------------------------------------------------------------ *
 * 12. Precios de criptomonedas (CoinGecko, endpoint público sin clave)
 * ------------------------------------------------------------------ */
router_get('/crypto/price', createProxy({
  id: 'ext-crypto-price',
  build: (req) => {
    const params = collectParams(req);
    const ids = asPattern(params.ids ?? 'bitcoin', 'ids', /^[a-z0-9-]{2,40}(?:,[a-z0-9-]{2,40}){0,9}$/, {
      hint: 'Usa identificadores de CoinGecko en minúsculas separados por comas, por ejemplo bitcoin,ethereum.',
      maxLength: 400,
    });
    const currencies = asPattern(params.vs_currencies ?? 'usd', 'vs_currencies', /^[a-z]{2,5}(?:,[a-z]{2,5}){0,5}$/, {
      hint: 'Usa códigos de moneda separados por comas, por ejemplo usd,eur.',
      maxLength: 60,
    });

    const url = new URL('https://api.coingecko.com/api/v3/simple/price');
    url.searchParams.set('ids', ids);
    url.searchParams.set('vs_currencies', currencies);
    url.searchParams.set('include_last_updated_at', 'true');
    return { url: url.toString() };
  },
}));

/* ------------------------------------------------------------------ *
 * 13. Validador de expresiones regulares (comprobación local, sin proveedor)
 * ------------------------------------------------------------------ */
/**
 * Registra una ruta GET. Se usa una función para mantener el estilo uniforme y
 * evitar repetir `router.get(...)` en cada proxy.
 * @param {string} path
 * @param {import('express').RequestHandler} handler
 */
function router_get(path, handler) {
  router.get(path, handler);
}

module.exports = router;
module.exports.__cache = cache;
