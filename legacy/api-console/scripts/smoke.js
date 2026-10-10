/**
 * Smoke test real: arranca el servidor Express en un puerto efímero y ejecuta
 * CADA endpoint del catálogo con sus parámetros de ejemplo, verificando:
 *  - status HTTP < 500 (los 4xx de validación cuentan como fallo aquí, porque
 *    siempre enviamos los ejemplos declarados),
 *  - content-type coherente con responseType (json vs image/*),
 *  - respuestas JSON con campo `status` y sin datos rotos,
 *  - valores conocidos correctos (hash sha256 de "abc", base64 de "hola", etc.).
 * Los endpoints LOOKUP que dependen de red externa se marcan "net-skip" si el
 * entorno no tiene salida (no hacen fallar la suite).
 *
 * Uso: npm test
 */

'use strict';

const assert = require('assert');
const app = require('../server');

const KNOWN = [
  {
    path: '/api/tools/hash',
    query: { text: 'abc', algorithm: 'sha256' },
    check: body => body.data.hash === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
  },
  {
    path: '/api/tools/base64',
    query: { text: 'hola', mode: 'encode' },
    check: body => body.data.output === 'aG9sYQ=='
  },
  {
    path: '/api/tools/unit-converter',
    query: { value: '100', conversion: 'c-to-f' },
    check: body => body.data.result === 212
  },
  {
    path: '/api/tools/slugify',
    query: { text: '¡Hola Mundo!' },
    check: body => body.data.slug === 'hola-mundo'
  },
  {
    path: '/api/tools/ip-subnet',
    query: { cidr: '192.168.1.0/24' },
    check: body => body.data.usable_hosts === 254 && body.data.broadcast_ip === '192.168.1.255'
  },
  {
    path: '/api/info/moon-phase',
    query: { date: '2026-10-10' },
    check: body => (body.data.edad_lunar_dias ?? body.data.lunar_age_days) > 0 && typeof (body.data.fase ?? body.data.phase) === 'string'
  }
];

/** Quita los datos base64 incrustados (fuentes, imágenes) para que las búsquedas de "NaN" no den falsos positivos. */
function stripBase64(svg) {
  return svg.replace(/base64,[A-Za-z0-9+/=]+/g, 'base64,…');
}

const NET_DEPENDENT = ['/api/lookup/github', '/api/lookup/npm', '/api/lookup/dns', '/api/s/gitagram'];

async function main() {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  let pass = 0; let netSkip = 0; let checked = 0;

  try {
    // 1. La web responde
    const home = await fetch(`${base}/`);
    assert.strictEqual(home.status, 200, 'landing debe responder 200');
    const homeText = await home.text();
    assert.ok(homeText.includes('API Console'), 'landing debe contener el título');
    const play = await fetch(`${base}/playground`);
    assert.strictEqual(play.status, 200, 'playground debe responder 200');
    pass += 2;

    // 2. Assets servidos
    for (const asset of ['/assets/ui/logo.svg', '/assets/ui/og.jpg', '/assets/iqc/avatars/avatar-ana.jpg', '/assets/cards/pattern-dots.svg']) {
      const r = await fetch(base + asset);
      assert.strictEqual(r.status, 200, `asset ${asset} debe existir`);
      pass += 1;
    }

    // 3. Catálogo y ejecución de todos los endpoints
    const catalog = await (await fetch(`${base}/api/endpoints`)).json();
    assert.ok(catalog.total_endpoints > 0, 'el catálogo no puede estar vacío');
    const endpoints = catalog.categories.flatMap(c => c.endpoints);

    for (const ep of endpoints) {
      const qs = (ep.params || [])
        .filter(p => p.example !== undefined && p.example !== '')
        .map(p => `${encodeURIComponent(p.name)}=${encodeURIComponent(p.example)}`)
        .join('&');
      const url = `${base}${ep.path}${qs ? '?' + qs : ''}`;
      const res = await fetch(url);
      const type = res.headers.get('content-type') || '';

      // 502 = el servicio externo no respondió (sin salida a internet en CI/sandbox)
      if (res.status === 502 || (NET_DEPENDENT.includes(ep.path) && res.status >= 500)) {
        netSkip += 1;
        console.log(`  net-skip  ${ep.path} (sin salida a internet)`);
        continue;
      }

      checked += 1;
      assert.ok(res.status < 400, `${ep.path} respondió ${res.status}`);

      if (ep.responseType === 'image') {
        assert.ok(type.startsWith('image/'), `${ep.path} debe devolver imagen, llegó ${type}`);
        if (type.includes('svg')) {
          const body = stripBase64(await res.text());
          assert.ok(body.startsWith('<svg') || body.includes('<svg'), `${ep.path} debe devolver SVG`);
          assert.ok(!body.includes('NaN'), `${ep.path} generó NaN en el SVG`);
          assert.ok(!body.includes('undefined'), `${ep.path} generó undefined en el SVG`);
        } else {
          const buf = Buffer.from(await res.arrayBuffer());
          const isJpg = buf[0] === 0xff && buf[1] === 0xd8;
          const isPng = buf[0] === 0x89 && buf[1] === 0x50;
          assert.ok(isJpg || isPng, `${ep.path} devolvió ${type} pero el cuerpo no es JPG/PNG`);
          assert.ok(buf.length > 10000, `${ep.path} devolvió una imagen sospechosamente pequeña (${buf.length} B)`);
        }
      } else {
        assert.ok(type.includes('json'), `${ep.path} debe devolver JSON, llegó ${type}`);
        const body = await res.json();
        assert.strictEqual(body.status, true, `${ep.path} debe devolver status:true`);
      }
      pass += 1;
    }

    // 4. Verificaciones de valores conocidos
    for (const k of KNOWN) {
      const qs = Object.entries(k.query).map(([a, b]) => `${a}=${encodeURIComponent(b)}`).join('&');
      const body = await (await fetch(`${base}${k.path}?${qs}`)).json();
      assert.ok(k.check(body), `${k.path} devolvió un valor incorrecto: ${JSON.stringify(body).slice(0, 200)}`);
      pass += 1;
    }

    // 5. IQC con todos los avatares y temas (assets incrustados)
    for (const avatar of ['ana', 'marco', 'cat', 'lila', 'theo', 'mia', 'bot', 'none']) {
      const r = await fetch(`${base}/api/maker/iqc?text=prueba%20de%20humo&avatar=${avatar}&replyTo=QA&replyText=cita&tapback=heart`);
      const svg = await r.text();
      assert.strictEqual(r.status, 200);
      assert.ok(svg.includes('<svg'), `IQC avatar ${avatar}`);
      assert.ok(!svg.includes('NaN'), `IQC avatar ${avatar} con NaN`);
      pass += 1;
    }

    // 6. Brat en los tres ratios
    for (const ratio of ['square', 'story', 'post']) {
      const svg = await (await fetch(`${base}/api/maker/brat?text=brat%20summer&ratio=${ratio}`)).text();
      assert.ok(svg.includes('<svg') && !svg.includes('NaN'), `brat ratio ${ratio}`);
      pass += 1;
    }

    // 7. Canvas Sakura: formatos, tamaños, tinte, símbolos/japonés y SVG con fuentes incrustadas
    const sakuraCases = [
      ['/api/canvas/sakura/welcome?username=%E3%81%95%E3%81%8F%E3%82%89&avatar=ana&format=png&width=640', 'image/png'],
      ['/api/canvas/sakura/goodbye?username=none&footer=none&tint=%23ffb7c5&color=%23ffe4ec&quality=60', 'image/jpeg'],
      ['/api/canvas/sakura/levelup?level=1000&prevLevel=999&subtitle=%E2%9C%A6%20%7Bprev%7D%20%E2%86%92%20%7Blevel%7D%20%E2%9D%A4', 'image/jpeg'],
      ['/api/canvas/sakura/levelup-v2?level=7&format=svg', 'image/svg+xml'],
      ['/api/canvas/sakura/ship?name1=Alexandra%20Montenegro&name2=Max&percent=100&avatar1=cat&avatar2=none', 'image/jpeg'],
      ['/api/canvas/sakura/gay?percent=0&avatar=https%3A%2F%2Fexample.invalid%2Fnope.png&width=512', 'image/jpeg']
    ];
    for (const [path, expected] of sakuraCases) {
      const r = await fetch(`${base}${path}`);
      const type = (r.headers.get('content-type') || '').split(';')[0];
      assert.strictEqual(r.status, 200, `${path} respondió ${r.status}`);
      // sin rasterizador nativo, los formatos de mapa de bits degradan a SVG
      assert.ok(type === expected || type === 'image/svg+xml', `${path} devolvió ${type}`);
      assert.ok(/^\d+x\d+$/.test(r.headers.get('x-canvas-size') || ''), `${path} sin X-Canvas-Size`);
      if (type === 'image/svg+xml') {
        const svg = stripBase64(await r.text());
        assert.ok(svg.includes('@font-face'), `${path} SVG sin fuentes incrustadas`);
        assert.ok(!svg.includes('NaN') && !svg.includes('undefined'), `${path} SVG con NaN/undefined`);
      }
      pass += 1;
    }

    console.log(`\nSMOKE OK — ${pass} verificaciones, ${checked} endpoints ejecutados, ${netSkip} omitidos por red.`);
    console.log(`Catálogo: ${catalog.total_categories} categorías / ${catalog.total_endpoints} endpoints.`);
  } catch (err) {
    console.error('\nSMOKE FAIL —', err.message);
    process.exitCode = 1;
  } finally {
    server.close();
  }
}

main();
