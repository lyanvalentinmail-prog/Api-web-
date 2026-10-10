'use strict';

/**
 * Cliente HTTP mínimo para llamar a APIs externas y para las autocomprobaciones
 * internas del servidor.
 *
 * Motivos de seguridad y fiabilidad:
 *  - Timeout obligatorio (AbortController) para no dejar peticiones colgadas.
 *  - Límite de tamaño de respuesta (evita consumir toda la memoria del proceso).
 *  - Sólo se admiten URLs https ya construidas por nosotros a partir de una
 *    lista blanca de hosts y parámetros validados (nunca una URL del usuario).
 */

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_MAX_BYTES = 1_000_000; // 1 MB
const DEFAULT_BINARY_MAX_BYTES = 512_000; // 512 KB

class UpstreamError extends Error {
  /**
   * @param {'timeout'|'network'|'too_large'} kind
   * @param {string} message
   */
  constructor(kind, message) {
    super(message);
    this.name = 'UpstreamError';
    this.kind = kind;
  }
}

/**
 * Lee el cuerpo de la respuesta deteniéndose al alcanzar maxBytes.
 * @param {Response} response
 * @param {number} maxBytes
 * @returns {Promise<Buffer>}
 */
async function readLimitedBuffer(response, maxBytes) {
  if (!response.body || typeof response.body.getReader !== 'function') {
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > maxBytes) {
      throw new UpstreamError('too_large', 'La respuesta del servicio remoto supera el tamaño máximo permitido.');
    }
    return Buffer.from(arrayBuffer);
  }

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new UpstreamError('too_large', 'La respuesta del servicio remoto supera el tamaño máximo permitido.');
    }
    chunks.push(Buffer.from(value));
  }

  return Buffer.concat(chunks);
}

/**
 * Realiza una petición HTTP y devuelve el cuerpo como texto/JSON.
 * @param {string} url URL ya validada y construida por el servidor
 * @param {{timeoutMs?: number, maxBytes?: number, headers?: Record<string,string>, method?: string, body?: string}} [options]
 */
async function request(url, options = {}) {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxBytes = DEFAULT_MAX_BYTES,
    headers = {},
    method = 'GET',
    body,
  } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      method,
      body,
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        accept: 'application/json',
        'user-agent': 'FreeAPI-Hub/1.0 (API publica gratuita sin clave)',
        ...headers,
      },
    });

    const buffer = await readLimitedBuffer(response, maxBytes);
    const rawBody = buffer.toString('utf8');

    let parsedBody;
    let parseError = false;
    try {
      parsedBody = rawBody === '' ? null : JSON.parse(rawBody);
    } catch {
      parseError = true;
      parsedBody = null;
    }

    return {
      status: response.status,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries()),
      body: parsedBody,
      rawBody: parseError ? rawBody.slice(0, 2000) : rawBody,
      parseError,
      buffer,
      contentType: response.headers.get('content-type') || '',
      sizeBytes: buffer.byteLength,
      durationMs: Date.now() - startedAt,
      url: response.url || url,
    };
  } catch (error) {
    if (error && error.name === 'AbortError') {
      throw new UpstreamError('timeout', `El servicio remoto no respondió en ${timeoutMs} ms.`);
    }
    if (error instanceof UpstreamError) throw error;
    throw new UpstreamError('network', `No se pudo conectar con el servicio remoto: ${error.message}`);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Igual que `request` pero sin intentar interpretar el cuerpo como JSON.
 * @param {string} url
 * @param {{timeoutMs?: number, maxBytes?: number, headers?: Record<string,string>, method?: string, body?: string}} [options]
 */
function requestBinary(url, options = {}) {
  return request(url, { maxBytes: DEFAULT_BINARY_MAX_BYTES, ...options });
}

module.exports = {
  request,
  requestBinary,
  UpstreamError,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_MAX_BYTES,
  DEFAULT_BINARY_MAX_BYTES,
};
