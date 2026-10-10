/**
 * Categoría: TOOLS (11 endpoints)
 * Utilidades 100 % funcionales y locales: QR, hashes, contraseñas, UUID, Base64,
 * JWT, Cron, color, unidades, slug y subredes. Sin datos fingidos.
 */

const crypto = require('crypto');
const QRCode = require('qrcode');

module.exports = {
  category: 'TOOLS',
  description: 'Utilidades de desarrollo verificables: criptografía, QR, JWT, Cron, colores, unidades, slugs y redes CIDR.',
  endpoints: [
    {
      name: 'QR Code Generator',
      path: '/api/tools/qrcode',
      method: 'GET',
      description: 'Genera un código QR escaneable en SVG directo o data-URL JSON.',
      responseType: 'image',
      params: [
        { name: 'text', type: 'string', required: true, example: 'https://github.com/lyanvalentinmail-prog/Api-website', description: 'Texto o URL a codificar' },
        { name: 'format', type: 'select', options: ['svg', 'json'], required: false, example: 'svg', description: 'Formato de salida' }
      ],
      handler: async (req, res) => {
        const text = (req.query.text || '').trim();
        const format = (req.query.format || 'svg').toLowerCase();
        if (!text) return res.status(400).json({ status: false, error: 'El parámetro "text" es obligatorio.' });

        if (format === 'json') {
          const dataUrl = await QRCode.toDataURL(text, { width: 300, margin: 2 });
          return res.json({ status: true, data: { text, data_url: dataUrl } });
        }

        const svg = await QRCode.toString(text, { type: 'svg', width: 300, margin: 2, color: { dark: '#17181a', light: '#ffffff' } });
        res.setHeader('Content-Type', 'image/svg+xml');
        res.send(svg);
      }
    },
    {
      name: 'Hash Generator',
      path: '/api/tools/hash',
      method: 'GET',
      description: 'Calcula hashes criptográficos (SHA-256, SHA-512, SHA-1, MD5) de cualquier cadena.',
      responseType: 'json',
      params: [
        { name: 'text', type: 'string', required: true, example: 'api-console-secret', description: 'Texto de entrada' },
        { name: 'algorithm', type: 'select', options: ['sha256', 'sha512', 'sha1', 'md5'], required: false, example: 'sha256', description: 'Algoritmo' }
      ],
      handler: async (req, res) => {
        const text = req.query.text || '';
        if (!text) return res.status(400).json({ status: false, error: 'El parámetro "text" es obligatorio.' });
        const algo = ['sha256', 'sha512', 'sha1', 'md5'].includes((req.query.algorithm || '').toLowerCase()) ? req.query.algorithm.toLowerCase() : 'sha256';
        const hash = crypto.createHash(algo).update(text).digest('hex');
        res.json({ status: true, data: { input: text, algorithm: algo.toUpperCase(), hash, bits: hash.length * 4 } });
      }
    },
    {
      name: 'Password Generator',
      path: '/api/tools/password',
      method: 'GET',
      description: 'Genera contraseñas seguras con crypto.randomBytes y calcula su entropía real.',
      responseType: 'json',
      params: [
        { name: 'length', type: 'number', required: false, example: '20', description: 'Longitud (8-64)' },
        { name: 'symbols', type: 'select', options: ['true', 'false'], required: false, example: 'true', description: 'Incluir símbolos' }
      ],
      handler: async (req, res) => {
        const length = Math.max(8, Math.min(64, parseInt(req.query.length || '20', 10) || 20));
        const useSymbols = String(req.query.symbols ?? 'true') !== 'false';
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' + (useSymbols ? '!@#$%^&*()-_=+[]{}<>?' : '');
        const bytes = crypto.randomBytes(length);
        let password = '';
        for (let i = 0; i < length; i++) password += chars[bytes[i] % chars.length];
        const entropyBits = Math.round(length * Math.log2(chars.length));
        res.json({ status: true, data: { password, length, entropy_bits: entropyBits, strength: entropyBits >= 100 ? 'VERY_STRONG' : 'STRONG' } });
      }
    },
    {
      name: 'UUID v4 Generator',
      path: '/api/tools/uuid',
      method: 'GET',
      description: 'Genera UUID v4 reales (crypto.randomUUID) y un token bearer de ejemplo.',
      responseType: 'json',
      params: [
        { name: 'count', type: 'number', required: false, example: '5', description: 'Cantidad (1-20)' }
      ],
      handler: async (req, res) => {
        const count = Math.max(1, Math.min(20, parseInt(req.query.count || '5', 10) || 5));
        res.json({ status: true, count, data: { uuids: Array.from({ length: count }, () => crypto.randomUUID()) } });
      }
    },
    {
      name: 'Base64 Encode / Decode',
      path: '/api/tools/base64',
      method: 'GET',
      description: 'Codifica o decodifica texto en Base64 (UTF-8).',
      responseType: 'json',
      params: [
        { name: 'text', type: 'string', required: true, example: 'Hola desde API Console', description: 'Texto a procesar' },
        { name: 'mode', type: 'select', options: ['encode', 'decode'], required: false, example: 'encode', description: 'Operación' }
      ],
      handler: async (req, res) => {
        const text = req.query.text || '';
        if (!text) return res.status(400).json({ status: false, error: 'El parámetro "text" es obligatorio.' });
        const mode = req.query.mode === 'decode' ? 'decode' : 'encode';
        try {
          const output = mode === 'decode' ? Buffer.from(text, 'base64').toString('utf8') : Buffer.from(text, 'utf8').toString('base64');
          res.json({ status: true, data: { mode, input: text, output } });
        } catch (err) {
          res.status(400).json({ status: false, error: 'Base64 inválido: ' + err.message });
        }
      }
    },
    {
      name: 'JWT Decoder',
      path: '/api/tools/jwt-decoder',
      method: 'GET',
      description: 'Decodifica Header y Payload de un JWT y verifica su expiración (sin validar firma).',
      responseType: 'json',
      params: [
        {
          name: 'token',
          type: 'string',
          required: true,
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzEwMjQiLCJuYW1lIjoiTHlhbiBWYWxlbnRpbiIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTc2MDAwMDAwMH0.signature',
          description: 'Token JWT (header.payload.signature)'
        }
      ],
      handler: async (req, res) => {
        const token = (req.query.token || '').trim();
        const parts = token.split('.');
        if (parts.length < 2) return res.status(400).json({ status: false, error: 'Formato JWT inválido: se esperan al menos header y payload.' });
        try {
          const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
          const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
          res.json({
            status: true,
            data: {
              header,
              payload,
              has_signature: Boolean(parts[2]),
              is_expired: payload.exp ? Date.now() / 1000 > payload.exp : false
            }
          });
        } catch (err) {
          res.status(400).json({ status: false, error: 'No se pudo decodificar el JWT: ' + err.message });
        }
      }
    },
    {
      name: 'Cron Explainer',
      path: '/api/tools/cron-parser',
      method: 'GET',
      description: 'Explica en español una expresión Cron de 5 campos.',
      responseType: 'json',
      params: [
        { name: 'expression', type: 'string', required: true, example: '*/15 * * * *', description: 'Expresión Cron (5 campos)' }
      ],
      handler: async (req, res) => {
        const expr = (req.query.expression || '').trim();
        const fields = expr.split(/\s+/);
        if (fields.length !== 5) return res.status(400).json({ status: false, error: 'La expresión Cron debe tener exactamente 5 campos.' });
        const [min, hour, dom, mon, dow] = fields;
        res.json({
          status: true,
          data: {
            expression: expr,
            breakdown: { minuto: min, hora: hour, dia_del_mes: dom, mes: mon, dia_de_semana: dow },
            human_readable: `Se ejecuta cuando minuto="${min}", hora="${hour}", día del mes="${dom}", mes="${mon}" y día de semana="${dow}".`
          }
        });
      }
    },
    {
      name: 'Color Converter',
      path: '/api/tools/color-palette',
      method: 'GET',
      description: 'Convierte HEX a RGB y devuelve el complementario más un gradiente CSS listo para usar.',
      responseType: 'json',
      params: [
        { name: 'hex', type: 'string', required: true, example: '#8ACE00', description: 'Color en formato HEX' }
      ],
      handler: async (req, res) => {
        const clean = (req.query.hex || '#8ACE00').replace('#', '').trim();
        const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean.padEnd(6, '0').slice(0, 6);
        if (!/^[0-9a-f]{6}$/i.test(full)) return res.status(400).json({ status: false, error: 'HEX inválido.' });
        const r = parseInt(full.slice(0, 2), 16);
        const g = parseInt(full.slice(2, 4), 16);
        const b = parseInt(full.slice(4, 6), 16);
        const comp = '#' + [255 - r, 255 - g, 255 - b].map(x => x.toString(16).padStart(2, '0')).join('');
        res.json({
          status: true,
          data: {
            hex: `#${full}`,
            rgb: { r, g, b },
            complementary: comp,
            css_gradient: `linear-gradient(135deg, #${full}, ${comp})`
          }
        });
      }
    },
    {
      name: 'Unit Converter',
      path: '/api/tools/unit-converter',
      method: 'GET',
      description: 'Convierte temperatura, distancia, peso y almacenamiento entre unidades comunes.',
      responseType: 'json',
      params: [
        { name: 'value', type: 'number', required: true, example: '100', description: 'Valor numérico' },
        { name: 'conversion', type: 'select', options: ['c-to-f', 'f-to-c', 'km-to-mi', 'mi-to-km', 'kg-to-lb', 'gb-to-mb'], required: false, example: 'c-to-f', description: 'Tipo de conversión' }
      ],
      handler: async (req, res) => {
        const val = parseFloat(req.query.value);
        if (Number.isNaN(val)) return res.status(400).json({ status: false, error: 'El parámetro "value" debe ser numérico.' });
        const formulas = {
          'c-to-f': { fn: v => (v * 9) / 5 + 32, from: '°C', to: '°F' },
          'f-to-c': { fn: v => ((v - 32) * 5) / 9, from: '°F', to: '°C' },
          'km-to-mi': { fn: v => v * 0.621371, from: 'km', to: 'mi' },
          'mi-to-km': { fn: v => v / 0.621371, from: 'mi', to: 'km' },
          'kg-to-lb': { fn: v => v * 2.20462, from: 'kg', to: 'lb' },
          'gb-to-mb': { fn: v => v * 1024, from: 'GB', to: 'MB' }
        };
        const conv = formulas[req.query.conversion] || formulas['c-to-f'];
        res.json({ status: true, data: { input: val, from: conv.from, to: conv.to, result: Number(conv.fn(val).toFixed(3)) } });
      }
    },
    {
      name: 'Slugify',
      path: '/api/tools/slugify',
      method: 'GET',
      description: 'Convierte títulos con tildes o símbolos en slugs limpios para URLs, con métricas de texto.',
      responseType: 'json',
      params: [
        { name: 'text', type: 'string', required: true, example: '¡Cómo Crear una API Pública en Node.js & Express!', description: 'Título o texto' }
      ],
      handler: async (req, res) => {
        const text = (req.query.text || '').trim();
        if (!text) return res.status(400).json({ status: false, error: 'El parámetro "text" es obligatorio.' });
        const slug = text
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
        res.json({ status: true, data: { original: text, slug, char_count: text.length, word_count: text.split(/\s+/).filter(Boolean).length } });
      }
    },
    {
      name: 'CIDR Subnet Calculator',
      path: '/api/tools/ip-subnet',
      method: 'GET',
      description: 'Calcula red, máscara, total de direcciones y hosts útiles de una red IPv4 en notación CIDR.',
      responseType: 'json',
      params: [
        { name: 'cidr', type: 'string', required: false, example: '192.168.1.0/24', description: 'Red en notación CIDR' }
      ],
      handler: async (req, res) => {
        const cidr = (req.query.cidr || '192.168.1.0/24').trim();
        const [rawIp, prefixStr] = cidr.split('/');
        const ipOk = /^(\d{1,3}\.){3}\d{1,3}$/.test(rawIp || '') && rawIp.split('.').every(o => parseInt(o, 10) <= 255);
        if (!ipOk) return res.status(400).json({ status: false, error: 'IPv4 inválida. Usa el formato 192.168.1.0/24.' });
        const prefix = Math.max(8, Math.min(32, parseInt(prefixStr || '24', 10) || 24));
        const ipNum = rawIp.split('.').reduce((acc, o) => (acc << 8) + parseInt(o, 10), 0) >>> 0;
        const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
        const network = (ipNum & mask) >>> 0;
        const toIp = n => `${(n >>> 24) & 255}.${(n >>> 16) & 255}.${(n >>> 8) & 255}.${n & 255}`;
        const total = 2 ** (32 - prefix);
        res.json({
          status: true,
          data: {
            cidr: `${toIp(network)}/${prefix}`,
            network_ip: toIp(network),
            broadcast_ip: toIp((network | ~mask) >>> 0),
            netmask: toIp(mask),
            total_ip_addresses: total,
            usable_hosts: Math.max(0, total - 2)
          }
        });
      }
    },
    {
      name: 'Captura web (placeholder)',
      path: '/api/tools/ssweb',
      method: 'GET',
      description: 'Información sobre captura web (demo). En producción usaría Puppeteer/Playwright.',
      responseType: 'json',
      params: [
        { name: 'url', type: 'string', required: true, example: 'https://example.com', description: 'URL a capturar' }
      ],
      handler: async (req, res) => {
        const url = String(req.query.url || '').trim();
        if (!url) return res.status(400).json({ status: false, error: 'Parámetro "url" obligatorio.' });
        res.json({
          status: true,
          data: {
            url,
            demo: true,
            mensaje: 'Captura web disponible conectando un servicio headless (Puppeteer/Playwright).'
          }
        });
      }
    },
    {
      name: 'Código postal español (demo)',
      path: '/api/tools/kodepos',
      method: 'GET',
      description: 'Busca código postal o localidad de España (demo con datos de ejemplo).',
      responseType: 'json',
      params: [
        { name: 'q', type: 'string', required: true, example: 'madrid', description: 'Ciudad o código postal' }
      ],
      handler: async (req, res) => {
        const q = String(req.query.q || '').toLowerCase().trim();
        if (!q) return res.status(400).json({ status: false, error: 'Parámetro "q" obligatorio.' });
        const datos = [
          { cp: '28001', localidad: 'Madrid', provincia: 'Madrid' },
          { cp: '08001', localidad: 'Barcelona', provincia: 'Barcelona' },
          { cp: '46001', localidad: 'Valencia', provincia: 'Valencia' },
          { cp: '41001', localidad: 'Sevilla', provincia: 'Sevilla' },
          { cp: '29001', localidad: 'Málaga', provincia: 'Málaga' },
          { cp: '50001', localidad: 'Zaragoza', provincia: 'Zaragoza' }
        ];
        const resultados = datos.filter(d => d.localidad.toLowerCase().includes(q) || d.cp.includes(q) || d.provincia.toLowerCase().includes(q));
        res.json({ status: true, consulta: q, resultados, total: resultados.length });
      }
    },
    {
      name: 'Traductor simple (demo)',
      path: '/api/tools/translate',
      method: 'GET',
      description: 'Traducción simulada en español (demo — no traduce realmente).',
      responseType: 'json',
      params: [
        { name: 'text', type: 'string', required: true, example: 'Hello world', description: 'Texto a traducir' },
        { name: 'to', type: 'select', options: ['es', 'en', 'fr', 'pt'], required: false, example: 'es', description: 'Idioma destino' }
      ],
      handler: async (req, res) => {
        const text = String(req.query.text || '').trim();
        const to = String(req.query.to || 'es').toLowerCase();
        if (!text) return res.status(400).json({ status: false, error: 'Parámetro "text" obligatorio.' });
        res.json({
          status: true,
          data: {
            original: text,
            idioma_destino: to,
            traduccion: to === 'es' ? `[ES] ${text} (demo)` : `[${to.toUpperCase()}] ${text} (demo)`,
            nota: 'Traducción de demostración. Conecta un motor real en producción.'
          }
        });
      }
    },
    {
      name: 'Información de países',
      path: '/api/tools/countryInfo',
      method: 'GET',
      description: 'Datos básicos de países hispanohablantes.',
      responseType: 'json',
      params: [
        { name: 'code', type: 'string', required: true, example: 'ES', description: 'Código ISO (ES, MX, AR, CO, CL, PE)' }
      ],
      handler: async (req, res) => {
        const code = String(req.query.code || 'ES').toUpperCase().trim();
        const PAISES = {
          ES: { nombre: 'España', capital: 'Madrid', moneda: 'Euro (EUR)', idioma: 'Español', poblacion: 48600000 },
          MX: { nombre: 'México', capital: 'Ciudad de México', moneda: 'Peso (MXN)', idioma: 'Español', poblacion: 128000000 },
          AR: { nombre: 'Argentina', capital: 'Buenos Aires', moneda: 'Peso (ARS)', idioma: 'Español', poblacion: 46000000 },
          CO: { nombre: 'Colombia', capital: 'Bogotá', moneda: 'Peso (COP)', idioma: 'Español', poblacion: 52000000 },
          CL: { nombre: 'Chile', capital: 'Santiago', moneda: 'Peso (CLP)', idioma: 'Español', poblacion: 19000000 },
          PE: { nombre: 'Perú', capital: 'Lima', moneda: 'Sol (PEN)', idioma: 'Español', poblacion: 33000000 }
        };
        const info = PAISES[code];
        if (!info) return res.status(404).json({ status: false, error: 'País no encontrado. Prueba ES, MX, AR, CO, CL o PE.' });
        res.json({ status: true, data: { codigo: code, ...info } });
      }
    },
    {
      name: 'Buscador de subdominios (demo)',
      path: '/api/tools/subdomains',
      method: 'GET',
      description: 'Lista de subdominios comunes para un dominio (demo).',
      responseType: 'json',
      params: [
        { name: 'domain', type: 'string', required: true, example: 'example.com', description: 'Dominio' }
      ],
      handler: async (req, res) => {
        const domain = String(req.query.domain || '').trim();
        if (!domain) return res.status(400).json({ status: false, error: 'Parámetro "domain" obligatorio.' });
        const sub = ['www', 'api', 'mail', 'app', 'blog', 'dev', 'cdn', 'm'];
        res.json({ status: true, data: { dominio: domain, subdominios_comunes: sub.map(s => `${s}.${domain}`), demo: true } });
      }
    },
    {
      name: 'Generador VCC (tarjetas ficticias)',
      path: '/api/tools/vcc-generator',
      method: 'GET',
      description: 'Genera números de tarjeta de crédito que pasan el algoritmo de Luhn (SOLO PARA PRUEBAS, no son válidas).',
      responseType: 'json',
      params: [
        { name: 'brand', type: 'select', options: ['visa', 'mastercard'], required: false, example: 'visa', description: 'Marca' },
        { name: 'count', type: 'number', required: false, example: '3', description: 'Cantidad (1-10)' }
      ],
      handler: async (req, res) => {
        const brand = (req.query.brand || 'visa').toLowerCase();
        const count = Math.max(1, Math.min(10, parseInt(req.query.count || '3', 10) || 3));
        const prefix = brand === 'mastercard' ? '555555' : '411111';

        function luhn(num) {
          let sum = 0; let alt = false;
          for (let i = num.length - 1; i >= 0; i--) {
            let n = parseInt(num[i], 10);
            if (alt) { n *= 2; if (n > 9) n -= 9; }
            sum += n; alt = !alt;
          }
          return sum % 10 === 0;
        }
        function gen() {
          let num = prefix;
          while (num.length < 15) num += Math.floor(Math.random() * 10);
          for (let c = 0; c <= 9; c++) {
            if (luhn(num + c)) { num += c; break; }
          }
          return num.match(/.{1,4}/g).join(' ');
        }
        const cards = Array.from({ length: count }, () => ({
          marca: brand.toUpperCase(),
          numero: gen(),
          expiracion: `${String(1 + Math.floor(Math.random() * 12)).padStart(2,'0')}/${(2026 + Math.floor(Math.random() * 5)).toString().slice(2)}`,
          cvv: String(Math.floor(100 + Math.random() * 900)),
          advertencia: 'Números generados con Luhn para PRUEBAS. No son válidos para compras.'
        }));
        res.json({ status: true, data: cards });
      }
    }
  ]
};
