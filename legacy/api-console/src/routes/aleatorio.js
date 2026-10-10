/**
 * Categoría: ALEATORIO (contenido aleatorio en español).
 * Las imágenes se generan en SVG localmente; las citas son bancos propios.
 */

const { escapeXml, sendSvg } = require('../lib/util');
const { seedFrom } = require('../lib/util');

const FRASES_ANIME = [
  { cita: 'El verdadero poder está en levantarse tras cada caída.', personaje: 'Naruto Uzumaki', anime: 'Naruto' },
  { cita: 'Los sueños comienzan cuando crees en ellos.', personaje: 'Monkey D. Luffy', anime: 'One Piece' },
  { cita: 'El dolor te hace más fuerte o te rompe; tú eliges.', personaje: 'Gon Freecss', anime: 'Hunter x Hunter' }
];

const CHISTES = [
  '¿Qué hace una abeja en el gimnasio? ¡Zum-ba!',
  '¿Por qué los pájaros no usan Facebook? Porque ya tienen Twitter.',
  'Tengo un amigo que es muy pesimista. Cuando sube el ascensor, se baja en las malas noticias.',
  '¿Cómo se llama el campeón de buceo japonés? Tokofondo. ¿Y el subcampeón? Kasitoko.'
];

const FOTOS_GATOS = [
  { nombre: 'Michi', color: '#f5c518' },
  { nombre: 'Luna', color: '#1a1a1a' },
  { nombre: 'Pelusa', color: '#f2f3f5' },
  { nombre: 'Copito', color: '#ffffff' }
];

function svgGato(color, idx) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <rect width="400" height="400" fill="#f0e6d2"/>
  <g>
    <polygon points="100,120 140,50 180,120" fill="${color}"/>
    <polygon points="220,120 260,50 300,120" fill="${color}"/>
    <circle cx="200" cy="220" r="110" fill="${color}"/>
    <circle cx="165" cy="210" r="12" fill="#111"/>
    <circle cx="235" cy="210" r="12" fill="#111"/>
    <polygon points="190,235 210,235 200,250" fill="#ff6b9d"/>
    <path d="M200 250 Q 180 270 170 260 M200 250 Q 220 270 230 260" stroke="#111" stroke-width="3" fill="none" stroke-linecap="round"/>
    <line x1="100" y1="220" x2="150" y2="225" stroke="#111" stroke-width="2"/>
    <line x1="100" y1="235" x2="150" y2="235" stroke="#111" stroke-width="2"/>
    <line x1="250" y1="225" x2="300" y2="220" stroke="#111" stroke-width="2"/>
    <line x1="250" y1="235" x2="300" y2="235" stroke="#111" stroke-width="2"/>
  </g>
  <text x="200" y="380" font-family="ui-sans-serif,system-ui" font-size="18" fill="#555" text-anchor="middle">Gato #${idx + 1} · demo</text>
</svg>`;
}

function svgChica(color, nombre, idx) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="420" viewBox="0 0 320 420">
  <defs>
    <linearGradient id="bg${idx}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${color}"/><stop offset="100%" stop-color="#ffffff"/></linearGradient>
  </defs>
  <rect width="320" height="420" fill="url(#bg${idx})"/>
  <circle cx="160" cy="150" r="58" fill="#fde0c8"/>
  <path d="M110 140 Q 160 70 210 140 L 200 150 Q 160 100 120 150 Z" fill="#2d1b0e"/>
  <circle cx="140" cy="155" r="6" fill="#111"/>
  <circle cx="180" cy="155" r="6" fill="#111"/>
  <path d="M155 180 Q 160 188 165 180" stroke="#b22" stroke-width="2" fill="none"/>
  <rect x="110" y="210" width="100" height="130" rx="20" fill="${color}"/>
  <text x="160" y="400" font-family="ui-sans-serif" font-size="16" fill="#222" text-anchor="middle">${escapeXml(nombre)} · demo</text>
</svg>`;
}

const CECAN = [
  ['japan', 'Japón', '#f5c518'],
  ['indonesia', 'Indonesia', '#e5484d'],
  ['vietnam', 'Vietnam', '#0ea5e9'],
  ['china', 'China', '#dc2626'],
  ['thailand', 'Tailandia', '#16a34a'],
  ['korea', 'Corea', '#8b5cf6']
];

module.exports = {
  category: 'ALEATORIO',
  description: 'Contenido aleatorio en español: frases, chistes, fotos de gatos y "cecan" generadas en SVG.',
  endpoints: [
    {
      name: 'Frase de anime',
      path: '/api/r/quotesanime',
      method: 'GET',
      description: 'Frase célebre de anime en español.',
      responseType: 'json',
      params: [],
      handler: async (req, res) => res.json({ status: true, data: FRASES_ANIME[Math.floor(Math.random() * FRASES_ANIME.length)] })
    },
    {
      name: 'Chiste / contenido gracioso',
      path: '/api/r/lahelu',
      method: 'GET',
      description: 'Un chiste corto en español.',
      responseType: 'json',
      params: [],
      handler: async (req, res) => res.json({ status: true, data: { chiste: CHISTES[Math.floor(Math.random() * CHISTES.length)] } })
    },
    {
      name: 'Contenido gracioso (seegore demo)',
      path: '/api/r/seegore',
      method: 'GET',
      description: 'Contenido divertido (demo — no incluye material real).',
      responseType: 'json',
      params: [],
      handler: async (req, res) => res.json({ status: true, data: { nota: 'Demo en español', chiste: CHISTES[Math.floor(Math.random() * CHISTES.length)] } })
    },
    {
      name: 'Foto aleatoria de gato (SVG)',
      path: '/api/r/cats',
      method: 'GET',
      description: 'Foto de gato generada proceduralmente en SVG.',
      responseType: 'image',
      params: [],
      handler: async (req, res) => {
        const idx = Math.floor(Math.random() * FOTOS_GATOS.length);
        sendSvg(res, svgGato(FOTOS_GATOS[idx].color, idx), 3600);
      }
    },
    {
      name: 'Personaje Blue Archive (demo SVG)',
      path: '/api/r/blue-archive',
      method: 'GET',
      description: 'Ilustración abstracta aleatoria (demo).',
      responseType: 'image',
      params: [],
      handler: async (req, res) => {
        const c = ['#00bfff', '#ff69b4', '#8ACE00', '#ffa500'][Math.floor(Math.random() * 4)];
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500"><rect width="400" height="500" fill="#0a0f1a"/><circle cx="200" cy="180" r="80" fill="${c}" opacity="0.9"/><rect x="140" y="260" width="120" height="200" rx="30" fill="${c}"/><text x="200" y="480" font-family="ui-sans-serif" font-size="16" fill="#fff" text-anchor="middle">Blue Archive · demo</text></svg>`;
        sendSvg(res, svg, 3600);
      }
    },
    {
      name: 'Neko anime (SVG demo)',
      path: '/api/r/neko',
      method: 'GET',
      description: 'Ilustración neko procedural en SVG.',
      responseType: 'image',
      params: [],
      handler: async (req, res) => {
        const c = '#ffb6c1';
        sendSvg(res, svgGato(c, 99), 3600);
      }
    },
    {
      name: 'Waifu aleatoria (SVG demo)',
      path: '/api/r/waifu',
      method: 'GET',
      description: 'Personaje waifu generado abstractamente en SVG (demo).',
      responseType: 'image',
      params: [],
      handler: async (req, res) => {
        const colors = ['#ff6b9d', '#a78bfa', '#34d399', '#60a5fa', '#fbbf24'];
        const c = colors[Math.floor(Math.random() * colors.length)];
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500"><defs><linearGradient id="w" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${c}"/><stop offset="100%" stop-color="#fde0c8"/></linearGradient></defs><rect width="400" height="500" fill="url(#w)"/><circle cx="200" cy="180" r="70" fill="#fde0c8"/><path d="M130 150 Q200 60 270 150 L260 170 Q200 100 140 170 Z" fill="${c}"/><circle cx="180" cy="185" r="7" fill="#111"/><circle cx="220" cy="185" r="7" fill="#111"/><path d="M190 210 Q200 220 210 210" stroke="#b22" stroke-width="2" fill="none"/><text x="200" y="470" font-family="ui-sans-serif" font-size="18" fill="#333" text-anchor="middle">Waifu · demo</text></svg>`;
        sendSvg(res, svg, 3600);
      }
    },
    ...CECAN.map(([slug, nombre, color]) => ({
      name: `Cecan ${nombre} (SVG)`,
      path: `/api/r/cecan/${slug}`,
      method: 'GET',
      description: `Ilustración procedural "cecan ${nombre}" en SVG (demo).`,
      responseType: 'image',
      params: [],
      handler: ((c, n, i) => async (req, res) => sendSvg(res, svgChica(c, n, i), 3600))(color, nombre, CECAN.findIndex(x => x[0] === slug))
    }))
  ]
};
