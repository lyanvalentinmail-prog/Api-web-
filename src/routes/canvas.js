/**
 * Categoría: CANVAS (8 endpoints)
 * Tarjetas SVG limpias y reutilizables que consumen /assets:
 * patrones, insignias y avatares se incrustan desde la carpeta assets/.
 * Lenguaje visual común: fondo claro u oscuro, borde 1px, acento configurable,
 * tipografía de sistema y mono para etiquetas. Sin neón ni ruido.
 */

const { escapeXml, sendSvg, hexColor, clamp, textWidth, wrapText, truncate, initialsOf, seedFrom } = require('../lib/util');
const assets = require('../lib/assets');

const AVATARS = {
  ana: 'iqc/avatars/avatar-ana.jpg',
  marco: 'iqc/avatars/avatar-marco.jpg',
  cat: 'iqc/avatars/avatar-cat.jpg'
};

const CARD_THEMES = {
  light: { bg: '#f7f7f5', card: '#ffffff', border: '#e6e4df', fg: '#17181a', dim: '#6d6f74', mono: '#9a9ca1' },
  dark:  { bg: '#0e0f12', card: '#15171b', border: '#272a30', fg: '#f2f3f5', dim: '#9aa0a8', mono: '#6b727c' }
};

function cardChrome(t, w, h, accent, pattern = true) {
  return `
  <rect width="${w}" height="${h}" rx="18" fill="${t.card}"/>
  <rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="17.5" fill="none" stroke="${t.border}"/>
  <rect x="0" y="0" width="${w}" height="6" rx="3" fill="${accent}"/>
  ${pattern ? `<g opacity="0.5" style="color:${accent}">${assets.inlineSvg('cards/pattern-dots.svg', w - 130, 26, 110, 110)}</g>` : ''}`;
}

function avatarCircle(key, cx, cy, r, initials, accent) {
  const d = r * 2;
  if (AVATARS[key]) {
    return `<g><clipPath id="ac${cx}${cy}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath><image x="${cx - r}" y="${cy - r}" width="${d}" height="${d}" preserveAspectRatio="xMidYMid slice" clip-path="url(#ac${cx}${cy})" href="${assets.dataUri(AVATARS[key])}"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${accent}" stroke-width="2"/></g>`;
  }
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${accent}" opacity="0.15"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${accent}" stroke-width="2"/><text x="${cx}" y="${cy + r * 0.34}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="${r * 0.9}" font-weight="700" fill="${accent}" text-anchor="middle">${escapeXml(initials)}</text>`;
}

module.exports = {
  category: 'CANVAS',
  description: 'Tarjetas SVG limpias (bienvenida, perfil, tweet, certificado, cita, código, IQ Check y captcha) que consumen los assets compartidos.',
  endpoints: [
    {
      name: 'Welcome Card',
      path: '/api/canvas/welcome',
      method: 'GET',
      description: 'Tarjeta de bienvenida para comunidades (Discord/Telegram) con patrón de puntos y acento configurable.',
      responseType: 'image',
      params: [
        { name: 'username', type: 'string', required: true, example: 'LyanValentin', description: 'Nombre del usuario' },
        { name: 'guild', type: 'string', required: false, example: 'API CONSOLE', description: 'Nombre de la comunidad' },
        { name: 'memberCount', type: 'number', required: false, example: '1428', description: 'Número de miembro' },
        { name: 'theme', type: 'select', options: ['light', 'dark'], required: false, example: 'light', description: 'Tema de la tarjeta' },
        { name: 'accent', type: 'string', required: false, example: '#8ACE00', description: 'Color de acento (hex)' }
      ],
      handler: async (req, res) => {
        const t = CARD_THEMES[req.query.theme === 'dark' ? 'dark' : 'light'];
        const accent = hexColor(req.query.accent, '#8ACE00');
        const username = escapeXml(truncate(req.query.username || 'Developer', 22));
        const guild = escapeXml(truncate((req.query.guild || 'API CONSOLE').toUpperCase(), 28));
        const member = escapeXml(String(req.query.memberCount || '1024'));

        sendSvg(res, `<svg xmlns="http://www.w3.org/2000/svg" width="760" height="280" viewBox="0 0 760 280">
  ${cardChrome(t, 760, 280, accent)}
  ${avatarCircle(req.query.avatar || 'none', 120, 150, 56, initialsOf(req.query.username || 'Developer'), accent)}
  <text x="210" y="120" font-family="ui-monospace, monospace" font-size="13" font-weight="700" letter-spacing="3" fill="${accent}">BIENVENIDO A ${guild}</text>
  <text x="210" y="168" font-family="ui-sans-serif, system-ui, sans-serif" font-size="40" font-weight="800" fill="${t.fg}">${username}</text>
  <text x="210" y="204" font-family="ui-sans-serif, system-ui, sans-serif" font-size="16" fill="${t.dim}">Miembro <tspan font-weight="700" fill="${t.fg}">#${member}</tspan> · presenta tus proyectos y diviértete.</text>
</svg>`, 3600);
      }
    },
    {
      name: 'Goodbye Card',
      path: '/api/canvas/goodbye',
      method: 'GET',
      description: 'Tarjeta de despedida cuando alguien abandona la comunidad.',
      responseType: 'image',
      params: [
        { name: 'username', type: 'string', required: true, example: 'ShadowRunner', description: 'Nombre del usuario' },
        { name: 'guild', type: 'string', required: false, example: 'GAMERS LATAM', description: 'Comunidad que abandona' },
        { name: 'remaining', type: 'number', required: false, example: '849', description: 'Miembros restantes' },
        { name: 'accent', type: 'string', required: false, example: '#e5484d', description: 'Color de acento (hex)' }
      ],
      handler: async (req, res) => {
        const t = CARD_THEMES.light;
        const accent = hexColor(req.query.accent, '#e5484d');
        const username = escapeXml(truncate(req.query.username || 'ShadowRunner', 22));
        const guild = escapeXml(truncate((req.query.guild || 'GAMERS LATAM').toUpperCase(), 26));
        const remaining = escapeXml(String(req.query.remaining || '849'));

        sendSvg(res, `<svg xmlns="http://www.w3.org/2000/svg" width="760" height="240" viewBox="0 0 760 240">
  ${cardChrome(t, 760, 240, accent)}
  ${avatarCircle('none', 110, 130, 48, initialsOf(req.query.username || 'ShadowRunner'), accent)}
  <text x="190" y="105" font-family="ui-monospace, monospace" font-size="13" font-weight="700" letter-spacing="3" fill="${accent}">SALIÓ DE ${guild}</text>
  <text x="190" y="148" font-family="ui-sans-serif, system-ui, sans-serif" font-size="34" font-weight="800" fill="${t.fg}">${username}</text>
  <text x="190" y="182" font-family="ui-sans-serif, system-ui, sans-serif" font-size="15" fill="${t.dim}">Quedan <tspan font-weight="700" fill="${t.fg}">${remaining}</tspan> miembros en el servidor.</text>
</svg>`, 3600);
      }
    },
    {
      name: 'Profile Card',
      path: '/api/canvas/profile',
      method: 'GET',
      description: 'Tarjeta de perfil con avatar de /assets (o URL), rol, insignia de verificado y barra de nivel.',
      responseType: 'image',
      params: [
        { name: 'username', type: 'string', required: true, example: 'LyanValentin', description: 'Nombre de usuario' },
        { name: 'role', type: 'string', required: false, example: 'Backend Developer', description: 'Rol o título' },
        { name: 'level', type: 'number', required: false, example: '42', description: 'Nivel (1-99)' },
        { name: 'xp', type: 'number', required: false, example: '68', description: 'Progreso de XP 0-100' },
        { name: 'avatar', type: 'select', options: ['ana', 'marco', 'cat', 'none'], required: false, example: 'marco', description: 'Avatar de /assets' },
        { name: 'verified', type: 'select', options: ['true', 'false'], required: false, example: 'true', description: 'Mostrar insignia de verificado' },
        { name: 'theme', type: 'select', options: ['light', 'dark'], required: false, example: 'light', description: 'Tema' },
        { name: 'accent', type: 'string', required: false, example: '#0ea5e9', description: 'Acento hex' }
      ],
      handler: async (req, res) => {
        const t = CARD_THEMES[req.query.theme === 'dark' ? 'dark' : 'light'];
        const accent = hexColor(req.query.accent, '#0ea5e9');
        const username = escapeXml(truncate(req.query.username || 'Developer', 20));
        const role = escapeXml(truncate(req.query.role || 'Backend Developer', 30));
        const level = clamp(parseInt(req.query.level, 10) || 1, 1, 99);
        const xp = clamp(parseInt(req.query.xp, 10) || 50, 0, 100);
        const verified = req.query.verified !== 'false';
        const nameW = textWidth(req.query.username || 'Developer', 30);

        sendSvg(res, `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="300" viewBox="0 0 720 300">
  ${cardChrome(t, 720, 300, accent)}
  ${avatarCircle(req.query.avatar || 'none', 110, 140, 58, initialsOf(req.query.username || 'Developer'), accent)}
  <text x="200" y="125" font-family="ui-sans-serif, system-ui, sans-serif" font-size="30" font-weight="800" fill="${t.fg}">${username}</text>
  ${verified ? `<g style="color:${accent}">${assets.inlineSvg('cards/badge-verified.svg', 200 + nameW + 14, 101, 26, 26)}</g>` : ''}
  <text x="200" y="156" font-family="ui-sans-serif, system-ui, sans-serif" font-size="16" fill="${t.dim}">${role}</text>
  <text x="200" y="216" font-family="ui-monospace, monospace" font-size="13" font-weight="700" fill="${t.dim}">NIVEL ${level}</text>
  <text x="660" y="216" font-family="ui-monospace, monospace" font-size="13" font-weight="700" fill="${accent}" text-anchor="end">${xp}/100 XP</text>
  <rect x="200" y="228" width="460" height="10" rx="5" fill="${t.border}"/>
  <rect x="200" y="228" width="${Math.round(460 * xp / 100)}" height="10" rx="5" fill="${accent}"/>
</svg>`, 3600);
      }
    },
    {
      name: 'Tweet Card',
      path: '/api/canvas/tweet',
      method: 'GET',
      description: 'Réplica limpia de un tweet/post para citas y capturas, con avatar y verificado.',
      responseType: 'image',
      params: [
        { name: 'name', type: 'string', required: false, example: 'Lyan Valentin', description: 'Nombre visible' },
        { name: 'handle', type: 'string', required: false, example: 'lyan_dev', description: 'Usuario @' },
        { name: 'text', type: 'string', required: true, example: 'Ship it today 🚀', description: 'Texto del tweet' },
        { name: 'likes', type: 'number', required: false, example: '1200', description: 'Me gusta' },
        { name: 'retweets', type: 'number', required: false, example: '340', description: 'Reposts' },
        { name: 'avatar', type: 'select', options: ['ana', 'marco', 'cat', 'none'], required: false, example: 'ana', description: 'Avatar de /assets' },
        { name: 'theme', type: 'select', options: ['light', 'dark'], required: false, example: 'light', description: 'Tema' }
      ],
      handler: async (req, res) => {
        const t = CARD_THEMES[req.query.theme === 'dark' ? 'dark' : 'light'];
        const name = escapeXml(truncate(req.query.name || 'Lyan Valentin', 26));
        const handle = escapeXml(truncate(String(req.query.handle || 'lyan_dev').replace(/^@/, ''), 20));
        const lines = wrapText(req.query.text || 'Ship it today 🚀', 600, 19, 6);
        const h = 150 + lines.length * 27;
        const fmt = n => Number(n) >= 1000 ? `${(Number(n) / 1000).toFixed(1)}K` : String(n || 0);

        sendSvg(res, `<svg xmlns="http://www.w3.org/2000/svg" width="680" height="${h}" viewBox="0 0 680 ${h}">
  ${cardChrome(t, 680, h, '#1d9bf0', false)}
  ${avatarCircle(req.query.avatar || 'none', 70, 78, 30, initialsOf(req.query.name || 'Lyan Valentin'), '#1d9bf0')}
  <text x="116" y="70" font-family="ui-sans-serif, system-ui, sans-serif" font-size="18" font-weight="800" fill="${t.fg}">${name}</text>
  <g style="color:#1d9bf0">${assets.inlineSvg('cards/badge-verified.svg', 116 + textWidth(req.query.name || 'Lyan Valentin', 18) + 8, 55, 18, 18)}</g>
  <text x="116" y="92" font-family="ui-sans-serif, system-ui, sans-serif" font-size="15" fill="${t.dim}">@${handle}</text>
  ${lines.map((l, i) => `<text x="44" y="${136 + i * 27}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="19" fill="${t.fg}">${escapeXml(l)}</text>`).join('\n  ')}
  <text x="44" y="${h - 34}" font-family="ui-monospace, monospace" font-size="13" fill="${t.dim}">♥ ${fmt(req.query.likes)}   ↻ ${fmt(req.query.retweets)}   ↩ Reply</text>
</svg>`, 3600);
      }
    },
    {
      name: 'Certificate Card',
      path: '/api/canvas/certificate',
      method: 'GET',
      description: 'Certificado elegante con doble marco, insignia de verificado y firma.',
      responseType: 'image',
      params: [
        { name: 'name', type: 'string', required: true, example: 'Lyan Valentin', description: 'Nombre certificado' },
        { name: 'title', type: 'string', required: false, example: 'REST API Development', description: 'Concepto del certificado' },
        { name: 'date', type: 'string', required: false, example: '2026-10-10', description: 'Fecha de emisión' },
        { name: 'accent', type: 'string', required: false, example: '#b8860b', description: 'Color del sello (hex)' }
      ],
      handler: async (req, res) => {
        const t = CARD_THEMES.light;
        const accent = hexColor(req.query.accent, '#b8860b');
        const name = escapeXml(truncate(req.query.name || 'Lyan Valentin', 30));
        const title = escapeXml(truncate(req.query.title || 'REST API Development', 40));
        const date = escapeXml(String(req.query.date || new Date().toISOString().slice(0, 10)));

        sendSvg(res, `<svg xmlns="http://www.w3.org/2000/svg" width="860" height="560" viewBox="0 0 860 560">
  <rect width="860" height="560" rx="20" fill="#fbfaf7"/>
  <rect x="26" y="26" width="808" height="508" rx="12" fill="none" stroke="${accent}" stroke-width="2"/>
  <rect x="38" y="38" width="784" height="484" rx="8" fill="none" stroke="${accent}" stroke-width="1" opacity="0.5"/>
  <g opacity="0.35" style="color:${accent}">${assets.inlineSvg('cards/pattern-dots.svg', 52, 52, 96, 96)}</g>
  <g opacity="0.35" style="color:${accent}">${assets.inlineSvg('cards/pattern-dots.svg', 712, 412, 96, 96)}</g>
  <text x="430" y="140" font-family="ui-monospace, monospace" font-size="15" font-weight="700" letter-spacing="6" fill="${accent}" text-anchor="middle">CERTIFICADO DE FINALIZACIÓN</text>
  <text x="430" y="196" font-family="ui-sans-serif, system-ui, sans-serif" font-size="17" fill="${t.dim}" text-anchor="middle">Se otorga a</text>
  <text x="430" y="262" font-family="Georgia, 'Times New Roman', serif" font-size="52" font-weight="700" fill="${t.fg}" text-anchor="middle">${name}</text>
  <line x1="240" y1="286" x2="620" y2="286" stroke="${accent}" stroke-width="1.5"/>
  <text x="430" y="330" font-family="ui-sans-serif, system-ui, sans-serif" font-size="18" fill="${t.dim}" text-anchor="middle">por completar con éxito <tspan font-weight="700" fill="${t.fg}">${title}</tspan></text>
  <g style="color:${accent}">${assets.inlineSvg('cards/badge-verified.svg', 398, 366, 64, 64)}</g>
  <text x="430" y="470" font-family="ui-monospace, monospace" font-size="14" fill="${t.dim}" text-anchor="middle">${date} · API CONSOLE</text>
</svg>`, 3600);
      }
    },
    {
      name: 'Quote Card',
      path: '/api/canvas/quote-card',
      method: 'GET',
      description: 'Tarjeta de cita con comillas tipográficas, autor y acento.',
      responseType: 'image',
      params: [
        { name: 'quote', type: 'string', required: true, example: 'Hazlo simple, pero significativo.', description: 'La cita' },
        { name: 'author', type: 'string', required: false, example: 'Don Draper', description: 'Autor' },
        { name: 'theme', type: 'select', options: ['light', 'dark'], required: false, example: 'dark', description: 'Tema' },
        { name: 'accent', type: 'string', required: false, example: '#8ACE00', description: 'Acento hex' }
      ],
      handler: async (req, res) => {
        const t = CARD_THEMES[req.query.theme === 'dark' ? 'dark' : 'light'];
        const accent = hexColor(req.query.accent, '#8ACE00');
        const lines = wrapText(req.query.quote || 'Hazlo simple, pero significativo.', 560, 26, 5);
        const author = escapeXml(truncate(req.query.author || 'Anónimo', 30));
        const h = 210 + lines.length * 36;

        sendSvg(res, `<svg xmlns="http://www.w3.org/2000/svg" width="680" height="${h}" viewBox="0 0 680 ${h}">
  ${cardChrome(t, 680, h, accent, false)}
  <text x="44" y="110" font-family="Georgia, serif" font-size="110" fill="${accent}" opacity="0.9">“</text>
  ${lines.map((l, i) => `<text x="56" y="${150 + i * 36}" font-family="Georgia, 'Times New Roman', serif" font-size="26" font-style="italic" fill="${t.fg}">${escapeXml(l)}</text>`).join('\n  ')}
  <rect x="56" y="${h - 74}" width="42" height="3" fill="${accent}"/>
  <text x="56" y="${h - 44}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="17" font-weight="700" fill="${t.dim}">— ${author}</text>
</svg>`, 3600);
      }
    },
    {
      name: 'Code Snap',
      path: '/api/canvas/code-snap',
      method: 'GET',
      description: 'Captura de código estilo editor con semáforo, título y lenguaje.',
      responseType: 'image',
      params: [
        { name: 'code', type: 'string', required: true, example: 'const api = await fetch("/api/endpoints");', description: 'Código (usa | para saltos de línea)' },
        { name: 'title', type: 'string', required: false, example: 'server.js', description: 'Nombre del archivo' },
        { name: 'lang', type: 'string', required: false, example: 'js', description: 'Lenguaje (etiqueta)' }
      ],
      handler: async (req, res) => {
        const lines = String(req.query.code || 'console.log("hola")').split(/\n|\|/).map(l => l.trimEnd()).slice(0, 14);
        const title = escapeXml(truncate(req.query.title || 'snippet.js', 30));
        const lang = escapeXml(String(req.query.lang || 'js').toUpperCase().slice(0, 10));
        const h = 96 + lines.length * 26 + 34;

        sendSvg(res, `<svg xmlns="http://www.w3.org/2000/svg" width="740" height="${h}" viewBox="0 0 740 ${h}">
  <rect width="740" height="${h}" rx="14" fill="#0d1117"/>
  <rect x="0.5" y="0.5" width="739" height="${h - 1}" rx="13.5" fill="none" stroke="#232830"/>
  <circle cx="30" cy="32" r="6" fill="#ff5f57"/><circle cx="52" cy="32" r="6" fill="#febc2e"/><circle cx="74" cy="32" r="6" fill="#28c840"/>
  <text x="370" y="37" font-family="ui-monospace, monospace" font-size="13" fill="#8b949e" text-anchor="middle">${title}</text>
  <line x1="0" y1="62" x2="740" y2="62" stroke="#232830"/>
  ${lines.map((l, i) => `<text x="28" y="${96 + i * 26}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="15" fill="#e6edf3"><tspan fill="#6e7681">${String(i + 1).padStart(2, ' ')}  </tspan>${escapeXml(l.slice(0, 78))}</text>`).join('\n  ')}
  <text x="712" y="${h - 16}" font-family="ui-monospace, monospace" font-size="12" fill="#8ACE00" text-anchor="end">${lang}</text>
</svg>`, 3600);
      }
    },
    {
      name: 'IQ Check Card',
      path: '/api/canvas/iq-card',
      method: 'GET',
      description: 'Tarjeta de IQ Check (puntaje, percentil y clasificación) con diseño limpio. Solo entretenimiento.',
      responseType: 'image',
      params: [
        { name: 'name', type: 'string', required: false, example: 'Lyan Valentin', description: 'Nombre evaluado' },
        { name: 'score', type: 'number', required: false, example: '128', description: 'Puntaje IQ (60-160)' },
        { name: 'theme', type: 'select', options: ['light', 'dark'], required: false, example: 'light', description: 'Tema' },
        { name: 'accent', type: 'string', required: false, example: '#0ea5e9', description: 'Acento hex' }
      ],
      handler: async (req, res) => {
        const t = CARD_THEMES[req.query.theme === 'dark' ? 'dark' : 'light'];
        const accent = hexColor(req.query.accent, '#0ea5e9');
        const name = escapeXml(truncate(req.query.name || 'Lyan Valentin', 26));
        const score = clamp(parseInt(req.query.score, 10) || 128, 60, 160);
        const percentile = clamp(((score - 70) / 80) * 100, 1, 99.9);
        const tier = score >= 130 ? 'GENIO' : score >= 120 ? 'SUPERDOTADO' : score >= 110 ? 'SOBRE LA MEDIA' : score >= 100 ? 'PROMEDIO' : 'EN DESARROLLO';
        const barW = Math.round(((score - 60) / 100) * 560);

        sendSvg(res, `<svg xmlns="http://www.w3.org/2000/svg" width="680" height="360" viewBox="0 0 680 360">
  ${cardChrome(t, 680, 360, accent, false)}
  <text x="60" y="86" font-family="ui-monospace, monospace" font-size="13" font-weight="700" letter-spacing="4" fill="${accent}">IQ CHECK · ENTRETENIMIENTO</text>
  <text x="60" y="130" font-family="ui-sans-serif, system-ui, sans-serif" font-size="20" font-weight="700" fill="${t.fg}">${name}</text>
  <text x="620" y="150" font-family="ui-sans-serif, system-ui, sans-serif" font-size="88" font-weight="800" fill="${accent}" text-anchor="end">${score}</text>
  <text x="60" y="196" font-family="ui-monospace, monospace" font-size="14" font-weight="700" fill="${t.dim}">CLASIFICACIÓN: ${tier}</text>
  <rect x="60" y="230" width="560" height="12" rx="6" fill="${t.border}"/>
  <rect x="60" y="230" width="${barW}" height="12" rx="6" fill="${accent}"/>
  <circle cx="${60 + barW}" cy="236" r="9" fill="${t.card}" stroke="${accent}" stroke-width="3"/>
  <text x="60" y="276" font-family="ui-monospace, monospace" font-size="13" fill="${t.dim}">60</text>
  <text x="620" y="276" font-family="ui-monospace, monospace" font-size="13" fill="${t.dim}" text-anchor="end">160</text>
  <text x="60" y="316" font-family="ui-sans-serif, system-ui, sans-serif" font-size="15" fill="${t.dim}">Percentil <tspan font-weight="700" fill="${accent}">${percentile.toFixed(1)}%</tspan> · no es una evaluación clínica.</text>
</svg>`, 3600);
      }
    },
    {
      name: 'Captcha Card',
      path: '/api/canvas/captcha',
      method: 'GET',
      description: 'Imagen captcha SVG con ruido, líneas y código configurable (o aleatorio determinista por seed).',
      responseType: 'image',
      params: [
        { name: 'code', type: 'string', required: false, example: 'API2026', description: 'Código a mostrar (6-8 caracteres)' },
        { name: 'seed', type: 'string', required: false, example: 'lyan', description: 'Semilla para código aleatorio' }
      ],
      handler: async (req, res) => {
        const seed = seedFrom(req.query.seed || req.query.code || 'api');
        let code = String(req.query.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
        if (!code) {
          const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
          code = Array.from({ length: 6 }, (_, i) => alphabet[(seed >> (i * 4)) % alphabet.length]).join('');
        }
        const chars = code.split('').map((c, i) => {
          const rot = ((seed >> (i * 3)) % 21) - 10;
          const dy = ((seed >> (i * 2)) % 12) - 6;
          return `<text x="${70 + i * 56}" y="${96 + dy}" font-family="ui-monospace, monospace" font-size="46" font-weight="800" fill="#17181a" text-anchor="middle" transform="rotate(${rot} ${70 + i * 56} ${96})">${c}</text>`;
        }).join('\n  ');
        const linesNoise = Array.from({ length: 4 }, (_, i) => {
          const y1 = 40 + ((seed >> (i * 5)) % 80); const y2 = 40 + ((seed >> (i * 7)) % 80);
          return `<path d="M20 ${y1} C 160 ${y2}, 300 ${y1}, 460 ${y2}" stroke="#8ACE00" stroke-width="2" fill="none" opacity="0.5"/>`;
        }).join('\n  ');

        sendSvg(res, `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="150" viewBox="0 0 480 150">
  <rect width="480" height="150" rx="14" fill="#ffffff"/>
  <rect x="0.5" y="0.5" width="479" height="149" rx="13.5" fill="none" stroke="#e6e4df"/>
  <g style="color:#9aa0a8">${assets.inlineSvg('cards/pattern-dots.svg', 0, 0, 480, 150)}</g>
  ${linesNoise}
  ${chars}
</svg>`, 0);
      }
    },
    {
      name: 'Level Up Card',
      path: '/api/canvas/level-up',
      method: 'GET',
      description: 'Tarjeta de subida de nivel estilo juego.',
      responseType: 'image',
      params: [
        { name: 'username', type: 'string', required: true, example: 'ProGamer', description: 'Nombre de usuario' },
        { name: 'level', type: 'number', required: false, example: '42', description: 'Nivel alcanzado' },
        { name: 'accent', type: 'string', required: false, example: '#f5c518', description: 'Color de acento' }
      ],
      handler: async (req, res) => {
        const accent = hexColor(req.query.accent, '#f5c518');
        const username = escapeXml(truncate(req.query.username || 'ProGamer', 22));
        const level = parseInt(req.query.level, 10) || 42;
        sendSvg(res, `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="260" viewBox="0 0 640 260">
  ${cardChrome(CARD_THEMES.dark, 640, 260, accent)}
  <text x="320" y="80" font-family="ui-monospace,monospace" font-size="14" font-weight="700" letter-spacing="4" fill="${accent}" text-anchor="middle">LEVEL UP</text>
  <text x="320" y="150" font-family="ui-sans-serif,system-ui" font-size="64" font-weight="900" fill="#ffffff" text-anchor="middle">${level}</text>
  <text x="320" y="198" font-family="ui-sans-serif,system-ui" font-size="18" fill="#9aa0a8" text-anchor="middle">¡Felicidades, ${username}!</text>
</svg>`, 3600);
      }
    },
    {
      name: 'Security Card',
      path: '/api/canvas/security',
      method: 'GET',
      description: 'Tarjeta de alerta/seguridad.',
      responseType: 'image',
      params: [
        { name: 'title', type: 'string', required: false, example: 'Acceso denegado', description: 'Título' },
        { name: 'text', type: 'string', required: false, example: 'No tienes permiso para realizar esta acción.', description: 'Mensaje' }
      ],
      handler: async (req, res) => {
        const title = escapeXml(truncate(req.query.title || 'Acceso denegado', 30));
        const text = escapeXml(truncate(req.query.text || 'No tienes permiso para realizar esta acción.', 100));
        sendSvg(res, `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200" viewBox="0 0 600 200">
  <rect width="600" height="200" rx="14" fill="#1c1010"/>
  <rect x="0.5" y="0.5" width="599" height="199" rx="13.5" fill="none" stroke="#3a1f1f"/>
  <circle cx="60" cy="100" r="30" fill="#e5484d" opacity="0.2"/>
  <text x="60" y="112" font-size="38" text-anchor="middle">⚠</text>
  <text x="120" y="85" font-family="ui-sans-serif,system-ui" font-size="24" font-weight="800" fill="#ff8080">${title}</text>
  <text x="120" y="125" font-family="ui-sans-serif,system-ui" font-size="16" fill="#d89b9b">${text}</text>
</svg>`, 3600);
      }
    },
    {
      name: 'Spotify Card',
      path: '/api/canvas/spotify',
      method: 'GET',
      description: 'Tarjeta estilo reproductor de Spotify.',
      responseType: 'image',
      params: [
        { name: 'song', type: 'string', required: false, example: 'Bohemian Rhapsody', description: 'Canción' },
        { name: 'artist', type: 'string', required: false, example: 'Queen', description: 'Artista' },
        { name: 'accent', type: 'string', required: false, example: '#1DB954', description: 'Color Spotify' }
      ],
      handler: async (req, res) => {
        const accent = hexColor(req.query.accent, '#1DB954');
        const song = escapeXml(truncate(req.query.song || 'Bohemian Rhapsody', 30));
        const artist = escapeXml(truncate(req.query.artist || 'Queen', 28));
        sendSvg(res, `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="160" viewBox="0 0 500 160">
  <rect width="500" height="160" rx="14" fill="#000"/>
  <rect x="20" y="20" width="120" height="120" rx="6" fill="${accent}"/>
  <text x="80" y="90" font-size="46" text-anchor="middle">♫</text>
  <text x="160" y="70" font-family="ui-sans-serif,system-ui" font-size="22" font-weight="800" fill="#ffffff">${song}</text>
  <text x="160" y="100" font-family="ui-sans-serif,system-ui" font-size="15" fill="#b3b3b3">${artist}</text>
  <rect x="160" y="120" width="300" height="4" rx="2" fill="#4d4d4d"/>
  <rect x="160" y="120" width="180" height="4" rx="2" fill="#ffffff"/>
  <circle cx="340" cy="122" r="7" fill="#ffffff"/>
</svg>`, 3600);
      }
    },
    {
      name: 'Delete Image (efecto papel roto)',
      path: '/api/canvas/delete',
      method: 'GET',
      description: 'Imagen con tachadura de "eliminado".',
      responseType: 'image',
      params: [
        { name: 'text', type: 'string', required: false, example: 'Archivo obsoleto', description: 'Texto' }
      ],
      handler: async (req, res) => {
        const text = escapeXml(truncate(req.query.text || 'ELIMINADO', 24));
        sendSvg(res, `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="120" viewBox="0 0 480 120">
  <rect width="480" height="120" rx="12" fill="#f7f7f5"/>
  <text x="240" y="75" font-family="ui-sans-serif,system-ui" font-size="38" font-weight="900" fill="#c0392b" text-anchor="middle" text-decoration="line-through" text-decoration-thickness="6">${text}</text>
</svg>`, 3600);
      }
    }
  ]
};
