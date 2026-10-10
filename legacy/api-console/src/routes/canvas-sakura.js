/**
 * Categoría: CANVAS — colección "Sakura Night" (6 endpoints)
 * Plantillas pintadas en blanco y negro (flores de cerezo, luna llena, lago)
 * con avatar, textos, números y colores 100 % configurables por query string.
 * Salida JPG (por defecto), PNG o SVG.
 *
 * Todas aceptan además: color, glow, tint, format, width, quality.
 * Los textos admiten los marcadores {username}, {level}, {prev}, {percent},
 * {member}, {name1} y {name2}, y "|" para forzar un salto de línea.
 */

'use strict';

const sakura = require('../lib/sakura');
const { resolveImage } = require('../lib/remote-image');
const { seedFrom } = require('../lib/util');

const { FACE, STYLE_PARAMS, str, int } = sakura;

const AVATAR_HELP = 'URL de imagen (png/jpg/webp) o avatar de /assets: ana, marco, cat, lila, theo, mia, bot. Vacío = silueta.';

function pad(value, digits) {
  const s = String(value);
  return /^\d+$/.test(s) ? s.padStart(digits, '0') : s;
}

/** Sustituye {marcadores} en los textos configurables. */
function fill(template, vars) {
  return String(template).replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
}

function percentOf(q, seedKey) {
  const n = parseInt(q.percent, 10);
  if (Number.isFinite(n)) return { value: Math.max(0, Math.min(100, n)), random: false };
  const seed = str(q.seed, '', 60) || seedKey;
  if (seed) return { value: seedFrom(seed) % 101, random: false };
  return { value: Math.floor(Math.random() * 101), random: true };
}

module.exports = {
  category: 'CANVAS',
  description: 'Canvas "Sakura Night" (welcome, goodbye, level up ×2, ship y gay) con avatar, textos, números y colores configurables en JPG/PNG/SVG, más tarjetas SVG limpias (perfil, tweet, certificado, cita, código, IQ, captcha…).',
  endpoints: [
    {
      name: 'Sakura · Welcome',
      path: '/api/canvas/sakura/welcome',
      method: 'GET',
      description: 'Bienvenida nocturna con flores de cerezo: avatar enmarcado, título, nombre, subtítulo, número de miembro y rótulo vertical japonés.',
      responseType: 'image',
      params: [
        { name: 'username', type: 'string', required: false, example: 'Lyan Valentin', description: 'Nombre del nuevo miembro' },
        { name: 'avatar', type: 'url', required: false, example: 'marco', description: AVATAR_HELP },
        { name: 'title', type: 'string', required: false, example: 'WELCOME', description: 'Título grande' },
        { name: 'subtitle', type: 'text', required: false, example: 'Un nuevo capítulo comienza bajo la misma luna.', description: 'Frase bajo el título (hasta 3 líneas, "|" = salto)' },
        { name: 'member', type: 'number', min: 0, max: 999999, required: false, example: '1', description: 'Número de miembro' },
        { name: 'memberLabel', type: 'string', required: false, example: 'MIEMBRO #', description: 'Etiqueta de la caja inferior' },
        { name: 'vertical', type: 'string', required: false, example: 'ようこそ', description: 'Texto vertical del lado izquierdo (japonés o latino, máx. 10)' },
        ...STYLE_PARAMS
      ],
      handler: async (req, res) => {
        const q = req.query;
        const avatarUri = await resolveImage(q.avatar);
        const username = str(q.username, '', 40);
        const member = pad(str(q.member, '1', 10), 3);
        const vars = { username, member };

        sakura.respond(req, res, 'welcome', ctx => {
          const cx = 608;
          sakura.avatar(ctx, avatarUri, 1110.6, 341.2, 116);

          const title = sakura.text(ctx, fill(str(q.title, 'WELCOME', 40), vars), { x: cx, cy: 322, face: FACE.title, size: 92, maxWidth: 560, spacing: 0.12, upper: true });
          ctx.glow.push(title.svg);
          sakura.flankers(ctx, cx - title.width / 2, cx + title.width / 2, 322);
          sakura.divider(ctx, cx, 392, Math.min(210, title.width / 2 + 40));

          let y = 442;
          if (username) {
            ctx.glow.push(sakura.text(ctx, username, { x: cx, y, face: FACE.label, size: 34, maxWidth: 520, spacing: 0.08 }).svg);
            y += 48;
          }
          const sub = sakura.lines(ctx, fill(str(q.subtitle, 'Un nuevo capítulo comienza bajo la misma luna.', 220), vars), { x: cx, y, face: FACE.italic, size: 30, maxWidth: 520, maxLines: 3 });
          sakura.divider(ctx, cx, sub.last + 34, 84, { center: 'flower', gap: 22, ends: false, r: 6 });

          const label = str(q.memberLabel, 'MIEMBRO #', 24);
          ctx.glow.push(sakura.text(ctx, `${label} ${member}`.trim(), { x: 1104, cy: 530, face: FACE.label, size: 24, maxWidth: 220, spacing: 0.16, upper: true }).svg);

          const vertical = str(q.vertical, 'ようこそ', 10);
          if (vertical) sakura.vertical(ctx, vertical, { x: 178, top: 250, size: 26, gap: 10 });
        });
      }
    },
    {
      name: 'Sakura · Goodbye',
      path: '/api/canvas/sakura/goodbye',
      method: 'GET',
      description: 'Despedida nocturna: avatar con corona de flores, título entre divisores, nombre, mensaje de hasta 5 líneas y cierre.',
      responseType: 'image',
      params: [
        { name: 'username', type: 'string', required: false, example: 'Lyan Valentin', description: 'Nombre de quien se va' },
        { name: 'avatar', type: 'url', required: false, example: 'ana', description: AVATAR_HELP },
        { name: 'title', type: 'string', required: false, example: 'GOOD BYE', description: 'Título grande' },
        { name: 'text', type: 'text', required: false, example: 'No es un adiós definitivo, solo un hasta pronto. Gracias por todo el tiempo compartido. Tu presencia siempre fue importante.', description: 'Mensaje central (hasta 5 líneas, "|" = salto)' },
        { name: 'footer', type: 'string', required: false, example: 'Te deseamos lo mejor', description: 'Línea de cierre entre guiones' },
        ...STYLE_PARAMS
      ],
      handler: async (req, res) => {
        const q = req.query;
        const avatarUri = await resolveImage(q.avatar);
        const username = str(q.username, '', 40);
        const vars = { username };

        sakura.respond(req, res, 'goodbye', ctx => {
          const cx = 712;
          sakura.avatar(ctx, avatarUri, 273.7, 367.6, 129);

          sakura.divider(ctx, cx, 170, 230);
          const title = sakura.text(ctx, fill(str(q.title, 'GOOD BYE', 40), vars), { x: cx, cy: 232, face: FACE.title, size: 84, maxWidth: 520, spacing: 0.14, upper: true });
          ctx.glow.push(title.svg);
          sakura.divider(ctx, cx, 294, 230);

          let y = 346;
          if (username) {
            ctx.glow.push(sakura.text(ctx, username, { x: cx, y: 340, face: FACE.label, size: 30, maxWidth: 480, spacing: 0.08 }).svg);
            y = 386;
          }
          const body = sakura.lines(ctx, fill(str(q.text, 'No es un adiós definitivo, solo un hasta pronto. Gracias por todo el tiempo compartido. Tu presencia siempre fue importante.', 400), vars), { x: cx, y, face: FACE.italic, size: 27, lineHeight: 1.18, maxWidth: 480, maxLines: username ? 4 : 5 });

          const footer = str(q.footer, 'Te deseamos lo mejor', 60);
          if (footer) {
            const fy = Math.min(536, body.last + 48);
            ctx.glow.push(sakura.text(ctx, `— ${fill(footer, vars)} —`, { x: cx, y: fy, face: FACE.italicBold, size: 25, maxWidth: 440 }).svg);
          }
        });
      }
    },
    {
      name: 'Sakura · Level Up',
      path: '/api/canvas/sakura/levelup',
      method: 'GET',
      description: 'Subida de nivel con avatar central y dos cajas (nivel anterior → nivel actual), título y frase motivadora.',
      responseType: 'image',
      params: [
        { name: 'username', type: 'string', required: false, example: 'Lyan', description: 'Nombre (se usa en la frase por defecto)' },
        { name: 'avatar', type: 'url', required: false, example: 'cat', description: AVATAR_HELP },
        { name: 'level', type: 'number', min: 0, max: 9999, required: false, example: '2', description: 'Nivel actual' },
        { name: 'prevLevel', type: 'number', min: 0, max: 9999, required: false, example: '', description: 'Nivel anterior (por defecto level − 1)' },
        { name: 'title', type: 'string', required: false, example: 'LEVEL UP', description: 'Título grande' },
        { name: 'subtitle', type: 'text', required: false, example: '', description: 'Frase inferior (por defecto "¡Sigue avanzando, {username}! Lo mejor aún está por venir.")' },
        { name: 'labelPrev', type: 'string', required: false, example: 'NIVEL ANTERIOR', description: 'Etiqueta de la caja izquierda' },
        { name: 'labelCurrent', type: 'string', required: false, example: 'NIVEL ACTUAL', description: 'Etiqueta de la caja derecha' },
        ...STYLE_PARAMS
      ],
      handler: async (req, res) => {
        const q = req.query;
        const avatarUri = await resolveImage(q.avatar);
        const username = str(q.username, '', 40);
        const level = int(q.level, 2, 0, 9999);
        const prev = int(q.prevLevel, Math.max(0, level - 1), 0, 9999);
        const vars = { username, level: pad(level, 2), prev: pad(prev, 2) };
        const defaultSubtitle = username ? '¡Sigue avanzando, {username}! Lo mejor aún está por venir.' : '¡Sigue avanzando, lo mejor aún está por venir!';

        sakura.respond(req, res, 'levelup', ctx => {
          const cx = 683;
          sakura.avatar(ctx, avatarUri, 682.6, 228.3, 107);

          for (const [x, label, num] of [[315, str(q.labelPrev, 'NIVEL ANTERIOR', 24), vars.prev], [1050, str(q.labelCurrent, 'NIVEL ACTUAL', 24), vars.level]]) {
            ctx.glow.push(sakura.text(ctx, label, { x, y: 294, face: FACE.small, size: 18, maxWidth: 230, spacing: 0.2, upper: true }).svg);
            ctx.glow.push(sakura.text(ctx, num, { x, cy: 338, face: FACE.title, size: 52, maxWidth: 200, spacing: 0.04 }).svg);
          }

          ctx.glow.push(sakura.text(ctx, fill(str(q.title, 'LEVEL UP', 40), vars), { x: cx, cy: 455, face: FACE.title, size: 84, maxWidth: 500, spacing: 0.1, upper: true }).svg);
          const sub = sakura.lines(ctx, fill(str(q.subtitle, defaultSubtitle, 220), vars), { x: cx, y: 568, face: FACE.italic, size: 28, lineHeight: 1.18, maxWidth: 600, maxLines: 2 });
          sakura.divider(ctx, cx, sub.last + 40, 76, { center: 'flower', gap: 20, ends: false, r: 6 });
        });
      }
    },
    {
      name: 'Sakura · Level Up V2',
      path: '/api/canvas/sakura/levelup-v2',
      method: 'GET',
      description: 'Variante tipográfica: gran título dentro del marco, caja "NIVEL 02", felicitación, frase y rótulo vertical japonés.',
      responseType: 'image',
      params: [
        { name: 'username', type: 'string', required: false, example: 'Lyan', description: 'Nombre (se usa en la felicitación por defecto)' },
        { name: 'level', type: 'number', min: 0, max: 9999, required: false, example: '2', description: 'Nivel alcanzado' },
        { name: 'title', type: 'string', required: false, example: 'LEVEL UP', description: 'Título grande' },
        { name: 'label', type: 'string', required: false, example: 'NIVEL', description: 'Etiqueta junto al número' },
        { name: 'headline', type: 'string', required: false, example: '', description: 'Línea destacada (por defecto "¡Felicidades, {username}!")' },
        { name: 'subtitle', type: 'text', required: false, example: 'Tu esfuerzo te ha llevado a un nuevo nivel.', description: 'Frase final (hasta 2 líneas)' },
        { name: 'vertical', type: 'string', required: false, example: 'レベルアップ', description: 'Texto vertical del lado izquierdo (máx. 10)' },
        ...STYLE_PARAMS
      ],
      handler: async (req, res) => {
        const q = req.query;
        const username = str(q.username, '', 40);
        const level = int(q.level, 2, 0, 9999);
        const vars = { username, level: pad(level, 2) };
        const defaultHeadline = username ? '¡Felicidades, {username}!' : '¡Felicidades!';

        sakura.respond(req, res, 'levelup-v2', ctx => {
          const cx = 683;
          ctx.glow.push(sakura.text(ctx, fill(str(q.title, 'LEVEL UP', 40), vars), { x: cx, cy: 328, face: FACE.title, size: 96, maxWidth: 620, spacing: 0.06, upper: true }).svg);

          // Caja: ETIQUETA + número, centrados como un solo bloque
          const label = str(q.label, 'NIVEL', 20).toUpperCase();
          const fonts = require('../lib/fonts');
          let labelSize = 30; let numSize = 46;
          const gap = 22;
          const widthOf = () => fonts.measure(label, labelSize, FACE.label, labelSize * 0.18) + (label ? gap : 0) + fonts.measure(vars.level, numSize, FACE.title, numSize * 0.04);
          let total = widthOf();
          if (total > 300) { const f = 300 / total; labelSize *= f; numSize *= f; total = widthOf(); }
          const baseline = 447 + fonts.capHeight(numSize, FACE.title) / 2;
          const x0 = cx - total / 2;
          if (label) ctx.glow.push(sakura.text(ctx, label, { x: x0, y: baseline, face: FACE.label, size: labelSize, spacing: 0.18, anchor: 'start' }).svg);
          ctx.glow.push(sakura.text(ctx, vars.level, { x: x0 + (label ? fonts.measure(label, labelSize, FACE.label, labelSize * 0.18) + gap : 0), y: baseline, face: FACE.title, size: numSize, spacing: 0.04, anchor: 'start' }).svg);

          ctx.glow.push(sakura.text(ctx, fill(str(q.headline, defaultHeadline, 60), vars), { x: cx, y: 548, face: FACE.italicBold, size: 38, maxWidth: 560 }).svg);
          const sub = sakura.lines(ctx, fill(str(q.subtitle, 'Tu esfuerzo te ha llevado a un nuevo nivel.', 200), vars), { x: cx, y: 588, face: FACE.italic, size: 28, lineHeight: 1.18, maxWidth: 600, maxLines: 2 });
          sakura.divider(ctx, cx, sub.last + 38, 76, { center: 'flower', gap: 20, ends: false, r: 6 });

          const vertical = str(q.vertical, 'レベルアップ', 10);
          if (vertical) sakura.vertical(ctx, vertical, { x: 232, top: 236, size: 24, gap: 8 });
        });
      }
    },
    {
      name: 'Sakura · Ship',
      path: '/api/canvas/sakura/ship',
      method: 'GET',
      description: 'Compatibilidad entre dos perfiles: dos avatares, porcentaje dentro del corazón, nombres en las cajas y frase.',
      responseType: 'image',
      params: [
        { name: 'name1', type: 'string', required: false, example: 'Tu perfil', description: 'Nombre de la izquierda' },
        { name: 'name2', type: 'string', required: false, example: 'Su perfil', description: 'Nombre de la derecha' },
        { name: 'avatar1', type: 'url', required: false, example: 'ana', description: `Avatar izquierdo. ${AVATAR_HELP}` },
        { name: 'avatar2', type: 'url', required: false, example: 'marco', description: `Avatar derecho. ${AVATAR_HELP}` },
        { name: 'percent', type: 'range', min: 0, max: 100, step: 1, required: false, example: '', description: 'Porcentaje (vacío = determinista según los nombres)' },
        { name: 'title', type: 'string', required: false, example: 'Compatibilidad de ship', description: 'Texto bajo el corazón (hasta 2 líneas)' },
        { name: 'quote', type: 'text', required: false, example: 'Dos almas, un mismo cielo.', description: 'Frase inferior (hasta 2 líneas)' },
        ...STYLE_PARAMS
      ],
      handler: async (req, res) => {
        const q = req.query;
        const [av1, av2] = await Promise.all([resolveImage(q.avatar1), resolveImage(q.avatar2)]);
        const name1 = str(q.name1, 'Tu perfil', 30);
        const name2 = str(q.name2, 'Su perfil', 30);
        const pct = percentOf(q, `${name1.toLowerCase()}|${name2.toLowerCase()}`);
        const vars = { name1, name2, percent: pct.value };

        sakura.respond(req, res, 'ship', ctx => {
          const cx = 683;
          sakura.avatar(ctx, av1, 321.6, 324.8, 119);
          sakura.avatar(ctx, av2, 1044, 324.7, 119);

          ctx.glow.push(sakura.text(ctx, `${pct.value}%`, { x: cx, cy: 312, face: FACE.title, size: 66, maxWidth: 160 }).svg);
          sakura.lines(ctx, fill(str(q.title, 'Compatibilidad de ship', 60), vars), { x: cx, centerY: 468, face: FACE.label, size: 26, lineHeight: 1.3, maxWidth: 380, maxLines: 2, upper: true, spacing: 0.15 });

          ctx.glow.push(sakura.text(ctx, name1, { x: 318, cy: 508, face: FACE.label, size: 24, maxWidth: 250, spacing: 0.14, upper: true }).svg);
          ctx.glow.push(sakura.text(ctx, name2, { x: 1046, cy: 508, face: FACE.label, size: 24, maxWidth: 250, spacing: 0.14, upper: true }).svg);

          const quote = str(q.quote, 'Dos almas, un mismo cielo.', 160);
          if (quote) {
            const qt = sakura.lines(ctx, fill(quote, vars), { x: cx, y: 592, face: FACE.italic, size: 28, lineHeight: 1.18, maxWidth: 460, maxLines: 2 });
            sakura.divider(ctx, cx, qt.last + 38, 70, { center: 'flower', gap: 20, ends: false, r: 6 });
          }
        }, { cache: !pct.random });
      }
    },
    {
      name: 'Sakura · Gay',
      path: '/api/canvas/sakura/gay',
      method: 'GET',
      description: 'Medidor humorístico en formato cuadrado: avatar coronado, porcentaje grande y barra de progreso luminosa.',
      responseType: 'image',
      params: [
        { name: 'username', type: 'string', required: false, example: 'Lyan', description: 'Nombre (opcional, bajo el marco)' },
        { name: 'avatar', type: 'url', required: false, example: 'marco', description: AVATAR_HELP },
        { name: 'percent', type: 'range', min: 0, max: 100, step: 1, required: false, example: '', description: 'Porcentaje (vacío = según el nombre, o aleatorio sin nombre)' },
        ...STYLE_PARAMS
      ],
      handler: async (req, res) => {
        const q = req.query;
        const avatarUri = await resolveImage(q.avatar);
        const username = str(q.username, '', 40);
        const pct = percentOf(q, username.toLowerCase());

        sakura.respond(req, res, 'gay', ctx => {
          const cx = 512;
          sakura.avatar(ctx, avatarUri, 509.8, 358.6, 186);
          if (username) ctx.glow.push(sakura.text(ctx, username, { x: cx, y: 617, face: FACE.label, size: 26, maxWidth: 420, spacing: 0.16, upper: true }).svg);

          const big = sakura.text(ctx, `${pct.value}%`, { x: cx, cy: 672, face: FACE.title, size: 118, maxWidth: 420 });
          ctx.glow.push(big.svg, sakura.sparkle(ctx, cx - big.width / 2 - 44, 672, 13), sakura.sparkle(ctx, cx + big.width / 2 + 44, 672, 13));
          sakura.capsule(ctx, 262, 752, 500, 46, pct.value);
        }, { cache: !pct.random });
      }
    }
  ]
};
