'use strict';

/**
 * Configuración del servidor. Todo se puede ajustar con variables de entorno,
 * y todos los valores tienen un valor por defecto sensato para desarrollo.
 */
function readInt(env, name, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < min || value > max) {
    // eslint-disable-next-line no-console
    console.warn(`[config] ${name}="${raw}" no es válido (rango ${min}-${max}). Se usa ${fallback}.`);
    return fallback;
  }
  return value;
}

function readBool(env, name, fallback) {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  return ['1', 'true', 'yes', 'si', 'sí', 'on'].includes(String(raw).toLowerCase());
}

function readList(env, name, fallback) {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Detecta si estamos ejecutando dentro de una función serverless.
 * En Vercel las funciones corren en AWS Lambda, que expone AWS_LAMBDA_FUNCTION_NAME;
 * también se respeta una variable propia por si se usa otro proveedor.
 */
function detectServerless(env) {
  if (readBool(env, 'SERVERLESS', false)) return true;
  return Boolean(env.VERCEL || env.AWS_LAMBDA_FUNCTION_NAME || env.AWS_EXECUTION_ENV);
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
function loadConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';
  const serverless = detectServerless(env);

  return {
    nodeEnv,
    isProduction,
    serverless,
    /** Puerto HTTP. En la mayoría de plataformas (Render, Railway, Fly…) viene en PORT. */
    port: readInt(env, 'PORT', 3000, { min: 0, max: 65535 }),
    /** Interfaz de escucha. 0.0.0.0 es necesario para contenedores y despliegues. */
    host: env.HOST || '0.0.0.0',
    /**
     * Número de proxies de confianza por delante de la app. Se usa para que la
     * IP real del cliente (y por tanto el limitador de peticiones) funcione
     * detrás de un proxy. Por defecto 1 en producción (todas las plataformas
     * habituales ponen un proxy) y 0 en desarrollo; ajústalo si tu montaje es
     * distinto (por ejemplo TRUST_PROXY=2 con un CDN delante de un proxy).
     */
    trustProxy: readInt(env, 'TRUST_PROXY', isProduction ? 1 : 0, { min: 0, max: 10 }),
    /**
     * Orígenes permitidos por CORS. Por defecto cualquiera, porque la API es
     * pública, no usa cookies ni API keys y por diseño se quiere poder llamar
     * desde cualquier sitio. Pon una lista separada por comas para restringir.
     */
    corsOrigins: readList(env, 'CORS_ORIGINS', ['*']),
    /** Registro de cada petición en la consola. */
    logRequests: readBool(env, 'LOG_REQUESTS', true),
    /** Tamaño máximo del cuerpo de las peticiones (JSON/texto). */
    bodyLimit: env.BODY_LIMIT || '256kb',
    /** Caché de archivos estáticos de la interfaz web. */
    staticMaxAge: env.STATIC_MAX_AGE || (isProduction ? '1h' : '0'),
    rateLimits: {
      general: {
        windowMs: readInt(env, 'RATE_LIMIT_GENERAL_WINDOW_MS', 60_000, { min: 1000 }),
        max: readInt(env, 'RATE_LIMIT_GENERAL_MAX', 120, { min: 1 }),
      },
      external: {
        windowMs: readInt(env, 'RATE_LIMIT_EXTERNAL_WINDOW_MS', 60_000, { min: 1000 }),
        max: readInt(env, 'RATE_LIMIT_EXTERNAL_MAX', 30, { min: 1 }),
      },
      write: {
        windowMs: readInt(env, 'RATE_LIMIT_WRITE_WINDOW_MS', 60_000, { min: 1000 }),
        max: readInt(env, 'RATE_LIMIT_WRITE_MAX', 20, { min: 1 }),
      },
    },
    /** Segundos que se reutiliza el resultado de /api/status. */
    statusCacheTtlMs: readInt(env, 'STATUS_CACHE_TTL_MS', 45_000, { min: 0 }),
    /**
     * Nº de comprobaciones simultáneas a proveedores externos en /api/status.
     * En serverless se reduce porque el tiempo máximo de ejecución es corto.
     */
    statusCheckConcurrency: readInt(env, 'STATUS_CHECK_CONCURRENCY', serverless ? 4 : 6, { min: 1, max: 16 }),
    /** Timeout y tamaño máximo para las llamadas a APIs externas. */
    upstream: {
      timeoutMs: readInt(env, 'UPSTREAM_TIMEOUT_MS', 8000, { min: 500, max: 60_000 }),
      maxBytes: readInt(env, 'UPSTREAM_MAX_BYTES', 1_000_000, { min: 1024 }),
      binaryMaxBytes: readInt(env, 'UPSTREAM_BINARY_MAX_BYTES', 512_000, { min: 1024 }),
    },
  };
}

module.exports = loadConfig;
module.exports.loadConfig = loadConfig;
module.exports.detectServerless = detectServerless;
