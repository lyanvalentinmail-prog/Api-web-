'use strict';

/**
 * Pruebas de integración de la API. Se ejecutan con `npm test` (node:test).
 *
 * Levantan el servidor real en un puerto libre y hacen peticiones HTTP de
 * verdad. No se llama a ninguna API externa: los proxies de terceros se
 * comprueban sólo en cuanto a validación de parámetros y manejo de errores,
 * que es el comportamiento que este proyecto controla.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');

const createApp = require('../src/app');
const { endpoints } = require('../src/lib/catalog');

let server;
let base;

/** Límites muy altos para que las pruebas no choquen con el limitador. */
const TEST_CONFIG = {
  logRequests: false,
  rateLimits: {
    general: { windowMs: 60_000, max: 10_000 },
    external: { windowMs: 60_000, max: 10_000 },
    write: { windowMs: 60_000, max: 10_000 },
  },
  upstream: { timeoutMs: 3000, maxBytes: 200_000, binaryMaxBytes: 200_000 },
};

/** Petición de ayuda que devuelve estado, cabeceras y cuerpo ya analizado. */
async function call(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    headers: { accept: 'application/json', ...(options.body ? { 'content-type': 'application/json' } : {}) },
    ...options,
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  return { status: response.status, headers: response.headers, body, text };
}

test.before(async () => {
  const app = createApp(TEST_CONFIG);
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

/* ------------------------------------------------------------ sistema */

test('/api/health responde 200 con ok=true', async () => {
  const { status, body } = await call('/api/health');
  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.data.status, 'ok');
  assert.ok(body.data.uptimeSeconds >= 0);
  assert.ok(Array.isArray(body.data.checks) && body.data.checks.every((check) => check.ok));
  assert.ok(body.meta.requestId, 'Debe incluir un identificador de petición');
});

test('/api/info confirma que no se necesita registro, login ni API key', async () => {
  const { status, body } = await call('/api/info');
  assert.equal(status, 200);
  assert.equal(body.data.authentication.required, false);
  assert.equal(body.data.authentication.apiKey, false);
  assert.equal(body.data.authentication.signup, false);
  assert.equal(body.data.authentication.login, false);
  assert.ok(body.data.counts.ownEndpoints > 0);
  assert.ok(body.data.counts.externalEndpoints > 0);
  assert.equal(body.data.counts.totalEndpoints, endpoints.length);
});

test('/api/catalog devuelve el catálogo completo y admite filtros', async () => {
  const all = await call('/api/catalog');
  assert.equal(all.status, 200);
  assert.equal(all.body.data.count, endpoints.length);
  assert.ok(all.body.data.categories.length >= 8);

  const own = await call('/api/catalog?type=own&compact=true');
  assert.ok(own.body.data.endpoints.every((endpoint) => endpoint.type === 'own'));

  const texto = await call('/api/catalog?category=texto');
  assert.ok(texto.body.data.count >= 4);
  assert.ok(texto.body.data.endpoints.every((endpoint) => endpoint.category === 'texto'));

  const busqueda = await call('/api/catalog?search=reverse');
  assert.equal(busqueda.body.data.count, 1);
  assert.equal(busqueda.body.data.endpoints[0].id, 'text-reverse');

  const malo = await call('/api/catalog?category=inexistente');
  assert.equal(malo.status, 400);
  assert.equal(malo.body.error.code, 'INVALID_ENUM');
});

test('/api/openapi.json genera una especificación OpenAPI 3 válida y completa', async () => {
  const { status, body } = await call('/api/openapi.json');
  assert.equal(status, 200);
  assert.equal(body.openapi, '3.0.3');
  assert.ok(Object.keys(body.paths).length > 30, 'Debería documentar más de 30 rutas');
  assert.ok(body.paths['/api/health'].get);
  assert.ok(body.paths['/api/demo/tasks/{id}'].patch, 'Los parámetros de ruta se convierten a {param}');
  assert.ok(body.components.schemas.SuccessEnvelope && body.components.schemas.ErrorEnvelope);
});

test('/api/routes confirma que todas las rutas del catálogo están registradas', async () => {
  const { status, body } = await call('/api/routes');
  assert.equal(status, 200);
  assert.equal(body.data.count, endpoints.length);
  assert.ok(body.data.routes.every((route) => route.known), 'Todas las rutas deben existir en el router');
});

/* ------------------------------------------------- endpoints obligatorios */

test('los endpoints requeridos por el proyecto funcionan de verdad', async () => {
  const health = await call('/api/health');
  assert.equal(health.status, 200);

  const info = await call('/api/info');
  assert.equal(info.status, 200);

  const number = await call('/api/random/number?min=1&max=100');
  assert.equal(number.status, 200);
  assert.ok(number.body.data.value >= 1 && number.body.data.value <= 100);

  const deterministic = await call('/api/random/number?min=42&max=42');
  assert.equal(deterministic.body.data.value, 42, 'Un rango de un solo valor debe ser determinista');

  const uuid = await call('/api/random/uuid');
  assert.match(uuid.body.data.uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

  const time = await call('/api/time');
  assert.equal(time.status, 200);
  assert.ok(Math.abs(time.body.data.epochMs - Date.now()) < 5000);

  const reverse = await call('/api/text/reverse?text=hola');
  assert.equal(reverse.body.data.output, 'aloh');

  const uppercase = await call('/api/text/uppercase?text=hola');
  assert.equal(uppercase.body.data.output, 'HOLA');

  const add = await call('/api/math/add?a=5&b=3');
  assert.equal(add.body.data.result, 8);

  const multiply = await call('/api/math/multiply?a=5&b=3');
  assert.equal(multiply.body.data.result, 15);
});

test('POST /api/json/validate valida JSON y señala la posición del error', async () => {
  const valido = await call('/api/json/validate', { method: 'POST', body: JSON.stringify({ json: '{"name":"Ana","age":30}' }) });
  assert.equal(valido.status, 200);
  assert.equal(valido.body.data.valid, true);
  assert.equal(valido.body.data.type, 'object');
  assert.equal(valido.body.data.depth, 2);
  assert.deepEqual(valido.body.data.keys, ['name', 'age']);

  const invalido = await call('/api/json/validate', { method: 'POST', body: JSON.stringify({ json: '{"a":1,}' }) });
  assert.equal(invalido.status, 200, 'Un JSON inválido no es un error del endpoint: se informa en el cuerpo');
  assert.equal(invalido.body.data.valid, false);
  assert.equal(invalido.body.data.error.reason, 'Coma sobrante');
  assert.equal(typeof invalido.body.data.error.position, 'number');
  assert.ok(invalido.body.data.error.snippet.pointer.includes('^'));

  const textoPlano = await call('/api/json/validate', {
    method: 'POST',
    headers: { 'content-type': 'text/plain' },
    body: '[1, 2, 3]',
  });
  assert.equal(textoPlano.body.data.valid, true);
  assert.equal(textoPlano.body.data.type, 'array');
  assert.equal(textoPlano.body.data.arrayLength, 3);

  const vacio = await call('/api/json/validate', { method: 'POST' });
  assert.equal(vacio.status, 400);
  assert.equal(vacio.body.error.code, 'MISSING_PARAM');
});

test('PUT /api/json/validate también está disponible', async () => {
  const { status, body } = await call('/api/json/validate', { method: 'PUT', body: JSON.stringify({ json: '{"x": true}' }) });
  assert.equal(status, 200);
  assert.equal(body.data.valid, true);
});

test('/api/json/format indenta y minifica, y explica los errores de sintaxis', async () => {
  const pretty = await call(`/api/json/format?json=${encodeURIComponent('{"a":1,"b":[1,2]}')}`);
  assert.equal(pretty.status, 200);
  assert.equal(pretty.body.data.output, '{\n  "a": 1,\n  "b": [\n    1,\n    2\n  ]\n}');

  const minify = await call(`/api/json/format?json=${encodeURIComponent('{ "a": 1 }')}&mode=minify`);
  assert.equal(minify.body.data.output, '{"a":1}');

  const roto = await call(`/api/json/format?json=${encodeURIComponent('{"a": }')}`);
  assert.equal(roto.status, 422);
  assert.equal(roto.body.error.code, 'INVALID_JSON');
  assert.ok(roto.body.error.details.some((detail) => detail.name === 'linea'));
});

/* ----------------------------------------------------- validación y errores */

test('la validación de parámetros devuelve 400 con código y detalles', async () => {
  const noNumerico = await call('/api/math/add?a=abc&b=3');
  assert.equal(noNumerico.status, 400);
  assert.equal(noNumerico.body.error.code, 'INVALID_NUMBER');

  const falta = await call('/api/math/add?a=5');
  assert.equal(falta.status, 400);
  assert.equal(falta.body.error.code, 'MISSING_PARAM');

  const rango = await call('/api/random/number?min=10&max=1');
  assert.equal(rango.status, 400);
  assert.equal(rango.body.error.code, 'INVALID_RANGE');

  const demasiado = await call(`/api/text/reverse?text=${'a'.repeat(5001)}`);
  assert.equal(demasiado.status, 400);
  assert.equal(demasiado.body.error.code, 'TEXT_TOO_LONG');

  const lista = await call('/api/random/choice?items=a,b&count=5&unique=true');
  assert.equal(lista.status, 422);
  assert.equal(lista.body.error.code, 'UNIQUE_IMPOSSIBLE');
});

test('responde 404 con ayuda y 405 con los métodos permitidos', async () => {
  const noExiste = await call('/api/esta-ruta-no-existe');
  assert.equal(noExiste.status, 404);
  assert.equal(noExiste.body.error.code, 'NOT_FOUND');
  assert.ok(noExiste.body.error.details.some((detail) => detail.value === '/api/catalog'));

  const metodo = await call('/api/health', { method: 'POST' });
  assert.equal(metodo.status, 405);
  assert.equal(metodo.body.error.code, 'METHOD_NOT_ALLOWED');
  assert.match(metodo.body.error.message, /GET/);
});

test('el formato de todas las respuestas es uniforme (ok, data, meta)', async () => {
  const ok = await call('/api/time');
  assert.deepEqual(Object.keys(ok.body).sort(), ['data', 'meta', 'ok']);
  assert.ok(ok.body.meta.timestamp && ok.body.meta.durationMs >= 0);

  const error = await call('/api/math/add?a=1&b=x');
  assert.deepEqual(Object.keys(error.body).sort(), ['error', 'meta', 'ok']);
  assert.equal(error.body.ok, false);
  assert.ok(error.body.error.status === 400 && typeof error.body.error.message === 'string');
});

test('cada endpoint del catálogo responde (no hay rutas inventadas)', async () => {
  const base_ = base;
  for (const endpoint of endpoints) {
    // Se piden sólo los endpoints propios y de demostración: los externos
    // dependen de Internet y se validan aparte.
    if (endpoint.type === 'external') continue;

    // Identificadores altos para los recursos de demostración: se comprueba que
    // la ruta existe aunque el elemento no (404 de recurso, no de ruta).
    let path = endpoint.path;
    for (const param of endpoint.parameters.filter((item) => item.in === 'path')) {
      path = path.replace(`:${param.name}`, param.name === 'id' ? '999999' : encodeURIComponent(param.example ?? 'x'));
    }

    const method = endpoint.methods[0];
    const options = { method };
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      options.body = JSON.stringify(method === 'POST' && endpoint.id === 'demo-create' ? { title: 'tarea de prueba' } : {});
      options.headers = { 'content-type': 'application/json' };
    }

    const response = await fetch(`${base_}${path}`, { ...options, headers: { accept: 'application/json', ...(options.headers || {}) } });
    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }

    const code = body?.error?.code;
    assert.notEqual(code, 'NOT_FOUND', `${method} ${path} devolvió «ruta no encontrada» pero está en el catálogo`);
    assert.notEqual(response.status, 405, `${method} ${path} debería aceptar el método documentado`);
    assert.ok(response.status < 500, `${method} ${path} devolvió un error de servidor (${response.status})`);
  }

  // Limpieza: se restauran los datos del CRUD de ejemplo.
  await call('/api/demo/reset', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
});

/* --------------------------------------------------------------- CRUD demo */

test('el CRUD de ejemplo completa el ciclo crear, leer, reemplazar, actualizar y borrar', async () => {
  const creado = await call('/api/demo/tasks', {
    method: 'POST',
    body: JSON.stringify({ title: 'Tarea de prueba', description: 'Ciclo completo', priority: 'alta', tags: ['pruebas'] }),
  });
  assert.equal(creado.status, 201);
  assert.ok(creado.headers.get('location'), 'Debe devolver la cabecera Location');
  const id = creado.body.data.item.id;

  const leido = await call(`/api/demo/tasks/${id}`);
  assert.equal(leido.status, 200);
  assert.equal(leido.body.data.item.title, 'Tarea de prueba');

  const reemplazado = await call(`/api/demo/tasks/${id}`, { method: 'PUT', body: JSON.stringify({ title: 'Reemplazada', completed: true }) });
  assert.equal(reemplazado.status, 200);
  assert.equal(reemplazado.body.data.item.title, 'Reemplazada');
  assert.equal(reemplazado.body.data.item.completed, true);
  assert.equal(reemplazado.body.data.item.priority, 'media', 'PUT restablece los campos no enviados');

  const actualizado = await call(`/api/demo/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ priority: 'baja', desconocido: 1 }) });
  assert.equal(actualizado.status, 200);
  assert.deepEqual(actualizado.body.data.updatedFields, ['priority']);
  assert.equal(actualizado.body.data.item.priority, 'baja');
  assert.equal(actualizado.body.data.item.title, 'Reemplazada', 'PATCH conserva el resto de campos');

  const borrado = await call(`/api/demo/tasks/${id}`, { method: 'DELETE' });
  assert.equal(borrado.status, 200);
  assert.equal(borrado.body.data.deleted, true);

  const inexistente = await call(`/api/demo/tasks/${id}`);
  assert.equal(inexistente.status, 404);
  assert.equal(inexistente.body.error.code, 'ITEM_NOT_FOUND');

  const idInvalido = await call('/api/demo/tasks/no-es-un-numero');
  assert.equal(idInvalido.status, 400);
  assert.equal(idInvalido.body.error.code, 'INVALID_FORMAT');

  const sinCampos = await call('/api/demo/tasks/1', { method: 'PATCH', body: JSON.stringify({ otro: true }) });
  assert.equal(sinCampos.status, 422);
  assert.equal(sinCampos.body.error.code, 'NO_FIELDS');

  const validacion = await call('/api/demo/tasks', { method: 'POST', body: JSON.stringify({ title: 'x' }) });
  assert.equal(validacion.status, 422);
  assert.equal(validacion.body.error.code, 'VALIDATION_ERROR');
  assert.ok(validacion.body.error.details.some((detail) => detail.name === 'title'));

  const reinicio = await call('/api/demo/reset', { method: 'POST', body: '{}' });
  assert.equal(reinicio.status, 200);
  assert.equal(reinicio.body.data.items, 4);
});

test('el CRUD de ejemplo permite filtrar, ordenar y paginar', async () => {
  const pendientes = await call('/api/demo/tasks?completed=false&limit=2&sort=id&order=desc');
  assert.equal(pendientes.status, 200);
  assert.ok(pendientes.body.data.items.length <= 2);
  assert.ok(pendientes.body.data.items.every((item) => item.completed === false));
  assert.equal(pendientes.body.data.pagination.limit, 2);

  const busqueda = await call('/api/demo/tasks?search=catálogo');
  assert.ok(busqueda.body.data.items.length >= 1);
});

/* --------------------------------------------------------------- utilidades */

test('/api/util/hash coincide con el valor conocido y verifica hashes', async () => {
  const hash = await call('/api/util/hash?text=hola');
  assert.equal(hash.body.data.hash, 'b221d9dbb083a7f33428d7c2a3c3198ae925614d70210e28716ccaa7cd4ddb79');

  const verificado = await call(`/api/util/hash?text=hola&verify=${hash.body.data.hash}`);
  assert.equal(verificado.body.data.verified, true);

  const falso = await call('/api/util/hash?text=hola&verify=0000');
  assert.equal(falso.body.data.verified, false);
});

test('/api/util/base64 codifica y decodifica texto UTF-8, incluidos emojis', async () => {
  const codificado = await call('/api/util/base64?text=hola mundo');
  assert.equal(codificado.body.data.output, 'aG9sYSBtdW5kbw==');

  const decodificado = await call('/api/util/base64?text=aG9sYSBtdW5kbw%3D%3D&decode=true');
  assert.equal(decodificado.body.data.output, 'hola mundo');

  const emoji = await call('/api/util/base64?text=canción%20😀');
  const vuelta = await call(`/api/util/base64?text=${encodeURIComponent(emoji.body.data.output)}&decode=true`);
  assert.equal(vuelta.body.data.output, 'canción 😀');

  const invalido = await call('/api/util/base64?text=%%%no-es-base64&decode=true');
  assert.equal(invalido.status, 422);
  assert.equal(invalido.body.error.code, 'INVALID_BASE64');
});

test('/api/util/echo devuelve la petición y filtra cabeceras sensibles', async () => {
  const respuesta = await call('/api/util/echo?debug=1', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer secreto' },
    body: JSON.stringify({ mensaje: 'hola' }),
  });
  assert.equal(respuesta.status, 200);
  assert.equal(respuesta.body.data.method, 'POST');
  assert.deepEqual(respuesta.body.data.body, { mensaje: 'hola' });
  assert.equal(respuesta.body.data.query.debug, '1');
  assert.equal(respuesta.body.data.headers.authorization, undefined, 'No debe devolver la cabecera authorization');
  assert.equal(respuesta.body.data.headers.cookie, undefined);
});

test('/api/util/color genera colores en varios formatos y respeta el límite', async () => {
  const color = await call('/api/util/color');
  assert.match(color.body.data.colors[0].hex, /^#[0-9A-F]{6}$/);
  assert.ok(['black', 'white'].includes(color.body.data.colors[0].contrastTextColor));

  const varios = await call('/api/util/color?count=5');
  assert.equal(varios.body.data.colors.length, 5);

  const malo = await call('/api/util/color?count=99');
  assert.equal(malo.status, 400);
});

test('/api/util/validate-regex valida patrones y banderas', async () => {
  const valido = await call(`/api/util/validate-regex?pattern=${encodeURIComponent('^[a-z]+\\d{2}$')}&test=hola12`);
  assert.equal(valido.status, 200);
  assert.equal(valido.body.data.valid, true);
  assert.equal(valido.body.data.matchesSample.match, 'hola12');

  const roto = await call(`/api/util/validate-regex?pattern=${encodeURIComponent('[a-z')}`);
  assert.equal(roto.body.data.valid, false);
  assert.ok(roto.body.data.reason);

  const bandera = await call(`/api/util/validate-regex?pattern=a&flags=z`);
  assert.equal(bandera.status, 400);
  assert.equal(bandera.body.error.code, 'INVALID_FORMAT');
});

/* ------------------------------------------------------- texto, tiempo, etc. */

test('/api/text/stats y /api/text/count analizan el texto correctamente', async () => {
  const stats = await call('/api/text/stats?text=Hola mundo. Hola de nuevo, mundo.');
  assert.equal(stats.body.data.words, 6);
  assert.equal(stats.body.data.sentences, 2);
  assert.equal(stats.body.data.topWords[0].count, 2);

  const count = await call(`/api/text/count?text=${encodeURIComponent('El perro de San Roque no tiene rabo')}&search=roque`);
  assert.equal(count.body.data.count, 1);
  assert.equal(count.body.data.matches[0], 'Roque');

  const regex = await call(`/api/text/count?text=${encodeURIComponent('a1 b2 c3')}&search=${encodeURIComponent('[a-z]\\d')}&regex=true`);
  assert.equal(regex.body.data.count, 3);

  const slug = await call(`/api/text/slug?text=${encodeURIComponent('¡Hola Mundo! Acentos y Ñ')}`);
  assert.equal(slug.body.data.output, 'hola-mundo-acentos-y-n');
});

test('/api/time/world convierte a la zona indicada y rechaza zonas inexistentes', async () => {
  const madrid = await call('/api/time/world?timezone=Europe/Madrid');
  assert.equal(madrid.status, 200);
  assert.match(madrid.body.data.iso8601, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
  assert.match(madrid.body.data.offset, /^[+-]\d{2}:\d{2}$/);

  const bogota = await call('/api/time/world?timezone=America/Bogota');
  assert.equal(bogota.body.data.offset, '-05:00');

  const inexistente = await call('/api/time/world?timezone=Marte/Olympus');
  assert.equal(inexistente.status, 400);
  assert.equal(inexistente.body.error.code, 'INVALID_TIMEZONE');

  const lista = await call('/api/time/timezones?search=bogota');
  assert.ok(lista.body.data.timezones.includes('America/Bogota'));
});

test('/api/math/statistics calcula las medidas esperadas', async () => {
  const { status, body } = await call('/api/math/statistics?numbers=1,2,3,4,5');
  assert.equal(status, 200);
  assert.equal(body.data.sum, 15);
  assert.equal(body.data.mean, 3);
  assert.equal(body.data.median, 3);
  assert.deepEqual(body.data.quartiles, { q1: 2, q2: 3, q3: 4 });

  const moda = await call('/api/math/statistics?numbers=1,2,2,3');
  assert.deepEqual(moda.body.data.mode, [2]);

  const malo = await call('/api/math/statistics?numbers=1,2,x');
  assert.equal(malo.status, 400);
  assert.equal(malo.body.error.code, 'INVALID_NUMBER_LIST');
});

/* -------------------------------------------------------- externos y límites */

test('los proxies externos validan parámetros sin necesitar Internet', async () => {
  const ip = await call('/api/external/ip-geo?ip=no-es-una-ip');
  assert.equal(ip.status, 400);
  assert.equal(ip.body.error.code, 'INVALID_FORMAT');

  const coordenadas = await call('/api/external/weather?latitude=999&longitude=0');
  assert.equal(coordenadas.status, 400);
  assert.equal(coordenadas.body.error.code, 'INVALID_NUMBER');

  const raza = await call('/api/external/dogs/breed/RAZA-INVALIDA/random');
  assert.equal(raza.status, 400);
  assert.equal(raza.body.error.code, 'INVALID_FORMAT');

  const idioma = await call('/api/external/wikipedia/search?search=api&language=xx');
  assert.equal(idioma.status, 400);
  assert.equal(idioma.body.error.code, 'INVALID_ENUM');

  const data = await call('/api/external/qr?data=');
  assert.equal(data.status, 400);
  assert.equal(data.body.error.code, 'MISSING_PARAM');
});

test('un proveedor externo inaccesible devuelve 502/504 explicando el motivo', async () => {
  const { status, body } = await call('/api/external/catfact/fact');
  assert.ok([502, 504].includes(status), `Estado inesperado: ${status}`);
  assert.ok(['UPSTREAM_UNAVAILABLE', 'UPSTREAM_TIMEOUT'].includes(body.error.code));
  assert.ok(body.error.details.some((detail) => detail.name === 'proveedor'));
  assert.ok(body.error.details.some((detail) => detail.value === '/api/status'));
});

test('/api/status ejecuta las pruebas funcionales de la API propia', async () => {
  const { status, body } = await call('/api/status?scope=own');
  assert.equal(status, 200);
  assert.ok(body.data.own.selfTests.length >= 10, 'Debería haber al menos 10 pruebas propias');
  const fallidas = body.data.own.selfTests.filter((test_) => !test_.ok);
  assert.deepEqual(fallidas, [], `Pruebas fallidas: ${JSON.stringify(fallidas, null, 2)}`);
  assert.equal(body.data.summary.ownSelfTests.failed, 0);
  assert.equal(body.data.own.status, 'operational');
});

test('/api/status acepta el parámetro scope y valida su valor', async () => {
  const externo = await call('/api/status?scope=external');
  assert.equal(externo.status, 200);
  assert.equal(externo.body.data.own, undefined);
  assert.ok(Array.isArray(externo.body.data.external));

  const malo = await call('/api/status?scope=inventado');
  assert.equal(malo.status, 400);
  assert.equal(malo.body.error.code, 'INVALID_ENUM');
});

test('aplica el límite de peticiones y devuelve Retry-After', async () => {
  const app = createApp({ ...TEST_CONFIG, rateLimits: { ...TEST_CONFIG.rateLimits, general: { windowMs: 60_000, max: 3 } } });
  const limited = app.listen(0, '127.0.0.1');
  await once(limited, 'listening');
  const localBase = `http://127.0.0.1:${limited.address().port}`;

  const statuses = [];
  for (let i = 0; i < 4; i += 1) {
    const response = await fetch(`${localBase}/api/health`);
    statuses.push({ status: response.status, retryAfter: response.headers.get('retry-after') });
  }
  await new Promise((resolve) => limited.close(resolve));

  assert.deepEqual(statuses.slice(0, 3).map((item) => item.status), [200, 200, 200]);
  assert.equal(statuses[3].status, 429);
  assert.ok(Number(statuses[3].retryAfter) >= 1, 'Debe indicar cuándo reintentar');
});

test('CORS abierto: permite cualquier origen y responde al preflight', async () => {
  const simple = await fetch(`${base}/api/health`, { headers: { origin: 'https://ejemplo-ajeno.com' } });
  assert.equal(simple.headers.get('access-control-allow-origin'), '*');

  const preflight = await fetch(`${base}/api/math/add?a=1&b=2`, {
    method: 'OPTIONS',
    headers: { origin: 'https://ejemplo-ajeno.com', 'access-control-request-method': 'GET' },
  });
  assert.equal(preflight.status, 204);
  assert.match(preflight.headers.get('access-control-allow-methods'), /GET/);
});

test('el resumen en texto (/api.txt) y la ayuda raíz de la API están disponibles', async () => {
  const texto = await fetch(`${base}/api.txt`);
  assert.equal(texto.status, 200);
  assert.match(await texto.text(), /No hace falta registro, login ni API key/);

  const indice = await call('/api');
  assert.equal(indice.status, 200);
  assert.ok(indice.body.data.groups.length >= 8);

  const interfaz = await fetch(`${base}/`);
  assert.equal(interfaz.status, 200, 'La interfaz web debe servirse en la raíz');
  assert.match(interfaz.headers.get('content-type') || '', /text\/html/);
  const html = await interfaz.text();
  assert.match(html, /FreeAPI Hub/);
  assert.match(html, /<script src="\/js\/app\.js">/, 'La interfaz carga su JavaScript desde archivos propios');
});
