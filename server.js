'use strict';

/**
 * Arranque del servidor HTTP de FreeAPI Hub.
 *
 *   npm start          → http://localhost:3000
 *   PORT=8080 npm start
 *
 * La aplicación se puede desplegar en cualquier plataforma que ejecute Node.js
 * (Render, Railway, Fly.io, un VPS con pm2/Docker…). Ver el README.
 */
const createApp = require('./src/app');
const loadConfig = require('./src/config');
const { meta, getSummary } = require('./src/lib/catalog');

const config = loadConfig();
const app = createApp(config);

const server = app.listen(config.port, config.host, () => {
  const port = server.address().port;
  const summary = getSummary();
  const lines = [
    '',
    `  \u001b[1m\u001b[35m${meta.name}\u001b[0m v${meta.version} — ${meta.tagline}`,
    '',
    `  \u001b[32m▸\u001b[0m Interfaz web      http://localhost:${port}/`,
    `  \u001b[32m▸\u001b[0m Catálogo JSON    http://localhost:${port}/api/catalog`,
    `  \u001b[32m▸\u001b[0m Estado real      http://localhost:${port}/api/status`,
    `  \u001b[32m▸\u001b[0m OpenAPI 3        http://localhost:${port}/api/openapi.json`,
    '',
    `  ${summary.ownEndpoints + summary.demoEndpoints} endpoints propios + ${summary.externalEndpoints} de terceros (${summary.externalProviders} proveedores)`,
    `  Sin registro, sin login y sin API key.`,
    '',
    config.isProduction ? '  Entorno: producción' : '  Entorno: desarrollo (NODE_ENV=production para producción)',
    '',
  ];
  // eslint-disable-next-line no-console
  console.log(lines.join('\n'));
});

/** Cierre ordenado: deja de aceptar conexiones y termina las abiertas. */
function shutdown(signal) {
  // eslint-disable-next-line no-console
  console.log(`\n[freeapi-hub] recibida señal ${signal}: cerrando servidor…`);
  server.close(() => {
    // eslint-disable-next-line no-console
    console.log('[freeapi-hub] servidor cerrado.');
    process.exit(0);
  });
  // Si en 10 segundos no ha cerrado, se fuerza la salida.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  // eslint-disable-next-line no-console
  console.error('[freeapi-hub] promesa rechazada sin capturar:', reason);
});

module.exports = server;
