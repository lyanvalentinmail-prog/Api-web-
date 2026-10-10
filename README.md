# API Console (Español) — REST API pública sin clave

Clon en español de la SIPUTZX API Console V2: una plataforma Node.js + Express
con **178 endpoints** organizados en 16 categorías y un **Playground**
(`/playground`) para ejecutarlos en vivo con snippets de `cURL`, `fetch` y
`Python`.

Sin registro, sin clave API, CORS abierto. Algunos endpoints funcionan con datos
reales (GitHub, código abierto) y otros devuelven demostraciones deterministas
en español (IA, descargas, stalker, noticias, juegos…), pero **todos responden
con JSON/SVG válido** y sin inventar datos falsos sin aclararlo.

---

## Categorías

| Categoría | Endpoints | Descripción |
|---|---|---|
| **IA** | 12 | Chat con DuckAI, GPT OSS, DeepSeek R1, Gemini, Meta AI, Phi-2, QwQ, GLM, Bible/Gita y generador de imágenes (demo). |
| **ANIME** | 5 | Frases, búsqueda, calendario y detalle de animes populares. |
| **NOTICIAS** | 10 | Titulares recientes en español (fuentes demo). |
| **CANVAS** | 13 | Tarjetas SVG: bienvenida, despedida, perfil, tweet, certificado, cita, código, IQ, captcha, level-up, seguridad, spotify, delete. |
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

## Estructura

```text
Api-web-/
├── server.js              # Servidor Express: rutas, assets, web y 404 JSON
├── src/
│   ├── registry.js        # Auto-descubrimiento de src/routes/*.js + telemetría
│   ├── lib/
│   │   ├── util.js        # escapeXml, wrapText, seed, clamp, etc.
│   │   └── assets.js      # dataUri / inlineSvg para incrustar /assets
│   └── routes/            # ai, anime, noticias, canvas, descargas, juegos,
│                          # info, maker, primbon, aleatorio, buscar, stalker,
│                          # sticker, tools, lookup, fun
├── assets/                # Imágenes del proyecto (avatares, wallpapers, logos)
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
