# API Console (Español) — REST API pública sin clave

Clon en español de la SIPUTZX API Console V2: una plataforma Node.js + Express
con **184 endpoints** organizados en 16 categorías y un **Playground**
(`/playground`) para ejecutarlos en vivo con snippets de `cURL`, `fetch` y
`Python` (las imágenes se previsualizan mientras escribes).

Sin registro, sin clave API, CORS abierto. Algunos endpoints funcionan con datos
reales (GitHub, código abierto) y otros devuelven demostraciones deterministas
en español (IA, descargas, stalker, noticias, juegos…), pero **todos responden
con JSON o imagen válida** y sin inventar datos falsos sin aclararlo.

---

## Categorías

| Categoría | Endpoints | Descripción |
|---|---|---|
| **IA** | 12 | Chat con DuckAI, GPT OSS, DeepSeek R1, Gemini, Meta AI, Phi-2, QwQ, GLM, Bible/Gita y generador de imágenes (demo). |
| **ANIME** | 5 | Frases, búsqueda, calendario y detalle de animes populares. |
| **NOTICIAS** | 10 | Titulares recientes en español (fuentes demo). |
| **CANVAS** | 19 | Canvas «Sakura Night» (welcome, goodbye, level up ×2, ship, gay) en JPG/PNG/SVG + tarjetas SVG: bienvenida, despedida, perfil, tweet, certificado, cita, código, IQ, captcha, level-up, seguridad, spotify, delete. |
| **DESCARGAS** | 21 | Metadatos de descarga para 20 plataformas (CapCut, TikTok, Spotify, Twitter, FB…) más GitHub real. |
| **JUEGOS** | 27 | Trivias, acertijos, adivinanzas, matemáticas, Family 100, Free Fire, ML, etc. |
| **INFO** | 6 | Hora mundial, fase lunar, clima, eventos, terremotos (demo) y parrilla de TV. |
| **MAKER** | 3 | Generador Brat (fiel a bratgenerator.com), IQC (captura realista iMessage) y neón. |
| **PRIMBON** | 10 | Entretenimiento esotérico en español: nombre, compatibilidad, sueños, zodiaco, suerte. |
| **ALEATORIO** | 13 | Frases anime, chistes, gatos (SVG), cecan por país, waifu, neko (demo). |
| **BUSCAR** | 22 | Buscadores multi-sitio (GitHub real, otros demo). |
| **STALKER** | 8 | Perfiles de redes sociales (GitHub real, otros demo). |
| **STICKER** | 2 | Creador y buscador de stickers SVG. |
| **TOOLS** | 17 | QR, hashes, contraseñas, UUID, Base64, JWT, cron, color, unidades, slug, CIDR, captura web, código postal, traductor, países, subdominios, VCC. |
| **LOOKUP** | 5 | GitHub (real), NPM (real), DNS (real), miniaturas de YouTube y códigos HTTP. |
| **FUN** | 4 | Zodiaco, compatibilidad, Bola 8 y roast. |

Catálogo vivo en `GET /api/endpoints` · métricas reales en `GET /api/stats`.

---

## Canvas «Sakura Night»

Seis plantillas nocturnas en blanco y negro (flores de cerezo, luna, lago) con
**todos los parámetros configurables por query string**. En el Playground la
imagen se vuelve a generar sola mientras escribes.

| Endpoint | Parámetros propios |
|---|---|
| `GET /api/canvas/sakura/welcome` | `username`, `avatar`, `title`, `subtitle`, `member`, `memberLabel`, `vertical` |
| `GET /api/canvas/sakura/goodbye` | `username`, `avatar`, `title`, `text`, `footer` |
| `GET /api/canvas/sakura/levelup` | `username`, `avatar`, `level`, `prevLevel`, `title`, `subtitle`, `labelPrev`, `labelCurrent` |
| `GET /api/canvas/sakura/levelup-v2` | `username`, `level`, `title`, `label`, `headline`, `subtitle`, `vertical` |
| `GET /api/canvas/sakura/ship` | `name1`, `name2`, `avatar1`, `avatar2`, `percent`, `title`, `quote` |
| `GET /api/canvas/sakura/gay` | `username`, `avatar`, `percent` |

Comunes a todos: `color` (textos y adornos), `glow` (color del resplandor),
`tint` (tiñe el fondo), `format` = `jpg` · `png` · `svg`, `width` (320–2400) y
`quality` (JPG). Los avatares aceptan una URL `http(s)` (png/jpg/webp, máx. 3 MB)
o uno de los avatares internos (`ana`, `marco`, `cat`, `lila`, `theo`, `mia`, `bot`).
Los textos admiten `{username}`, `{level}`, `{prev}`, `{percent}`, `{member}`,
`{name1}`, `{name2}` y `|` para forzar salto de línea; `none` oculta un elemento
opcional. Sin `percent`, ship y gay calculan uno determinista a partir de los
nombres (`seed` lo cambia).

```text
/api/canvas/sakura/welcome?username=Lyan&avatar=https://…/foto.png&member=42
/api/canvas/sakura/ship?name1=Ana&name2=Marco&avatar1=…&avatar2=…&percent=87
/api/canvas/sakura/levelup-v2?username=Lyan&level=7&tint=%23ffb7c5&color=%23ffe4ec
```

El render es SVG puro (sin `canvas` nativo) rasterizado con `@resvg/resvg-js`
y codificado a JPG con `jpeg-js`; si el binario de resvg no está disponible en
la plataforma, los endpoints degradan a `image/svg+xml` con las fuentes
incrustadas. Tipografías: Cinzel y Cormorant Garamond (`@fontsource`, OFL),
un subconjunto de Noto Serif JP para kana/kanji y `SakuraSymbols` (flechas,
corazones, estrellas, cirílico) generados con `scripts/build-jp-subset.py` y
`scripts/build-fallback-font.py`.

---

## Estructura

```text
Api-web-/
├── server.js              # Servidor Express: rutas, assets, web y 404 JSON
├── src/
│   ├── registry.js        # Auto-descubrimiento de src/routes/*.js + telemetría
│   ├── lib/
│   │   ├── util.js        # escapeXml, wrapText, seed, clamp, etc.
│   │   ├── assets.js      # dataUri / inlineSvg para incrustar /assets
│   │   ├── sakura.js      # Motor de los canvas Sakura (texto, adornos, caché)
│   │   ├── fonts.js       # Métricas y carga de fuentes (Cinzel, Cormorant, JP)
│   │   ├── woff.js        # WOFF → TTF para resvg
│   │   ├── raster.js      # SVG → PNG/JPG con resvg + jpeg-js
│   │   └── remote-image.js# Descarga segura de avatares por URL (SSRF, caché)
│   └── routes/            # ai, anime, noticias, canvas, canvas-sakura, descargas,
│                          # juegos, info, maker, primbon, aleatorio, buscar,
│                          # stalker, sticker, tools, lookup, fun
├── assets/                # Imágenes (avatares, fondos Sakura, fuentes, logos)
├── scripts/               # smoke.js (npm test) y generadores de fuentes
└── public/                # Landing + Playground (CSS limpio en español)
```

---

## Ejecutar

```bash
npm install
npm start
```

- Landing: http://localhost:3000/
- Playground: http://localhost:3000/playground
- Catálogo JSON: http://localhost:3000/api/endpoints
- Métricas: http://localhost:3000/api/stats

## Añadir endpoints

Crea un archivo en `src/routes/` exportando `{ category, description, endpoints }`
y se registrará automáticamente en Express y aparecerá en el Playground.

## Despliegue

Incluye `render.yaml` (Render) y `vercel.json` (Vercel) listos.
