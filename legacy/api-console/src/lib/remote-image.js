/**
 * Resolución de avatares/imágenes para los generadores.
 *
 * Acepta:
 *   - nombres de /assets ("ana", "marco", "cat", "lila", "theo", "mia", "bot"),
 *   - rutas locales "/assets/…",
 *   - URLs http(s) públicas (se descargan con límite de tamaño y tiempo;
 *     PNG, JPG, GIF, SVG y WebP, este último se convierte a JPEG).
 *
 * Devuelve siempre un data URI, porque un SVG mostrado con <img> o rasterizado
 * en el servidor no puede cargar recursos externos.
 */

'use strict';

const dns = require('dns').promises;
const net = require('net');
const assets = require('./assets');

const BUILTIN = {
  ana: 'iqc/avatars/avatar-ana.jpg',
  marco: 'iqc/avatars/avatar-marco.jpg',
  cat: 'iqc/avatars/avatar-cat.jpg',
  lila: 'iqc/avatars/ava-lila.svg',
  theo: 'iqc/avatars/ava-theo.svg',
  mia: 'iqc/avatars/ava-mia.svg',
  bot: 'iqc/avatars/ava-bot.svg'
};

const MAX_BYTES = 3 * 1024 * 1024;
const TIMEOUT_MS = 7000;
const TTL_OK = 10 * 60 * 1000;
const TTL_FAIL = 60 * 1000;
const MAX_ENTRIES = 64;

const cache = new Map();

function remember(key, value, ttl) {
  if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value);
  cache.set(key, { value, expires: Date.now() + ttl });
  return value;
}

function sniffMime(buf, declared) {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 6 && buf.toString('latin1', 0, 6).startsWith('GIF8')) return 'image/gif';
  if (buf.length >= 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  const head = buf.toString('utf8', 0, Math.min(buf.length, 512)).trimStart();
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) return 'image/svg+xml';
  const d = String(declared || '').split(';')[0].trim().toLowerCase();
  return d.startsWith('image/') ? d : null;
}

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  const v6 = ip.toLowerCase();
  return v6 === '::1' || v6 === '::' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe80') || v6.startsWith('::ffff:');
}

async function assertPublicHost(hostname) {
  const host = hostname.replace(/^\[|\]$/g, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new Error('Host no permitido');
  }
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error('IP privada no permitida');
    return;
  }
  const { address } = await dns.lookup(host);
  if (isPrivateIp(address)) throw new Error('El host resuelve a una IP privada');
}

async function download(url) {
  const parsed = new URL(url);
  if (!/^https?:$/.test(parsed.protocol)) throw new Error('Solo http/https');
  await assertPublicHost(parsed.hostname);

  const res = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'User-Agent': 'APIConsole/3 (+canvas)', Accept: 'image/*,*/*;q=0.5' }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (res.url && res.url !== url) await assertPublicHost(new URL(res.url).hostname);
  const declared = Number(res.headers.get('content-length') || 0);
  if (declared > MAX_BYTES) throw new Error('Imagen demasiado grande');

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error('Imagen demasiado grande');
  const mime = sniffMime(buf, res.headers.get('content-type'));
  if (!mime) throw new Error('La URL no devuelve una imagen');
  if (mime === 'image/webp') return webpToJpeg(buf);
  return `data:${mime};base64,${buf.toString('base64')}`;
}

/**
 * resvg no decodifica WebP (formato por defecto de los CDN de Discord/WhatsApp):
 * se decodifica con webp-wasm y se recodifica a JPEG sobre fondo oscuro.
 */
let webpDecoder = null;
async function webpToJpeg(buf) {
  if (!webpDecoder) {
    const webp = require('webp-wasm');
    await new Promise((resolve, reject) => webp.loadDecoder(err => (err ? reject(err) : resolve())));
    webpDecoder = webp;
  }
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const img = await new Promise((resolve, reject) => webpDecoder.decode(ab, (err, data) => (err ? reject(err) : resolve(data))));
  if (!img || !img.width || !img.height || !img.data) throw new Error('WebP inválido');
  if (img.width * img.height > 4096 * 4096) throw new Error('WebP demasiado grande');
  const rgba = Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength);
  // aplana la transparencia sobre el fondo oscuro de las plantillas
  for (let i = 0; i < rgba.length; i += 4) {
    const a = rgba[i + 3];
    if (a === 255) continue;
    rgba[i] = Math.round((rgba[i] * a + 12 * (255 - a)) / 255);
    rgba[i + 1] = Math.round((rgba[i + 1] * a + 12 * (255 - a)) / 255);
    rgba[i + 2] = Math.round((rgba[i + 2] * a + 16 * (255 - a)) / 255);
    rgba[i + 3] = 255;
  }
  const jpeg = require('jpeg-js');
  const out = jpeg.encode({ data: rgba, width: img.width, height: img.height }, 92);
  return `data:image/jpeg;base64,${out.data.toString('base64')}`;
}

/**
 * @param {string} value  nombre de asset, ruta /assets/… o URL
 * @returns {Promise<string|null>} data URI o null si no hay imagen utilizable
 */
async function resolveImage(value) {
  const v = String(value || '').trim();
  if (!v || v === 'none' || v === 'default') return null;
  if (BUILTIN[v.toLowerCase()]) return assets.dataUri(BUILTIN[v.toLowerCase()]);
  if (v.startsWith('/assets/')) {
    const rel = v.slice('/assets/'.length).split('?')[0];
    return assets.hasAsset(rel) ? assets.dataUri(rel) : null;
  }
  if (!/^https?:\/\//i.test(v)) return null;

  const hit = cache.get(v);
  if (hit && hit.expires > Date.now()) return hit.value;

  try {
    return remember(v, await download(v), TTL_OK);
  } catch {
    return remember(v, null, TTL_FAIL);
  }
}

module.exports = { resolveImage, BUILTIN, webpToJpeg };
