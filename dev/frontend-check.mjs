// Comprobación de la interfaz web con jsdom (script de desarrollo, no forma parte del proyecto).
import { JSDOM, VirtualConsole } from 'jsdom';

const BASE = 'http://127.0.0.1:3000/';
const problems = [];
const logs = [];

const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', (error) => problems.push(`jsdomError: ${error.message}`));
virtualConsole.on('error', (...args) => logs.push(`console.error: ${args.join(' ')}`));
virtualConsole.on('warn', (...args) => logs.push(`console.warn: ${args.join(' ')}`));

const html = await (await fetch(BASE)).text();
const catalog = await (await fetch(`${BASE}api/catalog?compact=true`)).json();
const expected = catalog.data.count;

const dom = new JSDOM(html, {
  url: BASE,
  runScripts: 'dangerously',
  resources: 'usable',
  pretendToBeVisual: true,
  virtualConsole,
  beforeParse(window) {
    window.fetch = (...args) => globalThis.fetch(...args);
    window.Blob = globalThis.Blob;
    window.URL.createObjectURL = () => 'blob:fake';
  },
});

const { window } = dom;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const $ = (selector) => window.document.querySelector(selector);
const $$ = (selector) => Array.from(window.document.querySelectorAll(selector));

// Espera a que el catálogo se cargue (52 tarjetas).
for (let i = 0; i < 60 && $$('#endpointGrid .card').length < 10; i += 1) await wait(250);

function check(label, condition, detail = '') {
  if (condition) console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`);
  else {
    console.log(`  ✕ ${label}${detail ? ` — ${detail}` : ''}`);
    problems.push(label);
  }
}

console.log('Estado inicial');
check(`catálogo cargado (${expected} tarjetas)`, $$('#endpointGrid .card').length === expected, `${$$('#endpointGrid .card').length} tarjetas`);
check('contador del catálogo', new RegExp(`de ${expected} endpoints`).test($('#catalogCount').textContent), $('#catalogCount').textContent);
check(`chips de categorías (${catalog.data.categories.length} + todas)`, $$('#categoryChips .chip').length === catalog.data.categories.length + 1, `${$$('#categoryChips .chip').length} chips`);
check(`select del probador con ${expected} opciones`, $$('#endpointSelect option').length === expected, `${$$('#endpointSelect option').length} opciones`);
check('estadísticas de /api/info', $('#statGrid [data-stat="ownEndpoints"]').textContent === '27' && $('#statGrid [data-stat="externalEndpoints"]').textContent === '19', `propios=${$('#statGrid [data-stat="ownEndpoints"]').textContent} externos=${$('#statGrid [data-stat="externalEndpoints"]').textContent}`);
check('badges del hero actualizados', $$('#heroBadges .badge').length >= 4, `${$$('#heroBadges .badge').length} badges`);
check('límites de uso listados', $$('#rateLimitList li').length >= 3);
check('endpoint inicial seleccionado (health)', $('#endpointSelect').value === 'health', $('#endpointSelect').value);
check('URL de la petición construida', $('#urlPreview').textContent.includes('/api/health'), $('#urlPreview').textContent);
check('código de ejemplo generado', $('#codeOutput').textContent.includes('fetch('), `${$('#codeOutput').textContent.split('\n')[0]}`);

console.log('Filtros y búsqueda');
$('#searchInput').value = 'reverse';
$('#searchInput').dispatchEvent(new window.Event('input', { bubbles: true }));
await wait(400);
check('búsqueda "reverse" filtra tarjetas', $$('#endpointGrid .card').length === 1, `${$$('#endpointGrid .card').length} tarjetas`);
$('#searchInput').value = '';
$('#searchInput').dispatchEvent(new window.Event('input', { bubbles: true }));
await wait(400);
$('#methodFilter').value = 'POST';
$('#methodFilter').dispatchEvent(new window.Event('change', { bubbles: true }));
await wait(200);
const postCards = $$('#endpointGrid .card').length;
check('filtro por método POST', postCards > 0 && postCards < expected, `${postCards} tarjetas`);
$('#methodFilter').value = '';
$('#methodFilter').dispatchEvent(new window.Event('change', { bubbles: true }));
await wait(200);
$$('#categoryChips .chip')[3].click();
await wait(200);
check('filtro por categoría (chip)', $$('#endpointGrid .card').length > 0 && $('#categoryDescription').hidden === false, $('#categoryDescription').textContent?.slice(0, 40));
$$('#categoryChips .chip')[0].click();
await wait(200);

console.log('Probador: petición real (GET /api/math/add)');
$('#endpointSelect').value = 'math-add';
$('#endpointSelect').dispatchEvent(new window.Event('change', { bubbles: true }));
await wait(300);
check('documentación del endpoint renderizada', $$('#docsContent .panel').length >= 3, `${$$('#docsContent .panel').length} paneles`);
check('tabla de parámetros del endpoint seleccionado', $$('#docsContent .data-table tbody tr').length >= 2, `${$$('#docsContent .data-table tbody tr').length} filas`);
check('la documentación sigue al probador', $('#docsSelect').value === 'math-add', $('#docsSelect').value);
check('formulario con 2 parámetros', $$('#paramsContainer .param-row').length === 2, `${$$('#paramsContainer .param-row').length} filas`);
$('#testerForm').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
await wait(1500);
const bodyText = $('#responseBody').textContent;
check('respuesta 200 renderizada', $('#statusChip').textContent.includes('200'), $('#statusChip').textContent);
check('cuerpo con el resultado 8', bodyText.includes('"result": 8'), bodyText.replace(/\s+/g, ' ').slice(0, 90));
check('chip de tiempo', /ms|s/.test($('#timeChip').textContent), $('#timeChip').textContent);
check('encabezados en tabla', $$('#headersTable tbody tr').length >= 1, `${$$('#headersTable tbody tr').length} filas`);
check('historial con 1 entrada', $$('#historyList .history-item').length === 1, `${$$('#historyList .history-item').length} entradas`);

console.log('Probador: POST con cuerpo JSON (/api/json/validate)');
$('#endpointSelect').value = 'json-validate';
$('#endpointSelect').dispatchEvent(new window.Event('change', { bubbles: true }));
await wait(300);
$('#customBodyToggle').checked = true;
$('#customBodyToggle').dispatchEvent(new window.Event('change', { bubbles: true }));
$('#bodyInput').value = JSON.stringify({ json: '{"hola": "mundo",}' });
$('#testerForm').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
await wait(1500);
const validateText = $('#responseBody').textContent;
check('JSON inválido detectado con posición', validateText.includes('"valid": false') && validateText.includes('position'), validateText.replace(/\s+/g, ' ').slice(0, 120));
check('motivo claro en español', /Coma sobrante|Comillas|Sintaxis/.test(validateText), (validateText.match(/"message": "([^"]+)"/) || [])[1] || '');

console.log('Probador: código de ejemplo reutilizable');
$$('#codeTabs .code-tab').forEach((tab) => tab.click());
check('pestañas de lenguaje responden', $('#codeOutput').textContent.length > 20);

console.log('Estado (comprobación real contra la API)');
$('#checkStatus').click();
for (let i = 0; i < 80 && $$('#selfTestList .status-item').length < 5; i += 1) await wait(250);
check('pruebas propias listadas (13)', $$('#selfTestList .status-item').length === 13, `${$$('#selfTestList .status-item').length} pruebas`);
check('proveedores externos listados (16)', $$('#externalList .status-item').length === 16, `${$$('#externalList .status-item').length} proveedores`);
check('resumen con tarjetas', $$('#statusSummary .summary-card').length === 6, `${$$('#statusSummary .summary-card').length} tarjetas`);
check('todas las pruebas propias en verde', $$('#selfTestList .status-ok-mark').length === 13, `${$$('#selfTestList .status-ok-mark').length} ✓`);
check('aviso de red cuando no hay salida a Internet', $('#statusNotice').hidden === false, $('#statusNotice').textContent?.slice(0, 80));

console.log('Ejemplos rápidos y accesibilidad');
check('10 tarjetas de ejemplo', $$('#examplesGrid .example-card').length === 10, `${$$('#examplesGrid .example-card').length} tarjetas`);
check('nav móvil alterna con aria-expanded', (() => {
  const toggle = $('#navToggle');
  toggle.click();
  const open = $('#mainNav').classList.contains('is-open') && toggle.getAttribute('aria-expanded') === 'true';
  toggle.click();
  return open && !$('#mainNav').classList.contains('is-open');
})());
check('enlaces del pie a la API', $$('.footer-links a').length === 5);
check('botones de copiar presentes', $$('.copy-btn').length > 10, `${$$('.copy-btn').length} botones`);

// Errores de consola del navegador
const realLogs = logs.filter((line) => !/Not implemented|Could not parse CSS/.test(line));
if (realLogs.length) {
  console.log('\nMensajes de consola:');
  for (const line of realLogs.slice(0, 12)) console.log('  !', line);
  problems.push(`mensajes de consola: ${realLogs.length}`);
}

console.log(`\n${problems.length === 0 ? '✅ Interfaz sin problemas detectados' : `❌ Problemas: ${JSON.stringify(problems, null, 2)}`}`);
process.exit(problems.length === 0 ? 0 : 1);
