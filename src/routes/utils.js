'use strict';

const express = require('express');
const crypto = require('node:crypto');
const { sendSuccess } = require('../lib/respond');
const { collectParams, asText, asInteger, asEnum, asPattern, LIMITS } = require('../lib/validate');
const { errors } = require('../lib/errors');

const router = express.Router();

/** Cabeceras que nunca se devuelven en el eco para no filtrar credenciales. */
const SENSITIVE_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'proxy-authorization',
  'x-api-key',
  'x-auth-token',
  'api-key',
]);

/** GET|POST /api/util/base64 — codifica o decodifica Base64. */
function base64Handler(req, res, next) {
  try {
    const params = collectParams(req);
    const input = asText(params.text, 'text', { max: LIMITS.textMaxLength });
    const decode = ['true', '1', 'si', 'sí'].includes(String(params.decode ?? '').toLowerCase());
    const urlSafe = ['true', '1', 'si', 'sí'].includes(String(params.urlSafe ?? '').toLowerCase());

    if (decode) {
      // Normaliza el alfabeto seguro para URL y restaura el relleno si falta.
      let normalized = input.trim().replace(/-/g, '+').replace(/_/g, '/');
      if (normalized.length % 4 !== 0) normalized = normalized.padEnd(normalized.length + (4 - (normalized.length % 4)), '=');
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) {
        throw errors.unprocessable('INVALID_BASE64', 'El texto no es Base64 válido: contiene caracteres no permitidos.');
      }
      const buffer = Buffer.from(normalized, 'base64');
      // Comprobación de ida y vuelta: descarta cadenas que "parecen" Base64 pero no lo son.
      if (buffer.toString('base64').replace(/=+$/, '') !== normalized.replace(/=+$/, '')) {
        throw errors.unprocessable('INVALID_BASE64', 'El texto no es Base64 válido: la longitud o el relleno no cuadran.');
      }
      return sendSuccess(
        res,
        {
          direction: 'decode',
          urlSafe,
          input,
          output: buffer.toString('utf8'),
          inputBytes: Buffer.byteLength(input, 'utf8'),
          outputBytes: buffer.byteLength,
        },
        { self: false }
      );
    }

    const buffer = Buffer.from(input, 'utf8');
    let output = buffer.toString('base64');
    if (urlSafe) output = output.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    return sendSuccess(
      res,
      {
        direction: 'encode',
        urlSafe,
        input,
        output,
        inputBytes: buffer.byteLength,
        outputBytes: Buffer.byteLength(output, 'utf8'),
      },
      { self: false }
    );
  } catch (error) {
    return next(error);
  }
}

router.get('/base64', base64Handler);
router.post('/base64', base64Handler);

const HASH_ALGORITHMS = { sha256: 'sha256', sha512: 'sha512', sha1: 'sha1' };

/** GET|POST /api/util/hash — hash criptográfico de un texto. */
function hashHandler(req, res, next) {
  try {
    const params = collectParams(req);
    const input = asText(params.text, 'text', { max: LIMITS.textMaxLength });
    const algorithm = asEnum(params.algorithm, 'algorithm', Object.keys(HASH_ALGORITHMS), 'sha256');
    const encoding = asEnum(params.encoding, 'encoding', ['hex', 'base64'], 'hex');

    const hash = crypto.createHash(HASH_ALGORITHMS[algorithm]).update(input, 'utf8').digest(encoding);

    let verified = null;
    let verifyNote = null;
    if (params.verify !== undefined && params.verify !== '') {
      const expected = String(params.verify).trim();
      const expectedBuffer = Buffer.from(expected.toLowerCase());
      const hashBuffer = Buffer.from(hash.toLowerCase());
      verified = expectedBuffer.length === hashBuffer.length && crypto.timingSafeEqual(expectedBuffer, hashBuffer);
      verifyNote = verified
        ? 'El hash coincide con el valor esperado.'
        : 'El hash NO coincide: revisa el texto de entrada, el algoritmo y el formato (hex o base64).';
    }

    sendSuccess(
      res,
      {
        algorithm,
        encoding,
        input,
        inputBytes: Buffer.byteLength(input, 'utf8'),
        hash,
        verified,
        ...(verifyNote ? { verifyNote } : {}),
        warning: 'Un hash simple NO sirve para almacenar contraseñas. Usa bcrypt, scrypt o argon2 para eso.',
      },
      { self: false }
    );
  } catch (error) {
    next(error);
  }
}

router.get('/hash', hashHandler);
router.post('/hash', hashHandler);

/** Convierte componentes RGB a HSL. */
function rgbToHsl(r, g, b) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  let hue = 0;
  let saturation = 0;

  if (max !== min) {
    const delta = max - min;
    saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    if (max === red) hue = ((green - blue) / delta + (green < blue ? 6 : 0)) / 6;
    else if (max === green) hue = ((blue - red) / delta + 2) / 6;
    else hue = ((red - green) / delta + 4) / 6;
  }

  return { h: Math.round(hue * 360), s: Math.round(saturation * 100), l: Math.round(lightness * 100) };
}

/** Luminancia relativa según WCAG 2.1 (para decidir el color de texto). */
function relativeLuminance(r, g, b) {
  const channel = (value) => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return Number((0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)).toFixed(4));
}

/** GET /api/util/color — colores aleatorios en varios formatos. */
router.get('/color', (req, res, next) => {
  try {
    const params = collectParams(req);
    const count = asInteger(params.count, 'count', 1);
    if (count < 1 || count > 50) {
      throw errors.badRequest('INVALID_INTEGER', 'count debe ser un número entero entre 1 y 50.');
    }

    const colors = Array.from({ length: count }, () => {
      const bytes = crypto.randomBytes(3);
      const r = bytes[0];
      const g = bytes[1];
      const b = bytes[2];
      const hex = `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
      const hsl = rgbToHsl(r, g, b);
      const luminance = relativeLuminance(r, g, b);

      return {
        hex,
        rgb: { r, g, b },
        rgbString: `rgb(${r}, ${g}, ${b})`,
        hsl,
        hslString: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`,
        relativeLuminance: luminance,
        contrastTextColor: luminance > 0.179 ? 'black' : 'white',
      };
    });

    sendSuccess(res, { count, colors }, { self: false });
  } catch (error) {
    next(error);
  }
});

/**
 * Devuelve el cuerpo recibido en un formato uniforme, sea JSON, texto o formulario.
 * @param {import('express').Request} req
 */
function describeBody(req) {
  if (req.body === undefined || req.body === null || req.body === '') {
    return { body: null, bodyType: 'vacío' };
  }
  if (typeof req.body === 'object') {
    return { body: req.body, bodyType: 'json (analizado)' };
  }
  const contentType = String(req.headers['content-type'] || '');
  if (contentType.includes('application/x-www-form-urlencoded')) {
    return { body: Object.fromEntries(new URLSearchParams(String(req.body))), bodyType: 'formulario (urlencoded)' };
  }
  return { body: req.body, bodyType: 'texto plano' };
}

/** GET|POST|PUT|PATCH|DELETE /api/util/echo — devuelve la petición recibida. */
function echoHandler(req, res, next) {
  try {
    const params = collectParams(req);
    const includeHeaders = !['false', '0', 'no'].includes(String(params.includeHeaders ?? 'true').toLowerCase());
    const { body, bodyType } = describeBody(req);

    const headers = Object.fromEntries(
      Object.entries(req.headers).filter(([name]) => !SENSITIVE_HEADERS.has(name.toLowerCase()))
    );

    const forwardedFor = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();

    sendSuccess(
      res,
      {
        method: req.method,
        path: req.path,
        originalUrl: req.originalUrl,
        query: req.query,
        params: req.params,
        body,
        bodyType,
        contentType: req.headers['content-type'] || null,
        ...(includeHeaders ? { headers, headersCount: Object.keys(headers).length } : {}),
        client: {
          ip: req.clientIp,
          forwardedFor: forwardedFor || null,
          userAgent: req.headers['user-agent'] || null,
          httpVersion: req.httpVersion,
        },
        receivedAt: new Date().toISOString(),
        note: 'Las cabeceras authorization, cookie, set-cookie, proxy-authorization y x-api-key se eliminan siempre de la respuesta.',
      },
      { self: false }
    );
  } catch (error) {
    next(error);
  }
}

router.get('/echo', echoHandler);
router.post('/echo', echoHandler);
router.put('/echo', echoHandler);
router.patch('/echo', echoHandler);
router.delete('/echo', echoHandler);

/** GET /api/util/validate-regex — comprueba si una expresión regular es válida. */
router.get('/validate-regex', (req, res, next) => {
  try {
    const params = collectParams(req);
    const pattern = asPattern(params.pattern, 'pattern', /^[\s\S]{1,200}$/, {
      hint: 'El patrón debe tener entre 1 y 200 caracteres.',
      maxLength: 200,
    });
    const flags = params.flags === undefined ? '' : asPattern(params.flags, 'flags', /^[gimsuy]{0,6}$/, {
      hint: 'Las banderas admitidas son g, i, m, s, u, y.',
      maxLength: 6,
    });

    try {
      const regex = new RegExp(pattern, flags);
      const sample = params.test === undefined ? '' : String(params.test).slice(0, 1000);
      const match = sample ? regex.exec(sample) : null;
      sendSuccess(
        res,
        {
          pattern,
          flags,
          valid: true,
          source: regex.source,
          global: regex.global,
          matchesSample: match ? { match: match[0], index: match.index, groups: match.slice(1) } : null,
          note: 'Este endpoint sólo comprueba la sintaxis; no ejecuta reemplazos ni evalúa código.',
        },
        { self: false }
      );
    } catch (error) {
      sendSuccess(res, { pattern, flags, valid: false, reason: error.message }, { self: false });
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;
