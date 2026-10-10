/**
 * Categoría: LOOKUP (5 endpoints)
 * Consultas REALES contra servicios públicos (GitHub, NPM, DNS) o datos de
 * referencia propios. Si el servicio externo no responde, el endpoint devuelve
 * status:false con el motivo — nunca datos inventados.
 */

const dns = require('dns').promises;

async function fetchJson(url, ms = 6000) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(ms),
    headers: { 'User-Agent': 'Api-website/3.0 (public API console)', Accept: 'application/json' }
  });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.statusCode = res.status;
    throw err;
  }
  return res.json();
}

function upstreamError(res, err, service) {
  const status = err.statusCode === 404 ? 404 : 502;
  res.status(status).json({
    status: false,
    error: status === 404
      ? `No se encontró el recurso en ${service}.`
      : `${service} no respondió a tiempo o rechazó la consulta.`,
    detail: err.message
  });
}

module.exports = {
  category: 'LOOKUP',
  description: 'Consultas en vivo contra GitHub, NPM y DNS, más miniaturas de YouTube y referencia de códigos HTTP.',
  endpoints: [
    {
      name: 'GitHub Profile Lookup',
      path: '/api/lookup/github',
      method: 'GET',
      description: 'Consulta la API pública de GitHub y devuelve datos reales del usuario: nombre, bio, seguidores, repos públicos y avatar.',
      responseType: 'json',
      params: [
        { name: 'username', type: 'string', required: true, example: 'octocat', description: 'Usuario de GitHub' }
      ],
      handler: async (req, res) => {
        const username = String(req.query.username || '').trim().replace(/^@/, '');
        if (!username) return res.status(400).json({ status: false, error: 'El parámetro "username" es obligatorio.' });
        try {
          const u = await fetchJson(`https://api.github.com/users/${encodeURIComponent(username)}`);
          res.json({
            status: true,
            data: {
              username: u.login,
              name: u.name,
              bio: u.bio,
              avatar_url: u.avatar_url,
              profile_url: u.html_url,
              public_repos: u.public_repos,
              followers: u.followers,
              following: u.following,
              created_at: u.created_at
            }
          });
        } catch (err) {
          upstreamError(res, err, 'GitHub');
        }
      }
    },
    {
      name: 'NPM Package Lookup',
      path: '/api/lookup/npm',
      method: 'GET',
      description: 'Consulta el registro oficial de NPM y devuelve descripción, última versión, licencia y enlaces reales del paquete.',
      responseType: 'json',
      params: [
        { name: 'package', type: 'string', required: true, example: 'express', description: 'Nombre del paquete' }
      ],
      handler: async (req, res) => {
        const pkg = String(req.query.package || '').trim().toLowerCase();
        if (!pkg) return res.status(400).json({ status: false, error: 'El parámetro "package" es obligatorio.' });
        try {
          const meta = await fetchJson(`https://registry.npmjs.org/${encodeURIComponent(pkg)}`);
          const latestTag = meta['dist-tags'] && meta['dist-tags'].latest;
          const latest = meta.versions && meta.versions[latestTag];
          res.json({
            status: true,
            data: {
              name: meta.name,
              description: meta.description || null,
              latest_version: latestTag || null,
              license: (latest && latest.license) || null,
              homepage: meta.homepage || null,
              repository: meta.repository && meta.repository.url ? meta.repository.url : null,
              npm_page: `https://www.npmjs.com/package/${meta.name}`,
              tarball: latest && latest.dist ? latest.dist.tarball : null
            }
          });
        } catch (err) {
          upstreamError(res, err, 'NPM');
        }
      }
    },
    {
      name: 'DNS Lookup',
      path: '/api/lookup/dns',
      method: 'GET',
      description: 'Resolución DNS real (A, AAAA y MX) del dominio usando el resolver del sistema.',
      responseType: 'json',
      params: [
        { name: 'domain', type: 'string', required: true, example: 'github.com', description: 'Dominio a resolver' }
      ],
      handler: async (req, res) => {
        const domain = String(req.query.domain || '').trim().replace(/^https?:\/\//i, '').split('/')[0].toLowerCase();
        if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
          return res.status(400).json({ status: false, error: 'Dominio inválido.' });
        }
        const safe = async fn => { try { return await fn(); } catch { return []; } };
        const [a, aaaa, mx] = await Promise.all([
          safe(() => dns.resolve4(domain)),
          safe(() => dns.resolve6(domain)),
          safe(() => dns.resolveMx(domain))
        ]);
        if (!a.length && !aaaa.length && !mx.length) {
          return res.status(404).json({ status: false, error: `Sin registros DNS para ${domain}.` });
        }
        res.json({
          status: true,
          data: {
            domain,
            a,
            aaaa,
            mx: mx.map(m => `${m.priority} ${m.exchange}`).sort()
          }
        });
      }
    },
    {
      name: 'YouTube Thumbnail Grabber',
      path: '/api/lookup/youtube-thumbnails',
      method: 'GET',
      description: 'Devuelve las URLs oficiales de miniatura (maxres/sd/hq/mq) de cualquier video de YouTube.',
      responseType: 'json',
      params: [
        { name: 'url', type: 'string', required: true, example: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', description: 'URL o ID del video' }
      ],
      handler: async (req, res) => {
        const raw = String(req.query.url || '').trim();
        const m = raw.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([a-zA-Z0-9_-]{6,})/);
        const videoId = m ? m[1] : (/^[a-zA-Z0-9_-]{6,}$/.test(raw) ? raw : null);
        if (!videoId) return res.status(400).json({ status: false, error: 'No se pudo extraer el ID del video.' });
        res.json({
          status: true,
          data: {
            video_id: videoId,
            watch_url: `https://www.youtube.com/watch?v=${videoId}`,
            thumbnails: {
              maxres_1080p: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
              standard_640p: `https://img.youtube.com/vi/${videoId}/sddefault.jpg`,
              high_480p: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
              medium_320p: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
            }
          }
        });
      }
    },
    {
      name: 'HTTP Status Reference',
      path: '/api/lookup/http-status',
      method: 'GET',
      description: 'Referencia de códigos de estado HTTP con explicación breve; consulta uno o lista todos.',
      responseType: 'json',
      params: [
        { name: 'code', type: 'number', required: false, example: '404', description: 'Código a consultar (opcional)' }
      ],
      handler: async (req, res) => {
        const STATUS = {
          200: 'OK — la petición se procesó correctamente.',
          201: 'Created — se creó un nuevo recurso.',
          204: 'No Content — éxito sin cuerpo de respuesta.',
          301: 'Moved Permanently — el recurso cambió de URL para siempre.',
          302: 'Found — redirección temporal.',
          304: 'Not Modified — la caché del cliente sigue siendo válida.',
          400: 'Bad Request — el servidor no entiende la petición.',
          401: 'Unauthorized — falta autenticación válida.',
          403: 'Forbidden — autenticado pero sin permiso.',
          404: 'Not Found — el recurso no existe.',
          405: 'Method Not Allowed — verbo HTTP no soportado aquí.',
          408: 'Request Timeout — el cliente tardó demasiado.',
          409: 'Conflict — la petición choca con el estado actual.',
          418: "I'm a teapot — el clásico easter egg de RFC 2324.",
          429: 'Too Many Requests — límite de peticiones superado.',
          500: 'Internal Server Error — fallo inesperado del servidor.',
          502: 'Bad Gateway — el proxy recibió una respuesta inválida.',
          503: 'Service Unavailable — servidor caído o en mantenimiento.',
          504: 'Gateway Timeout — el proxy no recibió respuesta a tiempo.'
        };
        const code = parseInt(req.query.code, 10);
        if (req.query.code !== undefined) {
          if (!STATUS[code]) return res.status(404).json({ status: false, error: `Código ${code} fuera de la referencia.` });
          return res.json({ status: true, data: { code, description: STATUS[code] } });
        }
        res.json({ status: true, total: Object.keys(STATUS).length, data: STATUS });
      }
    }
  ]
};
