/* Playground de API Console v3: catálogo en vivo, búsqueda, filtros,
   ejecución con parámetros y generador de snippets (URL / cURL / fetch / Python). */

document.addEventListener('DOMContentLoaded', () => {
  let catalog = { categories: [] };
  let activeCategory = 'ALL';
  let activeMethod = 'ALL';
  let searchQuery = '';
  let selected = null;
  let snippetLang = 'url';
  let lastResponseText = '';
  let lastContentType = '';
  let lastHeadersText = '';

  const $ = id => document.getElementById(id);
  const listEl = $('endpoint-list');
  const catPills = $('category-pills');
  const searchInput = $('endpoint-search');

  /* ---------- catálogo ---------- */
  async function load() {
    try {
      const [ep, st] = await Promise.all([fetch('/api/endpoints'), fetch('/api/stats')]);
      catalog = await ep.json();
      const stats = await st.json();
      $('summary-badge').textContent = `${catalog.total_categories} categorías · ${catalog.total_endpoints} endpoints`;
      $('hits-badge').textContent = `${stats.total_requests || 0} peticiones`;
      renderPills();
      renderList();
    } catch {
      listEl.innerHTML = '<p class="section-sub">No se pudo conectar con /api/endpoints.</p>';
    }
  }

  function renderPills() {
    const pills = [`<button type="button" class="pill ${activeCategory === 'ALL' ? 'active' : ''}" data-cat="ALL">Todas</button>`]
      .concat(catalog.categories.map(c =>
        `<button type="button" class="pill ${activeCategory === c.name ? 'active' : ''}" data-cat="${c.name}">${c.name} · ${c.count}</button>`));
    catPills.innerHTML = pills.join('');
    catPills.querySelectorAll('.pill').forEach(b => b.addEventListener('click', () => {
      activeCategory = b.dataset.cat;
      renderPills();
      renderList();
    }));
  }

  function filtered() {
    const q = searchQuery.trim().toLowerCase();
    return catalog.categories
      .filter(c => activeCategory === 'ALL' || c.name === activeCategory)
      .map(c => ({
        ...c,
        endpoints: c.endpoints.filter(e =>
          (activeMethod === 'ALL' || e.method === activeMethod) &&
          (!q || e.path.toLowerCase().includes(q) || e.name.toLowerCase().includes(q) || (e.description || '').toLowerCase().includes(q)))
      }))
      .filter(c => c.endpoints.length);
  }

  function renderList() {
    const cats = filtered();
    if (!cats.length) {
      listEl.innerHTML = '<p class="section-sub">Sin resultados para el filtro actual.</p>';
      return;
    }
    listEl.innerHTML = cats.map(c => `
      <div class="ep-group-title">${c.name}</div>
      ${c.endpoints.map(e => `
        <button type="button" class="ep-row" data-id="${e.id}">
          <span class="method-badge">${e.method}</span>
          <span class="ep-path">${e.path}</span>
          <span class="ep-desc">${e.description || e.name}</span>
        </button>`).join('')}
    `).join('');
    listEl.querySelectorAll('.ep-row').forEach(row => row.addEventListener('click', () => {
      const ep = catalog.categories.flatMap(c => c.endpoints).find(e => e.id === row.dataset.id);
      openModal(ep);
    }));
  }

  /* ---------- búsqueda y filtros ---------- */
  searchInput.addEventListener('input', () => { searchQuery = searchInput.value; renderList(); });
  document.addEventListener('keydown', e => {
    if (e.key === '/' && document.activeElement !== searchInput && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) {
      e.preventDefault();
      searchInput.focus();
    }
    if (e.key === 'Escape') closeModal();
  });
  $('method-pills').querySelectorAll('.pill').forEach(b => b.addEventListener('click', () => {
    activeMethod = b.dataset.method;
    $('method-pills').querySelectorAll('.pill').forEach(x => x.classList.toggle('active', x === b));
    renderList();
  }));

  /* ---------- modal ---------- */
  function openModal(ep) {
    selected = ep;
    snippetLang = 'url';
    const isImage = ep.responseType === 'image';
    $('modal-method').textContent = ep.method;
    $('modal-path').textContent = ep.path;
    $('modal-description').textContent = ep.description || '';
    buildForm(ep);
    lastContentType = '';   // no arrastrar la extensión del endpoint anterior
    lastResponseText = '';
    updateSnippets();

    // PREVIEW: se limpia por completo al cambiar de endpoint.
    resetPreview(isImage ? 'Generando vista previa…' : 'Este endpoint responde JSON. Abajo verás la respuesta.');
    $('response-viewer').innerHTML = '<div class="placeholder">Ejecuta el endpoint para ver la respuesta.</div>';
    $('resp-status').textContent = 'status: —';
    $('resp-status').classList.remove('bad');
    $('resp-time').textContent = '— ms';
    $('resp-type').textContent = isImage ? 'image' : 'json';
    renderRequestHeaders(ep);
    renderResponseHeaders(null);

    const live = $('live-toggle');
    if (live) {
      $('live-field').style.display = isImage ? '' : 'none';
      live.checked = isImage;
    }
    $('exec-modal').classList.add('open');
    // Las imágenes se previsualizan al instante; el resto se ejecuta a mano.
    if (isImage) execute({ quiet: true });
  }

  function closeModal() { $('exec-modal').classList.remove('open'); }
  $('modal-close').addEventListener('click', closeModal);
  $('exec-modal').addEventListener('click', e => { if (e.target === $('exec-modal')) closeModal(); });

  const AVATAR_KEYS = ['ana', 'marco', 'cat', 'lila', 'theo', 'mia', 'bot'];

  function attr(v) {
    return String(v === undefined || v === null ? '' : v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  function buildForm(ep) {
    const form = $('params-form');
    if (!ep.params || !ep.params.length) {
      form.innerHTML = '<p style="color:var(--muted); font-size:13px;">Este endpoint no recibe parámetros.</p>';
      return;
    }
    form.innerHTML = ep.params.map(p => {
      const hint = p.description ? `<span class="field-hint" title="${attr(p.description)}">${attr(p.description)}</span>` : '';
      const label = `<div class="field-label"><span>${p.name}${p.required ? ' <span class="req">requerido</span>' : ''}</span>${hint}</div>`;
      const example = p.example !== undefined && p.example !== null ? String(p.example) : '';
      if (p.type === 'select' && Array.isArray(p.options)) {
        return `${label}<select class="param-select" name="${p.name}">
          ${p.options.map(o => `<option value="${attr(o)}" ${o === p.example ? 'selected' : ''}>${attr(o)}</option>`).join('')}
        </select>`;
      }
      if (p.type === 'text') {
        return `${label}<textarea class="param-input param-textarea" name="${p.name}" rows="2" placeholder="${attr(p.description)}">${attr(example)}</textarea>`;
      }
      if (p.type === 'color') {
        const swatch = /^#[0-9a-f]{6}$/i.test(example) ? example : '#ffffff';
        return `${label}<div class="color-field">
          <input type="color" class="color-swatch" data-for="${p.name}" value="${swatch}" title="Elegir color" />
          <input class="param-input" name="${p.name}" value="${attr(example)}" placeholder="${attr(p.description)}" spellcheck="false" />
          <button type="button" class="snippet-tab clear-field" data-for="${p.name}" title="Vaciar">×</button>
        </div>`;
      }
      if (p.type === 'range') {
        const min = p.min !== undefined ? p.min : 0;
        const max = p.max !== undefined ? p.max : 100;
        const step = p.step || 1;
        const val = example !== '' ? example : Math.round((Number(min) + Number(max)) / 2);
        return `${label}<div class="range-field">
          <input type="range" class="range-slider" data-for="${p.name}" min="${min}" max="${max}" step="${step}" value="${attr(val)}" />
          <input class="param-input param-number" type="number" name="${p.name}" min="${min}" max="${max}" step="${step}" value="${attr(example)}" placeholder="auto" />
        </div>`;
      }
      if (p.type === 'number') {
        return `${label}<input class="param-input" type="number" name="${p.name}" ${p.min !== undefined ? `min="${p.min}"` : ''} ${p.max !== undefined ? `max="${p.max}"` : ''} value="${attr(example)}" placeholder="${attr(p.description)}" />`;
      }
      const isAvatar = p.type === 'url' && /^avatar/.test(p.name);
      const list = isAvatar ? `<datalist id="list-${p.name}">${AVATAR_KEYS.map(k => `<option value="${k}"></option>`).join('')}</datalist>` : '';
      return `${label}<input class="param-input" name="${p.name}" value="${attr(example)}" placeholder="${attr(p.description)}" ${isAvatar ? `list="list-${p.name}"` : ''} spellcheck="false" />${list}`;
    }).join('');
  }

  /* ---------- vista previa en vivo ---------- */
  const form = $('params-form');
  let liveTimer = null;

  function scheduleLive() {
    if (!selected || selected.responseType !== 'image') return;
    const live = $('live-toggle');
    if (live && !live.checked) return;
    clearTimeout(liveTimer);
    liveTimer = setTimeout(() => execute({ quiet: true }), 350);
  }

  form.addEventListener('input', e => {
    const t = e.target;
    if (t.classList.contains('color-swatch')) {
      const input = form.querySelector(`[name="${t.dataset.for}"]`);
      if (input) input.value = t.value;
    } else if (t.classList.contains('range-slider')) {
      const input = form.querySelector(`[name="${t.dataset.for}"]`);
      if (input) input.value = t.value;
    } else if (t.name) {
      const swatch = form.querySelector(`.color-swatch[data-for="${t.name}"]`);
      if (swatch && /^#[0-9a-f]{6}$/i.test(t.value.trim())) swatch.value = t.value.trim();
      const slider = form.querySelector(`.range-slider[data-for="${t.name}"]`);
      if (slider && t.value !== '') slider.value = t.value;
    }
    updateSnippets();
    scheduleLive();
  });

  form.addEventListener('click', e => {
    const btn = e.target.closest('.clear-field');
    if (!btn) return;
    const input = form.querySelector(`[name="${btn.dataset.for}"]`);
    if (input) { input.value = ''; updateSnippets(); scheduleLive(); }
  });

  $('reset-params').addEventListener('click', () => { if (selected) { buildForm(selected); updateSnippets(); scheduleLive(); } });

  function currentParams() {
    const out = [];
    if (!selected) return out;
    for (const p of selected.params || []) {
      const el = document.querySelector(`#params-form [name="${p.name}"]`);
      const val = el ? el.value.trim() : '';
      if (val) out.push([p.name, val]);
    }
    return out;
  }

  function buildUrl() {
    const qs = currentParams().map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    return `${selected.path}${qs ? '?' + qs : ''}`;
  }

  /* ---------- snippets ---------- */
  /** Escapa una URL para meterla dentro de comillas dobles de un comando shell. */
  function shellQuote(url) {
    return `"${url.replace(/(["\\$`])/g, '\\$1')}"`;
  }

  /** Extensión de archivo según el content-type de la respuesta. */
  function extFromType(type) {
    const t = String(type || '').split(';')[0].trim().toLowerCase();
    if (t.includes('svg')) return 'svg';
    if (t.includes('jpeg') || t.includes('jpg')) return 'jpg';
    if (t.includes('png')) return 'png';
    if (t.includes('webp')) return 'webp';
    if (t.includes('gif')) return 'gif';
    return 'img'; // todavía sin respuesta: extensión genérica
  }

  function updateSnippets() {
    if (!selected) return;
    const url = buildUrl();
    const abs = location.origin + url;
    const isImage = selected.responseType === 'image';
    $('open-raw').href = url;
    $('snippet-tabs').querySelectorAll('.snippet-tab').forEach(t => t.classList.toggle('active', t.dataset.lang === snippetLang));

    const snippets = {
      url: abs,

      curl: isImage
        ? `# guarda la imagen en un archivo (curl deduce la extensión con -OJ si el server la manda)\ncurl -L ${shellQuote(abs)} -o salida.${extFromType(lastContentType)}\n\n# o solo inspecciona las cabeceras\ncurl -I ${shellQuote(abs)}`
        : `# respuesta JSON formateada (requiere jq)\ncurl -s ${shellQuote(abs)} | jq .\n\n# sin jq\ncurl -s ${shellQuote(abs)}`,

      node: isImage
        ? `// Node.js 18+ (fetch y Buffer son globales)\nimport { writeFile } from "node:fs/promises";\n\nconst res = await fetch(${JSON.stringify(abs)});\nif (!res.ok) throw new Error(\`HTTP \${res.status}\`);\n\nconst buf = Buffer.from(await res.arrayBuffer());\nawait writeFile("salida.${extFromType(lastContentType)}", buf);\nconsole.log("bytes:", buf.length);`
        : `// Node.js 18+ (fetch es global)\nconst res = await fetch(${JSON.stringify(abs)});\nif (!res.ok) throw new Error(\`HTTP \${res.status}\`);\n\nconst data = await res.json();\nconsole.log(data);`,

      js: isImage
        ? `// en el navegador: úsala directo en un <img>…\nimg.src = ${JSON.stringify(abs)};\n\n// …o tráela como Blob para descargarla / subirla\nconst res = await fetch(${JSON.stringify(abs)});\nconst blob = await res.blob();\nconst objectUrl = URL.createObjectURL(blob);\n// recuerda liberarla: URL.revokeObjectURL(objectUrl)`
        : `const res = await fetch(${JSON.stringify(abs)});\nconst data = await res.json();\nconsole.log(data);`,

      python: isImage
        ? `import requests\n\nr = requests.get(${JSON.stringify(abs)})\nr.raise_for_status()\next = r.headers["content-type"].split("/")[-1].replace("svg+xml", "svg").replace("jpeg", "jpg")\nopen(f"salida.{ext}", "wb").write(r.content)`
        : `import requests\n\nr = requests.get(${JSON.stringify(abs)})\nr.raise_for_status()\nprint(r.json())`
    };

    $('snippet-box').textContent = snippets[snippetLang];
  }

  $('snippet-tabs').querySelectorAll('.snippet-tab').forEach(t => t.addEventListener('click', () => {
    snippetLang = t.dataset.lang;
    updateSnippets();
  }));

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); } catch { /* portapapeles no disponible */ }
  }
  function flash(btn, label = 'copiado') {
    if (!btn) return;
    const old = btn.textContent;
    btn.textContent = label;
    setTimeout(() => { btn.textContent = old; }, 1200);
  }
  $('copy-snippet').addEventListener('click', e => { copy($('snippet-box').textContent); flash(e.currentTarget); });
  $('copy-response').addEventListener('click', e => { copy(lastResponseText); flash(e.currentTarget); });
  $('copy-headers').addEventListener('click', e => { copy(lastHeadersText); flash(e.currentTarget); });

  /* ---------- PREVIEW ---------- */
  /** URL de la imagen actualmente en pantalla, para revocar su blob: al reemplazarla. */
  let shownBlobUrl = null;

  function resetPreview(message) {
    const frame = $('preview-frame');
    frame.classList.remove('loading', 'error', 'has-image');
    frame.innerHTML = `<div class="placeholder">${escapeHtml(message || '')}</div>`;
    if (shownBlobUrl) { URL.revokeObjectURL(shownBlobUrl); shownBlobUrl = null; }
    $('preview-meta').textContent = '—';
  }

  /**
   * Pinta la imagen en el preview. Crea el <img> con la URL blob y SOLO la muestra
   * cuando terminó de decodificar: así nunca se ve un ícono roto ni un hueco vacío.
   */
  function showPreviewImage(blobUrl, meta) {
    const frame = $('preview-frame');
    const previousUrl = shownBlobUrl;
    const img = new Image();
    img.alt = 'Vista previa de la respuesta del endpoint';
    img.decoding = 'async';
    img.addEventListener('load', () => {
      // Si llegó otra respuesta mientras tanto, esta ya no sirve.
      if (shownBlobUrl !== previousUrl) { URL.revokeObjectURL(blobUrl); return; }
      frame.innerHTML = '';
      frame.appendChild(img);
      frame.classList.add('has-image');
      frame.classList.remove('loading', 'error');
      shownBlobUrl = blobUrl;
      if (previousUrl) URL.revokeObjectURL(previousUrl);
    }, { once: true });
    img.addEventListener('error', () => {
      // La URL blob ya no es válida (petición abortada): se libera y no se toca el marco.
      URL.revokeObjectURL(blobUrl);
      frame.classList.remove('loading');
    }, { once: true });
    img.src = blobUrl;
    $('preview-meta').textContent = meta || '';
  }

  function failPreview(message) {
    const frame = $('preview-frame');
    frame.classList.remove('loading', 'has-image');
    frame.classList.add('error');
    frame.innerHTML = `<div class="placeholder">⚠ ${escapeHtml(message)}</div>`;
    $('preview-meta').textContent = 'error';
  }

  /* ---------- HEADER ---------- */
  const REQUEST_HEADERS = [
    ['GET', 'método HTTP de la petición'],
    ['Accept', 'lo que acepta el cliente (el navegador pide image/* y JSON)'],
    ['User-Agent', 'identificador del cliente que hace la petición'],
    ['Connection', 'keep-alive para reutilizar la conexión']
  ];

  function headerRows(pairs) {
    if (!pairs.length) return '<tr><td class="h-empty" colspan="2">Sin respuesta todavía.</td></tr>';
    return pairs.map(([k, v]) => `<tr><td class="h-key">${escapeHtml(k)}</td><td class="h-val">${escapeHtml(v)}</td></tr>`).join('');
  }

  function renderRequestHeaders(ep) {
    const rows = [['GET', ep ? ep.path : '/api/…']].concat(REQUEST_HEADERS.slice(1));
    $('request-headers').innerHTML = headerRows(rows);
    lastHeadersText = rows.map(([k, v]) => `${k}: ${v}`).join('\n');
  }

  function renderResponseHeaders(res) {
    const pairs = [];
    if (res) {
      pairs.push([':status', String(res.status)]);
      res.headers.forEach((v, k) => pairs.push([k, v]));
    }
    $('response-headers').innerHTML = headerRows(pairs);
    lastHeadersText = pairs.map(([k, v]) => `${k}: ${v}`).join('\n');
  }

  /* ---------- ejecución ---------- */
  let inflight = null;

  async function execute({ quiet = false } = {}) {
    if (!selected) return;
    if (inflight) inflight.abort();
    const controller = new AbortController();
    inflight = controller;
    const url = buildUrl();
    const start = performance.now();
    const isImageEndpoint = selected.responseType === 'image';
    $('resp-status').textContent = 'status: …';

    const viewer = $('response-viewer');
    const frame = $('preview-frame');
    frame.classList.add('loading');
    if (!isImageEndpoint || !frame.querySelector('img')) {
      frame.innerHTML = `<div class="placeholder">${isImageEndpoint ? 'Generando vista previa…' : 'Petición en curso…'}</div>`;
    }
    if (!quiet || !viewer.querySelector('pre')) {
      viewer.innerHTML = '<div class="placeholder">Petición en curso…</div>';
    }
    viewer.classList.add('loading');

    try {
      // `_pg` solo evita servir una copia cacheada del navegador en la vista previa en vivo.
      const liveToggle = $('live-toggle');
      const bust = isImageEndpoint && liveToggle && liveToggle.checked
        ? `${url.includes('?') ? '&' : '?'}_pg=${Date.now()}`
        : '';
      const res = await fetch(url + bust, { signal: controller.signal });
      const ms = Math.round(performance.now() - start);
      const type = res.headers.get('content-type') || '';
      lastContentType = type;
      $('resp-time').textContent = `${ms} ms`;
      $('resp-status').textContent = `status: ${res.status}`;
      $('resp-status').classList.toggle('bad', res.status >= 400);
      renderResponseHeaders(res);

      if (/^image\//.test(type)) {
        const blob = await res.blob();
        if (controller.signal.aborted) return;
        const canvasSize = res.headers.get('x-canvas-size');
        const shortType = type.split(';')[0].replace('image/', '').replace('svg+xml', 'svg');
        $('resp-type').textContent = `${shortType}${canvasSize ? ' · ' + canvasSize : ''} · ${(blob.size / 1024).toFixed(0)} KB`;
        lastResponseText = location.origin + url;
        viewer.innerHTML = `<pre>${escapeHtml(lastResponseText)}</pre>`;
        if (!res.ok) {
          failPreview(`El endpoint respondió ${res.status}. Revisa los parámetros.`);
        } else {
          showPreviewImage(URL.createObjectURL(blob), `${canvasSize || shortType} · ${(blob.size / 1024).toFixed(0)} KB`);
        }
        // Los snippets dependen de la extensión real de la respuesta.
        updateSnippets();
      } else if (type.includes('json')) {
        const data = await res.json();
        lastResponseText = JSON.stringify(data, null, 2);
        $('resp-type').textContent = 'json';
        viewer.innerHTML = `<pre>${escapeHtml(lastResponseText)}</pre>`;
        if (isImageEndpoint) {
          failPreview(`Se esperaba una imagen y llegó JSON${res.ok ? '' : ` (status ${res.status})`}.`);
        } else {
          frame.classList.remove('loading');
          $('preview-meta').textContent = 'json';
        }
      } else {
        const text = await res.text();
        lastResponseText = text;
        $('resp-type').textContent = type.split(';')[0] || 'text';
        viewer.innerHTML = `<pre>${escapeHtml(text)}</pre>`;
        if (isImageEndpoint) failPreview(`Se esperaba una imagen y llegó ${type.split(';')[0] || 'texto'}.`);
        else frame.classList.remove('loading');
      }

      const stats = await fetch('/api/stats').then(r => r.json()).catch(() => null);
      if (stats) $('hits-badge').textContent = `${stats.total_requests || 0} peticiones`;
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      $('resp-status').textContent = 'status: error';
      $('resp-status').classList.add('bad');
      viewer.innerHTML = `<pre>${escapeHtml(String(err))}</pre>`;
      failPreview('No se pudo completar la petición (red o CORS).');
    } finally {
      if (inflight === controller) { inflight = null; viewer.classList.remove('loading'); }
    }
  }

  form.addEventListener('submit', e => { e.preventDefault(); execute(); });
  const liveToggle = $('live-toggle');
  if (liveToggle) liveToggle.addEventListener('change', () => { if (liveToggle.checked) scheduleLive(); });

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  load();
});
