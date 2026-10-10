'use strict';

/**
 * Error de API con código HTTP y código de error legible por máquina.
 * Todos los errores propios se serializan con el mismo formato JSON.
 */
class ApiError extends Error {
  /**
   * @param {number} status Código HTTP
   * @param {string} code Código de error legible por máquina (ej. INVALID_PARAM)
   * @param {string} message Mensaje legible en español
   * @param {Array<object>} [details] Detalles opcionales (por ejemplo, parámetros inválidos)
   */
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details || [];
    this.expose = true;
  }
}

const errors = {
  badRequest: (code, message, details) => new ApiError(400, code, message, details),
  notFound: (message, code = 'NOT_FOUND') => new ApiError(404, code, message),
  methodNotAllowed: (allowed = []) =>
    new ApiError(
      405,
      'METHOD_NOT_ALLOWED',
      `Método HTTP no permitido en esta ruta. Métodos permitidos: ${allowed.join(', ') || 'ninguno'}.`
    ),
  payloadTooLarge: (message) => new ApiError(413, 'PAYLOAD_TOO_LARGE', message),
  unprocessable: (code, message, details) => new ApiError(422, code, message, details),
  tooManyRequests: (message, retryAfterSeconds) => {
    const err = new ApiError(429, 'RATE_LIMIT_EXCEEDED', message);
    err.retryAfterSeconds = retryAfterSeconds;
    return err;
  },
  badGateway: (message, details) => new ApiError(502, 'UPSTREAM_UNAVAILABLE', message, details),
  gatewayTimeout: (message, details) => new ApiError(504, 'UPSTREAM_TIMEOUT', message, details),
  internal: (message = 'Error interno del servidor.') => new ApiError(500, 'INTERNAL_ERROR', message),
};

module.exports = { ApiError, errors };
