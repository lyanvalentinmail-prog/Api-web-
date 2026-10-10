/**
 * Categoría: DESCARGAS — endpoints para obtener información de descarga.
 * Los endpoints que requieren servicios externos funcionan como metadatos/demo,
 * mientras que github descarga archivos reales desde la API pública de GitHub.
 */

async function fetchJson(url, ms = 8000) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(ms),
    headers: { 'User-Agent': 'Api-web-ES/1.0', Accept: 'application/json' }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function demoMeta(plataforma, url) {
  return {
    plataforma,
    url_original: url,
    demo: true,
    mensaje: `Este es un endpoint de demostración. En producción conectaría con ${plataforma} para devolver un enlace directo.`,
    ejemplo_de_respuesta: {
      titulo: 'Título del contenido',
      autor: 'Autor del contenido',
      duracion_seg: 30,
      descargas: [
        { calidad: '720p', formato: 'mp4', url: `#demo-${plataforma}-720` },
        { calidad: '480p', formato: 'mp4', url: `#demo-${plataforma}-480` }
      ]
    }
  };
}

const PLATAFORMAS = [
  ['capcut', 'CapCut'],
  ['gdrive', 'Google Drive'],
  ['spotify', 'Spotify'],
  ['savefrom', 'SaveFrom'],
  ['douyin', 'Douyin'],
  ['lahelu', 'Lahelu'],
  ['soundcloud', 'SoundCloud'],
  ['snackvideo', 'SnackVideo'],
  ['spotifyv2', 'Spotify v2'],
  ['tiktok', 'TikTok'],
  ['fastdl', 'Instagram (fastdl)'],
  ['igram', 'Instagram (igram)'],
  ['tiktok/v2', 'TikTok v2'],
  ['twitter', 'Twitter / X'],
  ['ssstwiter', 'SSSTwitter'],
  ['facebook', 'Facebook'],
  ['ytpost', 'YouTube Community'],
  ['sssinstagram', 'SSSInstagram'],
  ['ummy', 'Ummy'],
  ['rednote', 'RedNote']
];

const endpoints = PLATAFORMAS.map(([slug, nombre]) => {
  const path = slug.includes('/') ? `/api/d/${slug}` : `/api/d/${slug}`;
  return {
    name: nombre,
    path,
    method: 'GET',
    description: `Información de descarga para enlaces de ${nombre} (demo).`,
    responseType: 'json',
    params: [
      { name: 'url', type: 'string', required: true, example: 'https://example.com/enlace', description: `URL de ${nombre}` }
    ],
    handler: async (req, res) => {
      const url = String(req.query.url || '').trim();
      if (!url) return res.status(400).json({ status: false, error: 'El parámetro "url" es obligatorio.' });
      res.json({ status: true, data: demoMeta(nombre, url) });
    }
  };
});

// Endpoint REAL: GitHub downloader
endpoints.push({
  name: 'GitHub Downloader (real)',
  path: '/api/d/github',
  method: 'GET',
  description: 'Devuelve metadatos reales y la URL de descarga de un repositorio o release de GitHub.',
  responseType: 'json',
  params: [
    { name: 'repo', type: 'string', required: true, example: 'octocat/Hello-World', description: 'Usuario/repo en GitHub' }
  ],
  handler: async (req, res) => {
    const repo = String(req.query.repo || '').trim();
    if (!repo) return res.status(400).json({ status: false, error: 'Parámetro "repo" obligatorio (usuario/repo).' });
    if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repo)) {
      return res.status(400).json({ status: false, error: 'Formato inválido. Usa: usuario/repo' });
    }
    try {
      const info = await fetchJson(`https://api.github.com/repos/${repo}`);
      let zipUrl = `https://github.com/${repo}/archive/refs/heads/${info.default_branch || 'main'}.zip`;
      let tarUrl = `https://github.com/${repo}/archive/refs/heads/${info.default_branch || 'main'}.tar.gz`;
      let release = null;
      try {
        const rel = await fetchJson(`https://api.github.com/repos/${repo}/releases/latest`);
        release = {
          tag: rel.tag_name,
          nombre: rel.name,
          publicado: rel.published_at,
          assets: (rel.assets || []).map(a => ({ nombre: a.name, descarga: a.browser_download_url, tamano_bytes: a.size }))
        };
        if (rel.zipball_url) zipUrl = rel.zipball_url;
        if (rel.tarball_url) tarUrl = rel.tarball_url;
      } catch { /* sin releases públicos */ }
      res.json({
        status: true,
        data: {
          repositorio: repo,
          nombre: info.name,
          descripcion: info.description,
          estrellas: info.stargazers_count,
          forks: info.forks_count,
          rama_por_defecto: info.default_branch,
          pagina: info.html_url,
          descargas: {
            zip_ultima_revision: zipUrl,
            tar_ultima_revision: tarUrl,
            clon_https: info.clone_url
          },
          release
        }
      });
    } catch (err) {
      res.status(502).json({ status: false, error: 'No se pudo consultar GitHub.', detalle: err.message });
    }
  }
});

module.exports = {
  category: 'DESCARGAS',
  description: 'Información de descarga para múltiples plataformas. GitHub funciona en vivo; el resto son demos.',
  endpoints
};
