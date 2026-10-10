'use strict';

/**
 * Adaptador para plataformas serverless (Vercel y similares).
 *
 * Vercel no ejecuta un servidor permanente: envuelve la aplicación Express en
 * una función por petición. Este archivo exporta la app ya configurada para
 * que el runtime la invoque como manejador `(req, res)`.
 *
 * El servidor permanente (npm start → server.js) sigue siendo la forma
 * recomendada de ejecutar el proyecto en Render, Railway, Fly.io, Docker o un
 * VPS. Ver la sección «Despliegue» del README.
 *
 * Nota: Vercel sirve los archivos de `public/` como contenido estático desde
 * su CDN; esta función atiende todo lo que empieza por /api.
 */
const createApp = require('../src/app');

module.exports = createApp();
