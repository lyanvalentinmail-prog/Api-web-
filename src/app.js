'use strict';

const express = require('express');
const loadConfig = require('./config');
const { setupMiddleware, PUBLIC_DIR } = require('./middleware/setup');
const { notFoundHandler, errorHandler } = require('./middleware/errors');
const apiRouter = require('./routes');
const { meta, getSummary } = require('./lib/catalog');

/**
 * Crea la aplicación Express completa (middleware + rutas + manejo de errores).
 * Se exporta como fábrica para poder inyectar configuración en las pruebas.
 * @param {object} [overrides] Sobrescritura parcial de la configuración
 * @returns {import('express').Express}
 */
function createApp(overrides = {}) {
  const config = { ...loadConfig(), ...overrides };
  const app = express();

  // Accesible desde cualquier middleware/handler como req.app.locals.config.
  app.locals.config = config;
  app.locals.publicDir = PUBLIC_DIR;

  setupMiddleware(app, config);

  app.use('/api', apiRouter);

  // Ejemplo de uso de la API en formato texto, útil desde la consola.
  app.get('/api.txt', (req, res) => {
    const summary = getSummary();
    res.type('text/plain; charset=utf-8').send(
      [
        `${meta.name} v${meta.version} — ${meta.tagline}`,
        '',
        `Endpoints propios: ${summary.ownEndpoints} | Demo CRUD: ${summary.demoEndpoints} | Externos: ${summary.externalEndpoints} | Categorías: ${summary.categories}`,
        '',
        'Ejemplos rápidos:',
        `  curl ${req.apiBaseUrl}/api/health`,
        `  curl "${req.apiBaseUrl}/api/math/add?a=5&b=3"`,
        `  curl "${req.apiBaseUrl}/api/random/uuid"`,
        `  curl "${req.apiBaseUrl}/api/text/reverse?text=hola"`,
        `  curl -X POST ${req.apiBaseUrl}/api/json/validate -H "Content-Type: application/json" -d '{"json":"{\\"a\\":1}"}'`,
        '',
        `Catálogo completo: ${req.apiBaseUrl}/api/catalog`,
        `Especificación OpenAPI: ${req.apiBaseUrl}/api/openapi.json`,
        '',
        'No hace falta registro, login ni API key.',
      ].join('\n')
    );
  });

  // 404/405 y errores, siempre en el mismo formato JSON.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
module.exports.createApp = createApp;
