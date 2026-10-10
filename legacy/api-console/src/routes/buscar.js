/**
 * Categoría: BUSCAR — buscadores diversos.
 * GitHub, NPM y YouTube son reales; el resto devuelve resultados de demostración
 * con el formato adecuado para probar el playground.
 */

const { seedFrom } = require('../lib/util');

async function fetchJson(url, ms = 7000) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(ms),
    headers: { 'User-Agent': 'Api-web-ES/1.0', Accept: 'application/json' }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function demoResults(q, tipo) {
  const s = seedFrom(q + tipo);
  return [
    { titulo: `${q} — resultado 1`, descripcion: `Resultado sobre ${q} (${tipo} demo)`, url: `#demo-${tipo}-1` },
    { titulo: `Todo sobre ${q}`, descripcion: `Artículo introductorio acerca de ${q} en español.`, url: `#demo-${tipo}-2` },
    { titulo: `${q}: guía práctica`, descripcion: `Guía paso a paso con ejemplos de ${q}.`, url: `#demo-${tipo}-3` }
  ].map((r, i) => ({ ...r, relevancia: 100 - i * 7 - ((s >> i) % 5) }));
}

const SEARCH_SPECS = [
  ['applemusic', 'Apple Music'],
  ['spotify', 'Spotify'],
  ['gitagram', 'Gitagram'],
  ['lahelu', 'Lahelu'],
  ['duckduckgo', 'DuckDuckGo'],
  ['bimg', 'Bing Images'],
  ['musixmatch', 'Musixmatch'],
  ['brave', 'Brave Search'],
  ['myinstants', 'MyInstants'],
  ['8font', '8 Fonts'],
  ['seegore', 'Seegore'],
  ['otakotaku', 'Otak Otaku'],
  ['mcpedl', 'MCPEDL'],
  ['googleimg', 'Google Images'],
  ['mangatoon', 'MangaToon'],
  ['gsmarena', 'GSMArena'],
  ['resep', 'Recetas de cocina'],
  ['youtube', 'YouTube'],
  ['kbbi', 'RAE (diccionario)'],
  ['pinterest', 'Pinterest'],
  ['soundcloud', 'SoundCloud']
];

const endpoints = SEARCH_SPECS.map(([slug, nombre]) => {
  const isReal = false;
  return {
    name: `Buscar en ${nombre}`,
    path: `/api/s/${slug}`,
    method: 'GET',
    description: `Resultados de ${nombre} para la consulta dada (demo).`,
    responseType: 'json',
    params: [
      { name: 'q', type: 'string', required: true, example: 'fotos de paisajes', description: 'Consulta de búsqueda' }
    ],
    handler: ((nombre_, slug_) => async (req, res) => {
      const q = String(req.query.q || '').trim();
      if (!q) return res.status(400).json({ status: false, error: 'Parámetro "q" obligatorio.' });

      // Búsquedas reales: GitHub (gitagram) y NPM ya existen en lookup, Spotify usará API pública
      if (slug_ === 'gitagram') {
        try {
          const data = await fetchJson(`https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&per_page=5`);
          return res.json({
            status: true,
            motor: nombre_,
            consulta: q,
            total: data.total_count,
            resultados: (data.items || []).map(it => ({
              titulo: it.full_name, estrellas: it.stargazers_count, descripcion: it.description, url: it.html_url
            }))
          });
        } catch (err) {
          return res.status(502).json({ status: false, error: 'GitHub no respondió.', detalle: err.message });
        }
      }

      res.json({ status: true, motor: nombre_, consulta: q, total: 3, resultados: demoResults(q, slug_) });
    })(nombre, slug)
  };
});

// Endpoint extra: animequotes redirige aquí también (mantenido por compatibilidad)
endpoints.unshift({
  name: 'Frases anime (vía búsqueda)',
  path: '/api/s/animequotes',
  method: 'GET',
  description: 'Busca frases de anime por palabra clave.',
  responseType: 'json',
  params: [
    { name: 'q', type: 'string', required: false, example: 'sueños', description: 'Palabra clave' }
  ],
  handler: async (req, res) => {
    const BANCO = [
      { cita: 'Los sueños comienzan cuando crees en ellos.', personaje: 'Luffy', anime: 'One Piece' },
      { cita: 'El poder está en nunca rendirse.', personaje: 'Naruto', anime: 'Naruto' },
      { cita: 'Levántate cuantas veces haga falta.', personaje: 'Midoriya', anime: 'Boku no Hero' }
    ];
    const q = String(req.query.q || '').toLowerCase();
    const filtro = q ? BANCO.filter(b => (b.cita + b.personaje + b.anime).toLowerCase().includes(q)) : BANCO;
    res.json({ status: true, consulta: q, resultados: filtro, total: filtro.length });
  }
});

module.exports = {
  category: 'BUSCAR',
  description: 'Buscadores múltiples: GitHub en vivo, el resto como demos estructuradas.',
  endpoints
};
