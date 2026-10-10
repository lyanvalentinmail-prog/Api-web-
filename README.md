# FreeAPI Hub

**Plataforma de APIs públicas gratuitas: catálogo, probador de endpoints, documentación, ejemplos de código y página de estado — sin registro, sin login y sin API key.**

FreeAPI Hub es una aplicación real y ejecutable (no una maqueta): un servidor Node.js + Express con
endpoints propios que responden de verdad, una interfaz web oscura y responsive, y un proxy documentado
de solo lectura hacia APIs públicas de terceros que no piden clave.

- **Sin cuentas**: no hay registro, login, correo electrónico, cookies ni API key para los endpoints públicos.
- **Endpoints propios reales**: aleatorios con `crypto`, texto, JSON, matemáticas, tiempo (zonas IANA), utilidades y un CRUD de ejemplo completo (GET, POST, PUT, PATCH, DELETE).
- **APIs externas separadas y transparentes**: cada endpoint externo indica su proveedor, su host, sus límites y su documentación oficial.
- **Probador integrado**: elige endpoint y método, rellena parámetros y envía la petición desde el navegador viendo código HTTP, tiempo, encabezados y cuerpo.
- **Estado real**: `/api/status` ejecuta pruebas funcionales contra la propia API y consultas de verdad a cada proveedor externo.
- **Documentación viva**: el catálogo, la interfaz, la especificación OpenAPI y la página de estado se generan de la misma fuente de datos, así que nunca se desincronizan.

---

## 1. Requisitos

| Requisito | Versión | Notas |
| --- | --- | --- |
| Node.js | 18 o superior (probado en 22) | Necesario para `fetch` global, `crypto.randomUUID`, `Intl.supportedValuesOf` y `node:test`. |
| npm | 9 o superior | Una única dependencia de producción: `express`. |
| Base de datos | No hace falta | El CRUD de ejemplo vive en memoria (documentado). |
| Servicios de pago | No hacen falta | Nada del proyecto exige suscripción ni claves. |

## 2. Ejecución local

```bash
git clone https://github.com/lyanvalentinmail-prog/Api-web-.git
cd Api-web-
npm install
npm start
```

Salida esperada:

```
  FreeAPI Hub v1.0.0 — APIs públicas gratis, sin registro, sin login y sin API key

  ▸ Interfaz web      http://localhost:3000/
  ▸ Catálogo JSON     http://localhost:3000/api/catalog
  ▸ Estado real       http://localhost:3000/api/status
  ▸ OpenAPI 3         http://localhost:3000/api/openapi.json

  34 endpoints propios + 19 de terceros (16 proveedores)
  Sin registro, sin login y sin API key.
```

Comandos disponibles:

```bash
npm start            # arranca el servidor (puerto 3000 por defecto)
npm run dev          # arranca con recarga automática (node --watch)
npm test             # 36 pruebas automáticas (integración de la API + escáner de JSON)
npm run check        # comprobación rápida de sintaxis y carga de la app
npm run test:frontend  # revisión de la interfaz con jsdom (requiere: npm install --no-save jsdom)
PORT=8080 npm start  # puerto distinto
npm run start:env    # arranca leyendo variables de un archivo .env (Node 20.6+)
```

Las variables de entorno se pueden pasar directamente (`PORT=8080 npm start`), con un `.env`
(usa `npm run start:env` o `set -a && . ./.env && set +a && npm start`) o desde el panel de tu
plataforma de despliegue. Hay un `.env.example` con todas las opciones comentadas.

> **Importante (honestidad sobre el despliegue):** este repositorio **no está publicado en Internet**.
> Cuando ejecutas `npm start`, la web y la API funcionan **solo en tu equipo** (`http://localhost:3000`).
> Si quieres que sea accesible públicamente, despliégala siguiendo la sección 10.

## 3. Estructura del proyecto

```
Api-web-/
├── server.js                     # Arranque del servidor HTTP y cierre ordenado
├── src/
│   ├── app.js                    # Fábrica de la aplicación Express (rutas + middleware)
│   ├── config.js                 # Configuración por variables de entorno
│   ├── lib/
│   │   ├── catalog.js            # Carga y filtra el catálogo (fuente única de verdad)
│   │   ├── cache.js              # Caché en memoria con TTL
│   │   ├── errors.js             # ApiError y factorías de errores
│   │   ├── http-client.js        # Cliente HTTP con timeout y límite de tamaño
│   │   ├── json-scan.js          # Analizador de sintaxis JSON con posición exacta del error
│   │   ├── rate-limit.js         # Limitador de peticiones por IP
│   │   ├── respond.js            # Formato único de respuesta (éxito y error)
│   │   └── validate.js           # Validación y conversión de parámetros
│   ├── middleware/
│   │   ├── setup.js              # Seguridad, CORS, parsers, límites, estáticos
│   │   └── errors.js             # 404/405 y manejador central de errores
│   └── routes/                   # Un módulo por categoría del catálogo
│       ├── index.js  docs.js  status.js  random.js  time.js
│       ├── text.js   json.js  math.js    utils.js   demo.js  external.js
├── public/                       # Interfaz web (sin frameworks ni CDN)
│   ├── index.html
│   ├── css/styles.css            # Tema oscuro azul/violeta, responsive
│   └── js/{utils,examples,app}.js
├── shared/catalog/               # Definiciones de los 53 endpoints en JSON
│   ├── meta.json  categories.json
│   ├── endpoints.own.core.json   # Sistema, aleatorios y tiempo
│   ├── endpoints.own.tools.json  # Texto, JSON, matemáticas, utilidades y CRUD
│   └── endpoints.external.json   # 19 proxies de terceros (16 proveedores)
├── test/                         # Pruebas automáticas (node:test, sin dependencias)
├── dev/frontend-check.mjs        # Revisión de la interfaz con jsdom (opcional)
└── Dockerfile  render.yaml  Procfile  .dockerignore
```

## 4. Catálogo de endpoints

`GET /api/catalog` devuelve el catálogo completo en JSON (con parámetros, ejemplos y errores posibles).
Los endpoints se dividen en tres tipos, indicados en la propia respuesta y en la interfaz:

| Tipo | Qué significa |
| --- | --- |
| `own` | **Propio**: se ejecuta en este servidor. No depende de terceros y funciona sin Internet. |
| `demo` | **Demostración**: CRUD de ejemplo en memoria, se reinicia al reiniciar el servidor. |
| `external` | **Externo**: proxy de solo lectura hacia una API pública de terceros sin clave. Su disponibilidad depende del proveedor. |

### 4.1 Endpoints propios (27)

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/api/health` | Estado del servidor: uptime, memoria, versión de Node y comprobaciones internas. |
| GET | `/api/info` | Información pública: versión, recuentos, autenticación, CORS y límites de uso. |
| GET | `/api/catalog` | Catálogo completo con filtros (`type`, `category`, `method`, `search`, `compact`). |
| GET | `/api/openapi.json` | Especificación OpenAPI 3.0.3 generada desde el catálogo. |
| GET | `/api/status` | Estado real de los servicios (pruebas propias + proveedores externos). |
| GET | `/api/random/number` | Números aleatorios en un rango (`min`, `max`, `count`, `integer`) con `crypto`. |
| GET | `/api/random/uuid` | UUID v4 (`count`, `uppercase`) con `crypto.randomUUID`. |
| GET | `/api/random/string` | Cadenas aleatorias (`length`, `charset`, `count`) sin sesgo por módulo. |
| GET | `/api/random/choice` | Elección aleatoria de una lista (`items`, `count`, `unique`). |
| GET | `/api/time` | Fecha y hora UTC con epoch, semana ISO, día del año y año bisiesto. |
| GET | `/api/time/world` | Hora local en cualquier zona IANA (`timezone`), con desfase y horario de verano. |
| GET | `/api/time/timezones` | Más de 400 zonas horarias válidas, con búsqueda por texto. |
| GET | `/api/text/reverse` | Invierte el texto respetando Unicode y emojis (`text`). |
| GET | `/api/text/uppercase` | Mayúsculas, minúsculas o capitalización (`text`, `mode`). |
| GET | `/api/text/slug` | Convierte un texto en slug de URL (`text`, `separator`). |
| GET | `/api/text/stats` | Estadísticas: palabras, frases, líneas y palabras más repetidas (`text`, `top`, `stopwords`). |
| GET | `/api/text/count` | Cuenta apariciones de una subcadena o expresión regular (`text`, `search`, `regex`, `ignoreCase`). |
| POST, PUT | `/api/json/validate` | Valida JSON y señala línea, columna y fragmento del error. Nunca falla con 400 por JSON inválido. |
| GET, POST | `/api/json/format` | Formatea (`pretty`) o minifica (`minify`) un JSON y calcula el ahorro de bytes. |
| GET | `/api/math/add` | Suma `a + b`. |
| GET | `/api/math/multiply` | Multiplica `a × b`. |
| GET | `/api/math/statistics` | Media, mediana, moda, cuartiles, varianza y desviación típica de una lista. |
| GET, POST | `/api/util/base64` | Codifica o decodifica Base64 con soporte UTF-8 completo (`text`, `decode`, `urlSafe`). |
| GET, POST | `/api/util/hash` | SHA-256/SHA-512/SHA-1, con verificación de un hash existente (`verify`). |
| GET | `/api/util/color` | Colores aleatorios en HEX, RGB y HSL con contraste sugerido (`count`). |
| GET, POST, PUT, PATCH, DELETE | `/api/util/echo` | Devuelve método, cabeceras (sin credenciales), query y cuerpo recibidos. |
| GET | `/api/util/validate-regex` | Comprueba si una expresión regular es válida y la prueba contra un texto. |

### 4.2 CRUD de ejemplo (7)

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/api/demo/tasks` | Lista tareas con búsqueda, filtro `completed`, orden y paginación. |
| POST | `/api/demo/tasks` | Crea una tarea (201 + cabecera `Location`). |
| GET | `/api/demo/tasks/:id` | Obtiene una tarea (404 `ITEM_NOT_FOUND` si no existe). |
| PUT | `/api/demo/tasks/:id` | Reemplaza la tarea completa (los campos no enviados vuelven a su valor por defecto). |
| PATCH | `/api/demo/tasks/:id` | Modifica sólo los campos enviados. |
| DELETE | `/api/demo/tasks/:id` | Elimina la tarea y devuelve el recurso borrado. |
| POST | `/api/demo/reset` | Restaura las 4 tareas de ejemplo. |

> Los datos de este recurso **viven en memoria del proceso** (máximo 200 tareas) y se reinician al
> reiniciar el servidor. No hay base de datos ni servicio externo: es un recurso didáctico para
> practicar un CRUD REST completo sin montar nada.

### 4.3 APIs externas (19 endpoints, 16 proveedores)

Estos endpoints son un **proxy de solo lectura**. El servidor construye la URL a partir de una lista fija
de proveedores y de parámetros ya validados: **nunca acepta una URL del usuario** (no se puede usar como
proxy abierto). La respuesta original se conserva en `data.raw`.

| Proveedor | Endpoint de FreeAPI Hub | Host consultado | Límites documentados por el proveedor |
| --- | --- | --- | --- |
| Cat Fact Ninja | `/api/external/catfact/fact`, `/api/external/catfact/facts` | `catfact.ninja` | Sin clave; ~100 peticiones/hora. Caché de 60-120 s. |
| Dog CEO | `/api/external/dogs/random`, `/api/external/dogs/breed/:breed/random` | `dog.ceo` | Sin clave; uso razonable. Caché de 15 s. |
| ipify | `/api/external/ip` | `api.ipify.org` | Sin clave; devuelve la IP del **servidor**. Caché de 300 s. |
| ipwho.is | `/api/external/ip-geo` | `ipwho.is` | Gratis ~10.000 consultas/mes. Caché de 300 s. |
| Open-Meteo | `/api/external/weather`, `/api/external/geocode` | `api.open-meteo.com`, `geocoding-api.open-meteo.com` | Gratis y sin clave para uso **no comercial**; uso comercial requiere plan de pago del proveedor. Licencia CC BY 4.0. |
| Rest Countries | `/api/external/countries`, `/api/external/countries/:code` | `restcountries.com` | Sin clave; uso moderado. Caché de 1 hora. |
| Genderize.io | `/api/external/genderize` | `api.genderize.io` | Gratis 100 peticiones/día y 1.000/mes por IP. Estimación estadística. |
| Nationalize.io | `/api/external/nationalize` | `api.nationalize.io` | Gratis 100 peticiones/día y 1.000/mes por IP. Estimación estadística. |
| Agify.io | `/api/external/agify` | `api.agify.io` | Gratis 100 peticiones/día y 1.000/mes por IP. Predicción estadística. |
| goQR.me | `/api/external/qr` | `api.qrserver.com` | Servicio gratuito sin clave; devuelve PNG en Base64 + data URL. |
| Random User Generator | `/api/external/users/random` | `randomuser.me` | Gratis; pide no superar ~1 petición/segundo. Datos **ficticios**. |
| icanhazdadjoke | `/api/external/jokes/random` | `icanhazdadjoke.com` | Gratis; el proveedor pide mantener su atribución. Contenido en inglés. |
| Gutendex (Project Gutenberg) | `/api/external/books` | `gutendex.com` | Gratis y sin clave; metadatos de libros de dominio público. |
| Wikimedia | `/api/external/wikipedia/search` | `*.wikipedia.org` | API oficial gratuita; contenido CC BY-SA. |
| CoinGecko | `/api/external/crypto/price` | `api.coingecko.com` | Endpoint público sin clave con cuota baja (~5-30 peticiones/minuto). Datos informativos, no asesoramiento financiero. |

**Aviso claro**: los endpoints externos **no los mantiene este proyecto**. Si un proveedor cambia, limita
el acceso o está caído, verás un error **502/504 explicando el motivo** (nunca datos inventados), y la
página de estado lo reflejará. Si el servidor no tiene salida a Internet (por ejemplo en un entorno con
firewall o en un contenedor sin red), todos aparecerán como *caídos* mientras los endpoints propios
siguen funcionando con normalidad.

## 5. Formato de las respuestas

Todas las respuestas (propias y externas) usan el mismo sobre JSON:

**Éxito**

```json
{
  "ok": true,
  "data": { "…": "contenido específico del endpoint" },
  "meta": {
    "endpoint": "/api/math/add",
    "method": "GET",
    "durationMs": 1,
    "timestamp": "2026-10-10T21:58:00.123Z",
    "requestId": "3f9c1b7e-2a4d-4c8f-9e0a-6b5d2f1a8c33"
  }
}
```

**Error**

```json
{
  "ok": false,
  "error": {
    "code": "INVALID_NUMBER",
    "message": "El parámetro \"a\" debe ser un número válido. Valor recibido: \"abc\".",
    "status": 400,
    "details": [ { "name": "a", "value": "abc", "description": "…" } ]
  },
  "meta": { "endpoint": "/api/math/add", "method": "GET", "durationMs": 1, "requestId": "…" }
}
```

### Códigos HTTP y de error más habituales

| HTTP | `error.code` | Cuándo ocurre |
| --- | --- | --- |
| 400 | `MISSING_PARAM`, `INVALID_NUMBER`, `INVALID_INTEGER`, `INVALID_ENUM`, `INVALID_FORMAT`, `INVALID_RANGE`, `INVALID_TIMEZONE`, `INVALID_REGEX`, `TEXT_TOO_LONG` | Parámetros ausentes o mal formados. |
| 404 | `NOT_FOUND`, `ITEM_NOT_FOUND`, `UPSTREAM_NOT_FOUND` | Ruta inexistente, recurso inexistente o proveedor sin datos. |
| 405 | `METHOD_NOT_ALLOWED` | La ruta existe pero no admite ese método (la respuesta indica los permitidos). |
| 409 | `LIMIT_REACHED` | Se superó el máximo de tareas del CRUD de ejemplo. |
| 413 | `PAYLOAD_TOO_LARGE` | Cuerpo o JSON mayor de lo permitido (256 KB de cuerpo, 100 KB de JSON). |
| 422 | `VALIDATION_ERROR`, `NO_FIELDS`, `INVALID_JSON`, `INVALID_BASE64`, `UNIQUE_IMPOSSIBLE` | El formato es correcto pero el contenido no cumple las reglas. |
| 429 | `RATE_LIMIT_EXCEEDED` | Se superó el límite de peticiones; incluye `Retry-After` y cabeceras `X-RateLimit-*`. |
| 502 | `UPSTREAM_UNAVAILABLE` | El proveedor externo no respondió o rechazó la petición. |
| 504 | `UPSTREAM_TIMEOUT` | El proveedor externo superó el timeout (8 s por defecto). |

## 6. Ejemplos de solicitudes y respuestas

Ejemplos reales y verificados por las pruebas automáticas (`npm test`).

### 6.1 `/api/health`

```bash
curl "http://localhost:3000/api/health"
```

```json
{
  "ok": true,
  "data": {
    "status": "ok",
    "uptimeSeconds": 12.34,
    "startedAt": "2026-10-10T21:57:41.011Z",
    "node": "v22.22.3",
    "pid": 2171,
    "platform": "linux",
    "memory": { "rssMb": 62.4, "heapUsedMb": 8.8 },
    "checks": [
      { "name": "catalogo-cargado", "ok": true, "durationMs": 0 },
      { "name": "rutas-registradas", "ok": true, "durationMs": 0 },
      { "name": "sistema-operativo", "ok": true, "durationMs": 0 }
    ],
    "environment": "development"
  },
  "meta": { "endpoint": "/api/health", "method": "GET", "durationMs": 1, "timestamp": "…", "requestId": "…" }
}
```

### 6.2 `/api/info`

```bash
curl "http://localhost:3000/api/info"
```

```json
{
  "ok": true,
  "data": {
    "name": "FreeAPI Hub",
    "version": "1.0.0",
    "authentication": { "required": false, "apiKey": false, "signup": false, "login": false },
    "counts": { "ownEndpoints": 27, "demoEndpoints": 7, "externalEndpoints": 19, "totalEndpoints": 53, "categories": 9, "externalProviders": 16 },
    "rateLimits": { "general": "120 peticiones por minuto y por IP sobre /api/*" },
    "license": "MIT"
  }
}
```

### 6.3 `/api/random/number`

```bash
curl "http://localhost:3000/api/random/number?min=1&max=100&count=3"
```

```json
{
  "ok": true,
  "data": {
    "min": 1, "max": 100, "integer": true, "count": 3,
    "values": [57, 3, 88],
    "algorithm": "crypto.randomInt (uniforme, sin sesgo)"
  }
}
```

### 6.4 `/api/random/uuid`

```bash
curl "http://localhost:3000/api/random/uuid?count=2"
```

```json
{ "ok": true, "data": { "version": "v4", "count": 2, "uppercase": false, "uuids": ["ff6ab9a6-63b0-45cf-90d9-8c1f2602737e", "1d0e7c2b-3a44-4f19-8b02-77ac31de90b5"] } }
```

### 6.5 `/api/time`

```bash
curl "http://localhost:3000/api/time"
```

```json
{
  "ok": true,
  "data": {
    "utc": "2026-10-10T21:58:12.345Z",
    "epochMs": 1791669492345,
    "epochSeconds": 1791669492,
    "date": "2026-10-10",
    "time": "21:58:12",
    "timezone": "UTC",
    "dayOfWeek": "sábado",
    "dayOfYear": 283,
    "isoWeek": 41,
    "isLeapYear": false
  }
}
```

### 6.6 `/api/text/reverse?text=hola`

```bash
curl "http://localhost:3000/api/text/reverse?text=hola"
```

```json
{ "ok": true, "data": { "input": "hola", "output": "aloh", "inputLength": 4, "outputLength": 4, "algorithm": "code-point-reverse (seguro para Unicode y emojis)" } }
```

### 6.7 `/api/text/uppercase?text=hola`

```bash
curl "http://localhost:3000/api/text/uppercase?text=hola"
```

```json
{ "ok": true, "data": { "input": "hola", "output": "HOLA", "mode": "upper", "changed": true, "locale": "es-ES" } }
```

### 6.8 `/api/json/validate` (POST)

```bash
curl -X POST "http://localhost:3000/api/json/validate" \
  -H "Content-Type: application/json" \
  -d '{"json":"{\"name\":\"Ana\",\"age\":30}"}'
```

```json
{
  "ok": true,
  "data": {
    "valid": true,
    "source": "cuerpo JSON con la propiedad \"json\"",
    "inputLength": 23,
    "type": "object",
    "depth": 2,
    "keys": ["name", "age"],
    "value": { "name": "Ana", "age": 30 }
  }
}
```

Con un JSON roto (`{"json":"{\"a\":1,}"}`) la respuesta sigue siendo **200** (es un validador, no un error de la API):

```json
{
  "ok": true,
  "data": {
    "valid": false,
    "error": {
      "reason": "Coma sobrante",
      "message": "Coma sobrante: hay una coma antes de cerrar el objeto",
      "hint": "No puede haber una coma justo antes de cerrar un objeto o un array: JSON no admite comas finales.",
      "position": 7,
      "line": 1,
      "column": 8,
      "snippet": { "line": "{\"a\":1,}", "pointer": "       ^", "lineNumber": 1, "columnNumber": 8 },
      "nativeMessage": "Expected double-quoted property name in JSON at position 7 (line 1 column 8)"
    }
  }
}
```

También acepta `Content-Type: text/plain` con el JSON en crudo, o `?json=…` en la URL.

### 6.9 `/api/math/add?a=5&b=3`

```bash
curl "http://localhost:3000/api/math/add?a=5&b=3"
```

```json
{ "ok": true, "data": { "a": 5, "b": 3, "operation": "addition", "result": 8, "expression": "5 + 3 = 8" } }
```

### 6.10 `/api/math/multiply?a=5&b=3`

```bash
curl "http://localhost:3000/api/math/multiply?a=5&b=3"
```

```json
{ "ok": true, "data": { "a": 5, "b": 3, "operation": "multiplication", "result": 15, "expression": "5 × 3 = 15" } }
```

### 6.11 Error de validación (ejemplo de 400)

```bash
curl -i "http://localhost:3000/api/math/add?a=abc&b=3"
```

```json
{
  "ok": false,
  "error": { "code": "INVALID_NUMBER", "message": "El parámetro \"a\" debe ser un número válido. Valor recibido: \"abc\".", "status": 400 },
  "meta": { "endpoint": "/api/math/add", "method": "GET", "durationMs": 2, "requestId": "…" }
}
```

### 6.12 Método no permitido (405) y ruta inexistente (404)

```bash
curl -i -X POST "http://localhost:3000/api/health"
# 405 → {"ok":false,"error":{"code":"METHOD_NOT_ALLOWED","message":"El método POST no está permitido en /api/health. Métodos permitidos: GET.","status":405}}

curl -i "http://localhost:3000/api/no-existe"
# 404 → {"ok":false,"error":{"code":"NOT_FOUND","message":"No existe el endpoint /api/no-existe. …","status":404}}
```

### 6.13 CRUD de ejemplo completo

```bash
# Crear
curl -X POST "http://localhost:3000/api/demo/tasks" \
  -H "Content-Type: application/json" \
  -d '{"title":"Mi tarea","priority":"alta","tags":["api","demo"]}'
# → 201 {"ok":true,"data":{"item":{"id":5,"title":"Mi tarea",…},"location":"/api/demo/tasks/5","totalItems":5}}

# Leer, modificar y borrar (sustituye 5 por el id real)
curl "http://localhost:3000/api/demo/tasks/5"
curl -X PATCH "http://localhost:3000/api/demo/tasks/5" -H "Content-Type: application/json" -d '{"completed":true}'
curl -X DELETE "http://localhost:3000/api/demo/tasks/5"

# Restaurar el estado inicial
curl -X POST "http://localhost:3000/api/demo/reset"
```

### 6.14 Ejemplos en JavaScript, Python y cURL

```javascript
// JavaScript (navegador o Node 18+)
const response = await fetch('http://localhost:3000/api/text/reverse?text=hola');
console.log(response.status);        // 200
console.log(await response.json());  // { ok: true, data: { output: 'aloh', … } }
```

```python
# Python 3 (pip install requests)
import requests

response = requests.get('http://localhost:3000/api/text/reverse', params={'text': 'hola'}, timeout=10)
response.raise_for_status()
print(response.json()['data']['output'])   # aloh
```

```bash
# cURL
curl "http://localhost:3000/api/text/reverse?text=hola"
```

```javascript
// Node.js con la misma API (fetch nativo)
const res = await fetch('http://localhost:3000/api/json/format', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ json: '{"a":1,"b":[1,2]}', mode: 'pretty' }),
});
console.log(await res.json());
```

La interfaz web genera estos fragmentos automáticamente para **cada** endpoint, con los valores que
escribas en el probador (JavaScript fetch, Python requests, cURL y Node.js).

## 7. Interfaz web (probador incluido)

Abrir `http://localhost:3000/` (cuando despliegues, la URL de tu dominio). Incluye:

1. **Hero con datos reales**: recuento de endpoints leídos de `/api/info` (nada de cifras escritas a mano).
2. **Catálogo** con búsqueda por nombre/ruta/etiquetas y filtros por categoría, tipo y método HTTP. Cada tarjeta muestra el método, el tipo (propia/demo/externa) y botones para probar, documentar y copiar la URL.
3. **Probador**: selector de endpoint agrupado por categoría, botones de método (solo los admitidos), formulario de parámetros generado desde el catálogo (con botones «usar ejemplo»), previsualización de la URL final, cuerpo JSON editable y envío real de la petición.
4. **Panel de respuesta**: código HTTP con color, tiempo (servidor y total medido en el navegador), tamaño, pestañas de **cuerpo** con resaltado de sintaxis, **encabezados** en tabla y **ejemplos de código**; botones para copiar la respuesta, descargarla como `.json` y copiar los encabezados. Si la respuesta es una imagen (código QR, foto de perro, avatar ficticio) se muestra directamente.
5. **Historial de la sesión** con las últimas 12 peticiones y un botón para repetirlas.
6. **Documentación** del endpoint seleccionado: descripción, tabla de parámetros, ejemplo de respuesta, campos destacados, errores posibles y ejemplos de código; avisos específicos para los endpoints externos (límites del proveedor) y para el CRUD de ejemplo (datos en memoria).
7. **Estado** con comprobaciones reales (se ejecuta al llegar a la sección o al pulsar «Comprobar ahora», con opción de forzar saltándose la caché).
8. **Ejemplos rápidos** con los 10 endpoints más útiles en formato cURL listo para copiar.

Detalles técnicos de la interfaz: sin frameworks ni CDN (todo se sirve desde el propio servidor), con
`Content-Security-Policy` que solo permite scripts propios, navegación por teclado, etiquetas ARIA,
`prefers-reduced-motion` respetado y diseño responsive para móvil, tablet y escritorio.

## 8. Página de estado (`/api/status`)

```bash
curl "http://localhost:3000/api/status"                 # informe completo
curl "http://localhost:3000/api/status?scope=own"       # sólo la API propia
curl "http://localhost:3000/api/status?scope=external"  # sólo los proveedores externos
curl "http://localhost:3000/api/status?refresh=true"    # ignora la caché de 45 s
```

Cómo funciona, sin trampas:

- **API propia**: se ejecutan 13 **pruebas funcionales reales** contra el propio servidor por HTTP en
  bucle local (`127.0.0.1`), comprobando valores esperados: que `5 + 3 = 8`, que un rango cerrado devuelve
  el único valor posible, que el UUID cumple el formato v4, que el hash SHA-256 coincide con el valor
  conocido, que el validador de JSON detecta errores, que la validación devuelve 400, y que el **CRUD
  completo** (crear → leer → modificar → borrar) funciona y limpia lo que crea.
- **Proveedores externos**: una consulta real a cada host (con límite de concurrencia, timeout de 8 s y
  resultado en caché 45 s para no agotar sus cuotas). Cada fila muestra el host, el código HTTP, el tiempo
  de respuesta, los límites publicados por el proveedor y su documentación oficial.
- Si **todos** los proveedores externos fallan, la respuesta incluye `networkHint` avisando de que
  probablemente el servidor no tiene salida a Internet: es un diagnóstico, no una invención de datos.

## 9. Límites de uso, validación y seguridad

**Límites por IP** (configurables, ver sección 10):

| Ámbito | Valor por defecto | Variable de entorno |
| --- | --- | --- |
| `/api/*` | 120 peticiones/minuto | `RATE_LIMIT_GENERAL_MAX`, `RATE_LIMIT_GENERAL_WINDOW_MS` |
| `/api/external/*` | 30 peticiones/minuto | `RATE_LIMIT_EXTERNAL_MAX`, `RATE_LIMIT_EXTERNAL_WINDOW_MS` |
| POST, PUT, PATCH, DELETE | 20 peticiones/minuto | `RATE_LIMIT_WRITE_MAX`, `RATE_LIMIT_WRITE_WINDOW_MS` |

Al superarlos se responde **429** con `Retry-After` y cabeceras `X-RateLimit-Limit`, `X-RateLimit-Remaining`
y `X-RateLimit-Reset`. Además, cada proveedor externo impone su propia cuota (sección 4.3) y el servidor
cachea sus respuestas para no agotarla.

**Validación y límites de tamaño**: cada parámetro se valida por tipo, rango y formato antes de usarse
(números finitos, listas de máximo 50 elementos, textos de 5.000 caracteres, expresiones regulares de 200,
cuerpo HTTP de 256 KB, JSON de 100 KB, respuestas externas de 1 MB o 512 KB si son binarias).

**Seguridad**:

- **Sin secretos en el frontend**: no hay claves ni tokens en ninguna parte del proyecto. No se necesita ninguna.
- **Sin datos personales**: no hay cuentas, ni cookies, ni `localStorage` con datos de usuario. La IP se usa
  únicamente para el limitador de peticiones y no se guarda en disco.
- **CORS explícito**: la API es pública, sin credenciales ni cookies, por lo que se permite `*` (configurable
  con `CORS_ORIGINS`). No se envían cabeceras de credenciales.
- **Anti-SSRF**: las URLs de los proxies externos se construyen siempre desde una lista fija de proveedores
  + parámetros validados; es imposible que un usuario haga que el servidor llame a una URL arbitraria.
- **Cabeceras de seguridad**: `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy` y `Strict-Transport-Security` cuando hay HTTPS delante.
- **Errores seguros**: los detalles internos de una excepción no se devuelven al cliente (solo se registran
  en el servidor); el eco de la petición elimina `authorization`, `cookie`, `set-cookie`, `x-api-key`, etc.

## 10. Despliegue

Variables de entorno disponibles (todas opcionales, con valores por defecto sensatos):

| Variable | Por defecto | Para qué sirve |
| --- | --- | --- |
| `PORT` | `3000` | Puerto HTTP (la mayoría de plataformas lo inyectan). |
| `HOST` | `0.0.0.0` | Interfaz de escucha. |
| `NODE_ENV` | `development` | Con `production` activa caché de estáticos y HSTS. |
| `TRUST_PROXY` | `0` | Número de proxies de confianza (necesario para que el limitador vea la IP real detrás de un proxy). |
| `CORS_ORIGINS` | `*` | Lista separada por comas para restringir orígenes. |
| `LOG_REQUESTS` | `true` | Registro de cada petición en consola. |
| `STATUS_CACHE_TTL_MS` | `45000` | Duración de la caché del informe de estado. |
| `UPSTREAM_TIMEOUT_MS` | `8000` | Timeout de las llamadas a proveedores externos. |
| `UPSTREAM_MAX_BYTES` | `1000000` | Tamaño máximo de respuesta externa (texto/JSON). |
| `UPSTREAM_BINARY_MAX_BYTES` | `512000` | Tamaño máximo de respuesta externa binaria (imágenes). |
| `BODY_LIMIT` | `256kb` | Tamaño máximo del cuerpo de las peticiones. |

### 10.1 Docker

```bash
docker build -t freeapi-hub .
docker run --rm -p 3000:3000 -e NODE_ENV=production freeapi-hub
# Abrir http://localhost:3000
```

### 10.2 Render (plan gratuito)

1. Sube el repositorio a GitHub y en Render elige **New → Web Service**.
2. Build Command: `npm ci` · Start Command: `npm start` · Health Check Path: `/api/health`.
3. Añade las variables `NODE_ENV=production` y `TRUST_PROXY=1` (Render pone un proxy delante).
4. El repositorio incluye `render.yaml` (Blueprint), así que también puedes usar **New → Blueprint**.

### 10.3 Railway / Heroku-like

El proyecto incluye `Procfile` con `web: node server.js`. En Railway: **New Project → Deploy from GitHub**;
añade `NODE_ENV=production` y `TRUST_PROXY=1`. Railway inyecta `PORT` automáticamente.

### 10.4 Fly.io

```bash
fly launch --no-deploy      # detecta el Dockerfile
fly deploy
fly secrets set NODE_ENV=production TRUST_PROXY=1
```

### 10.5 VPS propio (systemd o pm2)

```bash
git clone https://github.com/lyanvalentinmail-prog/Api-web-.git /opt/freeapi-hub
cd /opt/freeapi-hub && npm ci --omit=dev
NODE_ENV=production TRUST_PROXY=1 PORT=3000 pm2 start server.js --name freeapi-hub
pm2 save && pm2 startup
```

Detrás de Nginx/Caddy, recuerda el proxy inverso y `TRUST_PROXY=1` para que el limitador vea la IP real.
No hace falta ninguna base de datos ni servicio de pago.

> **Escalado horizontal**: el limitador de peticiones y la caché viven en memoria del proceso. Con varias
> instancias, cada una aplica su propia cuota (el comportamiento es correcto, sólo menos estricto). Para
> algo más estricto, sustituye `src/lib/rate-limit.js` por un almacén compartido (Redis) o activa un
> limitador en el proxy/CDN.

## 11. Pruebas

```bash
npm test
```

36 pruebas automáticas con el runner integrado de Node (sin dependencias de test):

- **Integración HTTP** (`test/api.test.js`): levanta el servidor real en un puerto libre y comprueba health,
  info, catálogo y sus filtros, OpenAPI, los 10 endpoints obligatorios, la validación de JSON (válido,
  inválido y texto plano), el formato de éxito/error, 404/405, el ciclo CRUD completo, hash/base64/echo/color,
  estadísticas, zonas horarias, los proxies externos (validación y 502 sin Internet), `/api/status` con sus
  13 pruebas funcionales, el limitador de peticiones y CORS.
- **Consistencia del catálogo**: recorre **todos** los endpoints del catálogo y comprueba que cada ruta
  existe de verdad y acepta el método documentado (así no puede haber endpoints inventados).
- **Escáner de JSON** (`test/json-scan.test.js`): verifica que su veredicto coincide con `JSON.parse` en una
  muestra amplia y que localiza línea, columna y fragmento.

Revisión opcional de la interfaz en un DOM real (jsdom):

```bash
npm install --no-save jsdom   # dependencia solo para desarrollo, no se instala en producción
npm start                     # en otra terminal
npm run test:frontend
```

Comprueba catálogo, filtros, probador con peticiones reales, panel de respuesta, documentación, página de
estado y accesibilidad, y falla si aparece cualquier error de consola.

## 12. Limitaciones conocidas (sin adornos)

- **Los endpoints externos no son míos**: si un proveedor cambia, limita o cae, verás un 502/504 explicado y
  el estado en rojo. Nunca se devuelven datos falsos para simular éxito.
- **Sin red no hay externos**: en un entorno sin salida a Internet (contenedor aislado, red corporativa),
  los 19 endpoints externos devuelven 502 y `/api/status` lo explica con `networkHint`. Los 34 propios
  siguen funcionando.
- **El CRUD de ejemplo no persiste**: vive en memoria, con un tope de 200 tareas y reinicio al reiniciar el
  servidor. Es intencional: no hay base de datos ni nada que configurar.
- **Las cuotas de los proveedores externos son las suyas**: Genderize/Nationalize/Agify limitan a 100
  peticiones al día por IP gratis; CoinGecko tiene una cuota baja; Open-Meteo pide uso no comercial. La
  caché reduce el consumo, pero no lo elimina.
- **Estado en caché**: `/api/status` reutiliza el informe 45 segundos (configurable) para no abusar de los
  proveedores; usa `?refresh=true` para forzar una comprobación completa.
- **Este repositorio no está desplegado**: no hay ninguna URL pública asociada. El servicio corre donde tú
  lo ejecutes.

## 13. Licencia

MIT. Puedes usar, copiar, modificar y desplegar este proyecto libremente.

Los datos obtenidos de las APIs externas pertenecen a sus proveedores y están sujetos a sus propias
licencias y condiciones (por ejemplo, Open-Meteo publica sus datos bajo CC BY 4.0 y Wikimedia bajo CC BY-SA):
revisa cada una antes de reutilizar esos datos.
