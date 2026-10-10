/**
 * Categoría: STICKER (pegatinas).
 * Genera stickers en SVG a partir de texto o términos de búsqueda (demo).
 */

const { escapeXml, sendSvg } = require('../lib/util');
const { seedFrom } = require('../lib/util');

const STICKERS_PREDETERMINADOS = [
  { nombre: 'OK', emoji: '👌', color: '#8ACE00' },
  { nombre: 'jajaja', emoji: '😂', color: '#f5c518' },
  { nombre: 'LOL', emoji: '🤣', color: '#0ea5e9' },
  { nombre: 'FUEGO', emoji: '🔥', color: '#ef4444' },
  { nombre: 'CORAZON', emoji: '❤️', color: '#ec4899' },
  { nombre: 'BAILA', emoji: '💃', color: '#a78bfa' }
];

function svgSticker(texto, emoji, color) {
  const limpio = escapeXml(String(texto || 'OK').slice(0, 16).toUpperCase());
  const w = Math.max(280, 200 + limpio.length * 12);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="220" viewBox="0 0 ${w} 220">
  <defs>
    <filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000" flood-opacity="0.25"/></filter>
  </defs>
  <rect x="20" y="20" width="${w - 40}" height="180" rx="40" fill="${color}" filter="url(#s)"/>
  <text x="${w / 2}" y="100" font-size="60" text-anchor="middle">${emoji}</text>
  <text x="${w / 2}" y="160" font-family="Arial, sans-serif" font-size="28" font-weight="900" fill="white" text-anchor="middle">${limpio}</text>
</svg>`;
}

module.exports = {
  category: 'STICKER',
  description: 'Crea stickers SVG con texto y emoji; buscador de stickers (demo).',
  endpoints: [
    {
      name: 'Crear sticker de texto',
      path: '/api/sticker/text',
      method: 'GET',
      description: 'Genera un sticker en SVG con el texto y emoji elegidos.',
      responseType: 'image',
      params: [
        { name: 'text', type: 'string', required: false, example: '¡GENIAL!', description: 'Texto del sticker' },
        { name: 'emoji', type: 'string', required: false, example: '🔥', description: 'Emoji o símbolo' },
        { name: 'color', type: 'string', required: false, example: '#8ACE00', description: 'Color de fondo (hex)' }
      ],
      handler: async (req, res) => {
        sendSvg(res, svgSticker(req.query.text || '¡OK!', req.query.emoji || '👌', req.query.color || '#8ACE00'), 3600);
      }
    },
    {
      name: 'Buscar stickers (demo)',
      path: '/api/sticker/combot-search',
      method: 'GET',
      description: 'Devuelve una lista de stickers predeterminados según una búsqueda (demo).',
      responseType: 'json',
      params: [
        { name: 'q', type: 'string', required: true, example: 'fuego', description: 'Consulta' }
      ],
      handler: async (req, res) => {
        const q = String(req.query.q || '').toLowerCase().trim();
        if (!q) return res.status(400).json({ status: false, error: 'Parámetro "q" obligatorio.' });
        const resultados = STICKERS_PREDETERMINADOS.filter(s => s.nombre.toLowerCase().includes(q));
        res.json({
          status: true,
          data: {
            consulta: q,
            stickers: (resultados.length ? resultados : STICKERS_PREDETERMINADOS.slice(0, 3)).map((s, i) => ({
              id: `stk-${i}`,
              nombre: s.nombre,
              emoji: s.emoji,
              url: `/api/sticker/text?text=${encodeURIComponent(s.nombre)}&emoji=${encodeURIComponent(s.emoji)}&color=${encodeURIComponent(s.color)}`
            }))
          }
        });
      }
    }
  ]
};
