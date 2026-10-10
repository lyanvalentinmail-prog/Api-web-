'use strict';

/**
 * Pruebas del adaptador serverless (Vercel y similares).
 *
 * Comprueban que:
 *  - `server.js` exporta la aplicación y NO abre ningún puerto cuando se importa
 *    (necesario para los runtimes que detectan el entrypoint de Express).
 *  - `api/index.js` exporta un manejador `(req, res)` que responde de verdad.
 *  - El catálogo se lee desde disco aunque el directorio de trabajo sea otro
 *    (en Vercel las funciones se ejecutan fuera del directorio del proyecto).
 *  - La configuración detecta el entorno serverless y reduce la concurrencia
 *    del chequeo de estado.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { once } = require('node:events');
const path = require('node:path');

// Se simula el entorno de AWS Lambda, que es donde corren las funciones de Vercel.
process.env.AWS_LAMBDA_FUNCTION_NAME = 'freeapi-hub-test';

const root = path.join(__dirname, '..');

test('server.js exporta la app pero no abre puerto si lo importa otro módulo', () => {
  const imported = require(path.join(root, 'server.js'));
  assert.equal(typeof imported, 'function', 'Debe exportar la aplicación Express');
  assert.equal(typeof imported.listen, 'function');
  assert.equal(imported.server, null, 'No debe haberse abierto ningún puerto');
});

test('api/index.js exporta un manejador utilizable por el runtime serverless', () => {
  const handler = require(path.join(root, 'api', 'index.js'));
  assert.equal(typeof handler, 'function');
  assert.equal(typeof handler.use, 'function', 'Debe ser una aplicación Express completa');
});

test('el manejador serverless responde y lee el catálogo desde disco', async () => {
  const handler = require(path.join(root, 'api', 'index.js'));
  const server = createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    const health = await (await fetch(`${base}/api/health`)).json();
    assert.equal(health.ok, true);
    assert.equal(health.data.status, 'ok');

    // El catálogo son archivos JSON en shared/: deben incluirse en el despliegue.
    const catalog = await (await fetch(`${base}/api/catalog?compact=true`)).json();
    assert.equal(catalog.ok, true);
    assert.ok(catalog.data.count >= 50, `El catálogo debería tener ~53 endpoints y tiene ${catalog.data.count}`);

    const math = await (await fetch(`${base}/api/math/add?a=5&b=3`)).json();
    assert.equal(math.data.result, 8);

    const validation = await (
      await fetch(`${base}/api/json/validate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ json: '{"a":1,}' }),
      })
    ).json();
    assert.equal(validation.data.valid, false);
    assert.equal(validation.data.error.position, 7);

    const info = await (await fetch(`${base}/api/info`)).json();
    assert.equal(info.data.authentication.apiKey, false, 'El despliegue serverless tampoco exige clave');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('la configuración reconoce el entorno serverless', () => {
  const loadConfig = require(path.join(root, 'src', 'config.js'));

  const serverless = loadConfig({ ...process.env });
  assert.equal(serverless.serverless, true, 'Debería detectar AWS_LAMBDA_FUNCTION_NAME');
  assert.equal(serverless.statusCheckConcurrency, 4);

  const local = loadConfig({ NODE_ENV: 'development' });
  assert.equal(local.serverless, false);
  assert.equal(local.statusCheckConcurrency, 6);
  assert.equal(local.trustProxy, 0, 'En desarrollo no se confía en proxies por defecto');

  const production = loadConfig({ NODE_ENV: 'production' });
  assert.equal(production.trustProxy, 1, 'En producción se asume un proxy delante (Render, Vercel, Fly…)');
});
