'use strict';

const { ApiError } = require('../lib/errors');
const { sendError } = require('../lib/respond');
const { describeRoute } = require('../lib/catalog');

/** 404 con ayuda: si la ruta existe pero con otro método, responde 405. */
function notFoundHandler(req, res) {
  const { knownPath, allowedMethods } = describeRoute(req.path, req.method);

  if (knownPath && !allowedMethods.includes(req.method)) {
    return sendError(res, new ApiError(
      405,
      'METHOD_NOT_ALLOWED',
      `El método ${req.method} no está permitido en ${req.path}. Métodos permitidos: ${allowedMethods.join(', ')}.`
    ));
  }

  const message = knownPath
    ? `La ruta ${req.path} existe pero no coincide exactamente con ningún endpoint documentado.`
    : `No existe el endpoint ${req.path}. Consulta el catálogo completo en /api/catalog o abre /api para ver la documentación web.`;

  return sendError(res, new ApiError(404, 'NOT_FOUND', message, [
    { name: 'catalogo', value: '/api/catalog', description: 'Lista todos los endpoints disponibles con sus parámetros.' },
    { name: 'documentacion', value: '/', description: 'Interfaz web con catálogo, probador y ejemplos.' },
  ]));
}

/**
 * Manejador central de errores. Convierte cualquier excepción en la respuesta
 * JSON estándar y evita filtrar detalles internos en producción.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(error, req, res, next) {
  // Cuerpo demasiado grande (express.json / express.text).
  if (error && (error.type === 'entity.too.large' || error.status === 413)) {
    return sendError(res, new ApiError(413, 'PAYLOAD_TOO_LARGE', 'El cuerpo de la petición es demasiado grande.'));
  }
  // JSON malformado en el cuerpo: no es un error de validación de negocio.
  if (error && error.type === 'entity.parse.failed') {
    return sendError(
      res,
      new ApiError(
        400,
        'INVALID_JSON_BODY',
        'El cuerpo de la petición no es JSON válido. Envía Content-Type: application/json con un objeto correcto.',
        [{ name: 'detalle', value: error.message, description: 'Mensaje original del analizador de JSON.' }]
      )
    );
  }

  if (error instanceof ApiError || (error && error.expose)) {
    return sendError(res, {
      status: error.status || 500,
      code: error.code || 'ERROR',
      message: error.message,
      details: error.details,
      retryAfterSeconds: error.retryAfterSeconds,
    });
  }

  // Error inesperado: se registra completo en el servidor, pero sólo se
  // devuelve un mensaje genérico al cliente.
  // eslint-disable-next-line no-console
  console.error('[error no controlado]', req.method, req.originalUrl, error);

  return sendError(res, {
    status: 500,
    code: 'INTERNAL_ERROR',
    message: 'Error interno del servidor. El fallo quedó registrado en el registro del servidor.',
  });
}

module.exports = { notFoundHandler, errorHandler };
