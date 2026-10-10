/**
 * Categoría: STALKER (perfiles).
 * GitHub funciona en vivo; el resto devuelve datos de demostración.
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

function demoPerfil(plataforma, username) {
  const s = seedFrom(plataforma + username);
  return {
    plataforma,
    username,
    nombre: username.charAt(0).toUpperCase() + username.slice(1),
    biografia: `Perfil de ${username} en ${plataforma} (demo).`,
    seguidores: 100 + (s % 9900),
    siguiendo: 50 + (s % 500),
    avatar: `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128'><rect width='128' height='128' fill='%238ACE00'/><text x='64' y='78' font-size='56' font-family='sans-serif' font-weight='700' text-anchor='middle' fill='white'>${encodeURIComponent(username.charAt(0).toUpperCase())}</text></svg>`,
    demo: true
  };
}

const PLATAFORMAS = [
  ['instagram', 'Instagram'],
  ['roblox', 'Roblox'],
  ['twitter', 'Twitter / X'],
  ['threads', 'Threads'],
  ['youtube', 'YouTube'],
  ['pinterest', 'Pinterest'],
  ['tiktok', 'TikTok']
];

const endpoints = [
  {
    name: 'Perfil de GitHub (real)',
    path: '/api/stalk/github',
    method: 'GET',
    description: 'Datos reales de un usuario de GitHub mediante la API pública.',
    responseType: 'json',
    params: [
      { name: 'username', type: 'string', required: true, example: 'octocat', description: 'Usuario de GitHub' }
    ],
    handler: async (req, res) => {
      const username = String(req.query.username || '').trim().replace(/^@/, '');
      if (!username) return res.status(400).json({ status: false, error: 'Parámetro "username" obligatorio.' });
      try {
        const u = await fetchJson(`https://api.github.com/users/${encodeURIComponent(username)}`);
        res.json({
          status: true,
          data: {
            plataforma: 'GitHub',
            username: u.login,
            nombre: u.name,
            biografia: u.bio,
            avatar: u.avatar_url,
            pagina: u.html_url,
            repos_publicos: u.public_repos,
            seguidores: u.followers,
            siguiendo: u.following,
            verificado: u.type === 'User' ? null : u.type
          }
        });
      } catch (err) {
        res.status(502).json({ status: false, error: 'GitHub no respondió.', detalle: err.message });
      }
    }
  }
];

for (const [slug, nombre] of PLATAFORMAS) {
  endpoints.push({
    name: `Perfil de ${nombre}`,
    path: `/api/stalk/${slug}`,
    method: 'GET',
    description: `Datos de perfil en ${nombre} (demo).`,
    responseType: 'json',
    params: [
      { name: 'username', type: 'string', required: true, example: 'usuario', description: `Usuario de ${nombre}` }
    ],
    handler: ((nombre_, slug_) => async (req, res) => {
      const username = String(req.query.username || '').trim().replace(/^@/, '');
      if (!username) return res.status(400).json({ status: false, error: 'Parámetro "username" obligatorio.' });
      res.json({ status: true, data: demoPerfil(nombre_, username) });
    })(nombre, slug)
  });
}

module.exports = {
  category: 'STALKER',
  description: 'Consulta de perfiles en redes. GitHub es real; el resto son demos estructuradas.',
  endpoints
};
