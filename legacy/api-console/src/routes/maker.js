/**
 * Categoría: MAKER (3 endpoints)
 * Generadores de imágenes fieles a sus referentes:
 *  - BRAT: réplica del estilo de bratgenerator.com (fondo #8ACE00, Arial Narrow en
 *    minúsculas, estirado y con blur calibrado, multi-línea, ratios 1:1 / 9:16 / 4:3).
 *  - IQC:  iPhone Quoted Chat, captura SVG realista de iMessage con avatar,
 *    Dynamic Island, cita de respuesta, tapback, temas y wallpapers de /assets.
 *  - NEON: letrero de neón sobre pared oscura.
 */

const { escapeXml, sendSvg, hexColor, clamp, textWidth, wrapText, initialsOf } = require('../lib/util');
const assets = require('../lib/assets');

/* ==========================================================================
   MOTOR BRAT — https://www.bratgenerator.com/
   brat green #8ACE00 · Arial Narrow en minúsculas · stretch + blur suave.
   ========================================================================== */

const BRAT_GREEN = '#8ACE00';

const BRAT_PRESETS = {
  green:  { bg: BRAT_GREEN, fg: '#000000' },
  white:  { bg: '#FFFFFF', fg: '#000000' },
  black:  { bg: '#0A0A0A', fg: BRAT_GREEN },
  pink:   { bg: '#FF69B4', fg: '#000000' },
  blue:   { bg: '#00CED1', fg: '#000000' }
};

function bratColors(query) {
  const preset = BRAT_PRESETS[(query.theme || 'green').toLowerCase()] || BRAT_PRESETS.green;
  return {
    bg: hexColor(query.bg, preset.bg),
    fg: hexColor(query.color || query.fg, preset.fg)
  };
}

function bratLines(raw) {
  return String(raw || 'brat')
    .replace(/\r/g, '')
    .split(/\n|\|/)
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 5)
    .map(s => s.toLowerCase());
}

function bratSvg({ lines, bg, fg, blur, stretch, ratio }) {
  const dims = ratio === 'story' ? { w: 1080, h: 1920 }
    : ratio === 'post' ? { w: 1080, h: 1350 }
    : { w: 1000, h: 1000 };

  // Auto-ajuste: la línea más larga debe caber en ~82% del ancho (contando stretch).
  const widest = Math.max(...lines.map(l => textWidth(l, 100)), 1);
  const avail = (dims.w * 0.82) / stretch;
  let fontSize = clamp((avail / widest) * 100, 48, dims.h * 0.2);
  const lineHeight = fontSize * 1.14;
  const topY = dims.h / 2 - (lineHeight * (lines.length - 1)) / 2 + fontSize * 0.35;
  const cx = dims.w / 2;

  const filterDef = blur > 0
    ? `<filter id="bratBlur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${blur}"/></filter>`
    : '';
  const filterAttr = blur > 0 ? ' filter="url(#bratBlur)"' : '';

  const textEls = lines.map((line, i) =>
    `<text x="0" y="${(i * lineHeight).toFixed(1)}" font-family="'Arial Narrow', Arial, 'Helvetica Neue', sans-serif" font-weight="700" font-size="${fontSize.toFixed(1)}" fill="${fg}" text-anchor="middle" letter-spacing="-1">${escapeXml(line)}</text>`
  ).join('\n    ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${dims.w}" height="${dims.h}" viewBox="0 0 ${dims.w} ${dims.h}">
  <defs>${filterDef}</defs>
  <rect width="${dims.w}" height="${dims.h}" fill="${bg}"/>
  <g transform="translate(${cx}, ${topY.toFixed(1)}) scale(${stretch}, 1)"${filterAttr}>
    ${textEls}
  </g>
</svg>`;
}

/* ==========================================================================
   MOTOR IQC — iPhone Quoted Chat
   ========================================================================== */

const IQC_THEMES = {
  dark: {
    chatBg: '#000000', header: 'rgba(12,12,14,0.92)', headerBorder: '#232326',
    textMain: '#ffffff', textDim: '#8e8e93',
    bubbleIn: '#26252b', bubbleInText: '#ffffff', bubbleOut: '#0a84ff', bubbleOutText: '#ffffff',
    quoteBar: '#7aa5ff', quoteName: '#8ab4ff', quoteText: '#b3b3b8',
    accent: '#0a84ff', statusBar: '#ffffff', inputBg: '#1c1c1e', wallpaper: 'iqc/wallpapers/wp-aurora.svg'
  },
  light: {
    chatBg: '#ffffff', header: 'rgba(247,247,248,0.94)', headerBorder: '#d8d8dc',
    textMain: '#000000', textDim: '#8e8e93',
    bubbleIn: '#e5e5ea', bubbleInText: '#000000', bubbleOut: '#007aff', bubbleOutText: '#ffffff',
    quoteBar: '#0a84ff', quoteName: '#0a84ff', quoteText: '#6b6b70',
    accent: '#007aff', statusBar: '#000000', inputBg: '#e9e9ec', wallpaper: 'iqc/wallpapers/wp-dawn.svg'
  }
};

const AVATAR_RASTER = { ana: 'iqc/avatars/avatar-ana.jpg', marco: 'iqc/avatars/avatar-marco.jpg', cat: 'iqc/avatars/avatar-cat.jpg' };
const AVATAR_VECTOR = { lila: 'iqc/avatars/ava-lila.svg', theo: 'iqc/avatars/ava-theo.svg', mia: 'iqc/avatars/ava-mia.svg', bot: 'iqc/avatars/ava-bot.svg' };

function iqcAvatar(key, cx, cy, r, fallbackInitials, accent) {
  const d = r * 2;
  const x = cx - r; const y = cy - r;
  if (key === 'none') {
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${accent}" opacity="0.2"/><text x="${cx}" y="${cy + r * 0.35}" font-family="-apple-system, Helvetica, Arial" font-size="${r}" font-weight="700" fill="${accent}" text-anchor="middle">${escapeXml(fallbackInitials)}</text>`;
  }
  if (AVATAR_RASTER[key]) {
    return `<image x="${x}" y="${y}" width="${d}" height="${d}" preserveAspectRatio="xMidYMid slice" href="${assets.dataUri(AVATAR_RASTER[key])}"/>`;
  }
  if (AVATAR_VECTOR[key]) {
    return assets.inlineSvg(AVATAR_VECTOR[key], x, y, d, d);
  }
  if (/^https?:\/\//i.test(key)) {
    return `<image x="${x}" y="${y}" width="${d}" height="${d}" preserveAspectRatio="xMidYMid slice" href="${escapeXml(key)}"/>`;
  }
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${accent}" opacity="0.2"/><text x="${cx}" y="${cy + r * 0.35}" font-family="-apple-system, Helvetica, Arial" font-size="${r}" font-weight="700" fill="${accent}" text-anchor="middle">${escapeXml(fallbackInitials)}</text>`;
}

function iqcSvg(o) {
  const p = IQC_THEMES[o.theme] || IQC_THEMES.dark;
  const W = 390; const H = 844;

  // ---- Métricas de burbujas ----
  const maxOut = 268; const maxIn = 268;
  const hasQuote = Boolean(o.replyTo && o.replyText);
  const outLines = wrapText(o.text, maxOut - 32, 17, 6);
  const quoteLines = hasQuote ? wrapText(o.replyText, maxOut - 64, 13, 2) : [];
  const quoteRectH = hasQuote ? 16 + quoteLines.length * 15 + 8 : 0;
  const quoteH = hasQuote ? quoteRectH + 10 : 0; // rect + margen inferior
  const textStartY = 12 + quoteH + 16; // pad + cita + ascender
  const outH = textStartY + (outLines.length - 1) * 22 + 6 + 12;
  const outW = Math.max(
    ...outLines.map(l => textWidth(l, 17)),
    hasQuote ? Math.max(...quoteLines.map((l, i) => textWidth((i === 0 ? `${o.replyTo} ` : '') + l, 13))) + 24 : 0,
    90
  ) + 32;

  const inLines = o.incoming ? wrapText(o.incoming, maxIn - 32, 17, 4) : null;
  const inH = o.incoming ? 20 + inLines.length * 22 : 0;
  const inW = o.incoming ? Math.max(...inLines.map(l => textWidth(l, 17)), 60) + 32 : 0;

  let cursorY = 206;
  let inY = 0;
  if (o.incoming) { inY = cursorY; cursorY += inH + 10; }
  const outY = cursorY;
  const statusY = outY + outH + 22;

  const outX = W - 14 - outW;
  const inX = 14;

  // ---- Fragmentos ----
  const quoteBlock = hasQuote ? `
    <rect x="16" y="12" width="${outW - 32}" height="${quoteRectH}" rx="7" fill="#ffffff" opacity="0.14"/>
    <rect x="16" y="12" width="3" height="${quoteRectH}" rx="1.5" fill="${p.quoteBar}"/>
    ${quoteLines.map((l, i) => `<text x="27" y="${28 + i * 15}" font-family="-apple-system, Helvetica, Arial" font-size="13" fill="${p.quoteText}">${i === 0 ? `<tspan font-weight="700" fill="${p.quoteName}">${escapeXml(o.replyTo)}</tspan> ${escapeXml(l)}` : escapeXml(l)}</text>`).join('\n    ')}` : '';

  const outText = outLines.map((l, i) =>
    `<text x="16" y="${textStartY + i * 22}" font-family="-apple-system, 'SF Pro Text', Helvetica, Arial" font-size="17" fill="${p.bubbleOutText}">${escapeXml(l)}</text>`
  ).join('\n    ');

  const inText = o.incoming ? inLines.map((l, i) =>
    `<text x="16" y="${21 + i * 22}" font-family="-apple-system, 'SF Pro Text', Helvetica, Arial" font-size="17" fill="${p.bubbleInText}">${escapeXml(l)}</text>`
  ).join('\n    ') : '';

  const tapbackMap = { heart: '❤️', like: '👍', laugh: '😂', warn: '‼️' };
  const tapback = tapbackMap[o.tapback] || '';

  const batteryFill = Math.round(22 * o.battery / 100);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W * o.scale}" height="${H * o.scale}" viewBox="0 0 ${W} ${H}">
  <defs>
    <clipPath id="phone"><rect width="${W}" height="${H}" rx="54"/></clipPath>
    <clipPath id="avaClip"><circle cx="${W / 2}" cy="98" r="20"/></clipPath>
    <clipPath id="avaInClip"><circle cx="32" cy="${inY + inH / 2}" r="14"/></clipPath>
  </defs>

  <g clip-path="url(#phone)">
    <!-- Wallpaper -->
    <rect width="${W}" height="${H}" fill="${p.chatBg}"/>
    ${o.wallpaper ? assets.inlineSvg(p.wallpaper, 0, 0, W, H) : ''}

    <!-- Barra de estado -->
    <text x="36" y="47" font-family="-apple-system, 'SF Pro Display', Helvetica, Arial" font-size="16" font-weight="700" fill="${p.statusBar}">${escapeXml(o.time)}</text>
    <g transform="translate(292, 32)" fill="${p.statusBar}">
      <rect x="0" y="12" width="3.6" height="6" rx="1"/><rect x="6" y="8" width="3.6" height="10" rx="1"/><rect x="12" y="4" width="3.6" height="14" rx="1"/><rect x="18" y="0" width="3.6" height="18" rx="1"/>
      <text x="26" y="16" font-family="-apple-system, Helvetica, Arial" font-size="12" font-weight="700" fill="${p.statusBar}">${escapeXml(o.network)}</text>
      <path d="M52 13 a11 11 0 0 1 16 0 l-8 9 z" opacity="0.95"/>
      <path d="M54.8 6 a18 18 0 0 1 20.4 0" fill="none" stroke="${p.statusBar}" stroke-width="2.4" stroke-linecap="round"/>
      <rect x="78" y="3" width="24" height="12" rx="3.6" fill="none" stroke="${p.statusBar}" stroke-width="1.4" opacity="0.5"/>
      <rect x="80" y="5" width="${batteryFill}" height="8" rx="2" fill="${p.statusBar}"/>
      <rect x="103" y="6.4" width="2.2" height="5" rx="1.1" fill="${p.statusBar}" opacity="0.5"/>
    </g>

    <!-- Dynamic Island -->
    <rect x="146" y="18" width="128" height="34" rx="17" fill="#000000"/>
    <circle cx="252" cy="35" r="6" fill="#0d1b2a"/><circle cx="252" cy="35" r="2.8" fill="#1d3557"/>

    <!-- Cabecera -->
    <rect x="0" y="64" width="${W}" height="76" fill="${p.header}"/>
    <line x1="0" y1="140" x2="${W}" y2="140" stroke="${p.headerBorder}" stroke-width="1"/>
    <path d="M28 88 l-11 12 l11 12" fill="none" stroke="${p.accent}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    <g clip-path="url(#avaClip)">${iqcAvatar(o.avatar, W / 2, 98, 20, initialsOf(o.contact), p.accent)}</g>
    <circle cx="${W / 2}" cy="98" r="20" fill="none" stroke="${p.headerBorder}" stroke-width="1"/>
    <text x="${W / 2}" y="132" font-family="-apple-system, 'SF Pro Text', Helvetica, Arial" font-size="13" font-weight="600" fill="${p.textMain}" text-anchor="middle">${escapeXml(o.contact)}</text>
    <path d="M${W / 2 + textWidth(o.contact, 13) / 2 + 8} 128 l4 4 l4 -4" fill="none" stroke="${p.textDim}" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M352 92 h20 M352 100 h20 M352 108 h20" stroke="${p.accent}" stroke-width="2.4" stroke-linecap="round" transform="rotate(90 362 100)"/>

    <!-- Separador de día -->
    <text x="${W / 2}" y="172" font-family="-apple-system, Helvetica, Arial" font-size="12" font-weight="600" fill="${p.textDim}" text-anchor="middle">Hoy ${escapeXml(o.time)}</text>

    ${o.incoming ? `
    <!-- Burbuja entrante -->
    <g transform="translate(${inX}, ${inY})">
      <rect width="${inW}" height="${inH}" rx="20" fill="${p.bubbleIn}"/>
      <path d="M2 ${inH - 2} q-3 3 -6 3 q5 2 9 0 z" fill="${p.bubbleIn}"/>
      ${inText}
    </g>` : ''}

    <!-- Burbuja saliente con cita -->
    <g transform="translate(${outX}, ${outY})">
      <rect width="${outW}" height="${outH}" rx="20" fill="${p.bubbleOut}"/>
      <path d="M${outW - 2} ${outH - 2} q3 3 6 3 q-5 2 -9 0 z" fill="${p.bubbleOut}"/>
      ${quoteBlock}
      ${outText}
    </g>

    ${tapback ? `
    <g transform="translate(${outX - 12}, ${outY - 14})">
      <rect width="42" height="30" rx="15" fill="${p.bubbleIn}"/>
      <text x="21" y="21" font-size="16" text-anchor="middle">${tapback}</text>
    </g>` : ''}

    <!-- Estado de entrega -->
    <text x="${W - 14}" y="${statusY}" font-family="-apple-system, Helvetica, Arial" font-size="11" font-weight="500" fill="${p.textDim}" text-anchor="end">${escapeXml(o.status)}</text>

    <!-- Barra de entrada -->
    <rect x="0" y="780" width="${W}" height="64" fill="${p.header}"/>
    <line x1="0" y1="780" x2="${W}" y2="780" stroke="${p.headerBorder}" stroke-width="1"/>
    <circle cx="34" cy="810" r="15" fill="${p.accent}"/>
    <path d="M34 803 v14 M27 810 h14" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round"/>
    <rect x="58" y="792" width="272" height="36" rx="18" fill="${p.inputBg}"/>
    <text x="76" y="815" font-family="-apple-system, Helvetica, Arial" font-size="15" fill="${p.textDim}">iMessage</text>
    <rect x="130" y="838" width="130" height="5" rx="2.5" fill="${p.statusBar}" opacity="0.5"/>
  </g>
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="53" fill="none" stroke="${p.headerBorder}" stroke-width="2"/>
</svg>`;
}

module.exports = {
  category: 'MAKER',
  description: 'Generadores de imágenes: Brat (fiel a bratgenerator.com), iPhone Quoted Chat (IQC) y letreros de neón.',
  endpoints: [
    {
      name: 'Brat Cover Generator',
      path: '/api/maker/brat',
      method: 'GET',
      description: 'Genera una portada estilo BRAT idéntica a bratgenerator.com: fondo #8ACE00, Arial Narrow en minúsculas con estirado y blur, multi-línea, 5 temas o colores hex propios y ratios 1:1, 9:16 y 4:3.',
      responseType: 'image',
      params: [
        { name: 'text', type: 'string', required: true, example: 'brat summer', description: 'Texto (minúsculas automático; usa | o saltos de línea para multi-línea)' },
        { name: 'theme', type: 'select', options: ['green', 'white', 'black', 'pink', 'blue'], required: false, example: 'green', description: 'Tema (green = brat original)' },
        { name: 'bg', type: 'string', required: false, example: '#8ACE00', description: 'Color de fondo hex (sobreescribe el tema)' },
        { name: 'color', type: 'string', required: false, example: '#000000', description: 'Color del texto hex' },
        { name: 'blur', type: 'number', required: false, example: '2', description: 'Blur tipográfico 0 - 8 (el álbum usa ~5-7 a tamaño completo)' },
        { name: 'stretch', type: 'number', required: false, example: '1.1', description: 'Estirado horizontal 0.6 - 1.6' },
        { name: 'ratio', type: 'select', options: ['square', 'story', 'post'], required: false, example: 'square', description: 'square 1000×1000 · story 1080×1920 · post 1080×1350' }
      ],
      handler: async (req, res) => {
        const { bg, fg } = bratColors(req.query);
        const blur = clamp(parseFloat(req.query.blur != null ? req.query.blur : '2') || 0, 0, 8);
        const stretch = clamp(parseFloat(req.query.stretch || '1.1') || 1, 0.6, 1.6);
        const ratio = ['square', 'story', 'post'].includes(req.query.ratio) ? req.query.ratio : 'square';
        const lines = bratLines(req.query.text || 'brat');
        sendSvg(res, bratSvg({ lines, bg, fg, blur, stretch, ratio }), 3600);
      }
    },
    {
      name: 'iPhone Quoted Chat (IQC)',
      path: '/api/maker/iqc',
      method: 'GET',
      description: 'Captura SVG realista de iMessage con avatar (de /assets o URL), Dynamic Island, mensaje citado de respuesta, burbuja entrante opcional, tapback, estado de entrega, temas dark/light y wallpapers.',
      responseType: 'image',
      params: [
        { name: 'name', type: 'string', required: false, example: 'Lyan Valentin', description: 'Nombre del contacto en la cabecera' },
        { name: 'text', type: 'string', required: true, example: 'Jajaja sí, la API ya está desplegada 🚀', description: 'Mensaje saliente principal' },
        { name: 'replyTo', type: 'string', required: false, example: 'Mamá', description: 'Autor del mensaje citado' },
        { name: 'replyText', type: 'string', required: false, example: '¿Ya terminaste el proyecto, hijo?', description: 'Texto del mensaje citado' },
        { name: 'incoming', type: 'string', required: false, example: '¡No lo olvides!', description: 'Burbuja entrante previa opcional' },
        { name: 'avatar', type: 'select', options: ['ana', 'marco', 'cat', 'lila', 'theo', 'mia', 'bot', 'none'], required: false, example: 'ana', description: 'Avatar de /assets (o pega una URL en el campo)' },
        { name: 'theme', type: 'select', options: ['dark', 'light'], required: false, example: 'dark', description: 'Tema del chat' },
        { name: 'time', type: 'string', required: false, example: '9:41', description: 'Hora de la barra de estado' },
        { name: 'battery', type: 'number', required: false, example: '87', description: 'Batería 0-100' },
        { name: 'network', type: 'select', options: ['5G', 'LTE', '4G', 'Wi-Fi'], required: false, example: '5G', description: 'Indicador de red' },
        { name: 'status', type: 'select', options: ['Delivered', 'Read', 'Sent'], required: false, example: 'Delivered', description: 'Estado de entrega' },
        { name: 'tapback', type: 'select', options: ['none', 'heart', 'like', 'laugh', 'warn'], required: false, example: 'heart', description: 'Reacción tapback sobre la burbuja' },
        { name: 'scale', type: 'select', options: ['1', '2'], required: false, example: '2', description: 'Escala de salida (2 = retina)' }
      ],
      handler: async (req, res) => {
        sendSvg(res, iqcSvg({
          contact: String(req.query.name || 'Lyan Valentin').slice(0, 24),
          text: String(req.query.text || 'Jajaja sí, la API ya está desplegada 🚀').slice(0, 220),
          replyTo: String(req.query.replyTo || '').slice(0, 20),
          replyText: String(req.query.replyText || '').slice(0, 120),
          incoming: String(req.query.incoming || '').slice(0, 140),
          avatar: String(req.query.avatar || 'ana'),
          theme: req.query.theme === 'light' ? 'light' : 'dark',
          time: String(req.query.time || '9:41').slice(0, 8),
          battery: clamp(parseInt(req.query.battery, 10) || 87, 0, 100),
          network: ['5G', 'LTE', '4G', 'Wi-Fi'].includes(req.query.network) ? req.query.network : '5G',
          status: ['Delivered', 'Read', 'Sent'].includes(req.query.status) ? req.query.status : 'Delivered',
          tapback: req.query.tapback || 'none',
          wallpaper: req.query.wallpaper !== 'none',
          scale: req.query.scale === '1' ? 1 : 2
        }), 3600);
      }
    },
    {
      name: 'Neon Sign Maker',
      path: '/api/maker/neon',
      method: 'GET',
      description: 'Letrero de neón con resplandor sobre pared oscura, ideal para banners y firmas.',
      responseType: 'image',
      params: [
        { name: 'text', type: 'string', required: true, example: 'API CONSOLE', description: 'Texto del letrero' },
        { name: 'color', type: 'string', required: false, example: '#00f5d4', description: 'Color del tubo (hex)' }
      ],
      handler: async (req, res) => {
        const text = escapeXml(String(req.query.text || 'API CONSOLE').toUpperCase().slice(0, 24));
        const color = hexColor(req.query.color, '#00f5d4');
        const w = Math.max(420, Math.min(900, Math.round(textWidth(text, 54) + 160)));
        sendSvg(res, `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="240" viewBox="0 0 ${w} 240">
  <defs>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="9" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="${w}" height="240" fill="#0a0a0f"/>
  <g opacity="0.12" stroke="#ffffff" stroke-width="1">${Array.from({ length: 11 }, (_, i) => `<line x1="0" y1="${i * 24}" x2="${w}" y2="${i * 24}"/>`).join('')}</g>
  <rect x="24" y="24" width="${w - 48}" height="192" rx="18" fill="none" stroke="${color}" stroke-width="3" filter="url(#glow)" opacity="0.85"/>
  <text x="${w / 2}" y="136" font-family="'Arial Narrow', Arial, sans-serif" font-size="54" font-weight="700" letter-spacing="6" fill="${color}" text-anchor="middle" filter="url(#glow)">${text}</text>
</svg>`, 3600);
      }
    }
  ]
};
