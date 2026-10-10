'use strict';

/**
 * Arranque del servidor HTTP de FreeAPI Hub.
 *
 *   npm start          → http://localhost:3000
 *   PORT=8080 npm start
 *
 * Funciona igual en local, en Docker, en Render/Railway/Fly.io y en un VPS.
 * La aplicación también se puede desplegar en plataformas serverless (Vercel):
 * allí no se ejecuta este archivo, sino el adaptador `api/index.js`.
 *
 * El servidor sólo se levanta cuando este archivo es el punto de entrada
 * (`node server.js`). Si otro módulo lo importa (por ejemplo, un runtime
 * serverless que detecte el entrypoint de Express), se exporta la aplicación
 * sin abrir ningún puerto.
 */
const createApp = require('./src/app');
const loadConfig = require('./src/config');
const { meta, getSummary } = require('./src/lib/catalog');

const config = loadConfig();
const app = createApp(config);

/** Levanta el servidor y muestra el resumen de arranque. */
function start() {
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

  return server;
}

// Sólo se abre el puerto si se ejecuta directamente (npm start, pm2, docker…).
const server = require.main === module ? start() : null;

module.exports = app;
module.exports.app = app;
module.exports.start = start;
module.exports.server = server;
