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
    $('modal-method').textContent = ep.method;
    $('modal-path').textContent = ep.path;
    $('modal-description').textContent = ep.description || '';
    buildForm(ep);
    updateSnippets();
    $('response-viewer').innerHTML = '<div class="placeholder">Ejecuta el endpoint para ver la respuesta.</div>';
    $('resp-status').textContent = 'status: —';
    $('resp-time').textContent = '— ms';
    $('resp-type').textContent = ep.responseType === 'image' ? 'image' : 'json';
    const live = $('live-toggle');
    if (live) {
      live.closest('.live-field').style.display = ep.responseType === 'image' ? '' : 'none';
      live.checked = ep.responseType === 'image';
    }
    $('exec-modal').classList.add('open');
    // Las imágenes se previsualizan al instante; el resto se ejecuta a mano.
    if (ep.responseType === 'image') execute({ quiet: true });
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
  function updateSnippets() {
    if (!selected) return;
    const url = buildUrl();
    const abs = location.origin + url;
    $('open-raw').href = url;
    $('snippet-tabs').querySelectorAll('.snippet-tab').forEach(t => t.classList.toggle('active', t.dataset.lang === snippetLang));
    const snippets = {
      url: abs,
      curl: `curl "${abs}"`,
      js: selected.responseType === 'image'
        ? `// imagen directa: úsala en un <img> o descárgala como Blob\nimg.src = "${abs}";\n\nconst blob = await (await fetch("${abs}")).blob();`
        : `const res = await fetch("${abs}");\nconst data = await res.json();\nconsole.log(data);`,
      python: selected.responseType === 'image'
        ? `import requests\n\nr = requests.get("${abs}")\next = r.headers["content-type"].split("/")[-1].replace("svg+xml", "svg").replace("jpeg", "jpg")\nopen(f"out.{ext}", "wb").write(r.content)`
        : `import requests\n\nr = requests.get("${abs}")\nprint(r.json())`
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
  $('copy-snippet').addEventListener('click', () => copy($('snippet-box').textContent));
  $('copy-response').addEventListener('click', () => copy(lastResponseText));

  /* ---------- ejecución ---------- */
  let inflight = null;
  let lastBlobUrl = null;

  async function execute({ quiet = false } = {}) {
    if (!selected) return;
    if (inflight) inflight.abort();
    const controller = new AbortController();
    inflight = controller;
    const url = buildUrl();
    const start = performance.now();
    $('resp-status').textContent = 'status: …';
    const viewer = $('response-viewer');
    if (!quiet || !viewer.querySelector('img')) viewer.innerHTML = '<div class="placeholder">Petición en curso…</div>';
    viewer.classList.add('loading');
    try {
      const res = await fetch(url, { signal: controller.signal });
      const ms = Math.round(performance.now() - start);
      const type = res.headers.get('content-type') || '';
      $('resp-time').textContent = `${ms} ms`;
      $('resp-status').textContent = `status: ${res.status}`;
      if (type.includes('json')) {
        const data = await res.json();
        lastResponseText = JSON.stringify(data, null, 2);
        $('resp-type').textContent = 'json';
        viewer.innerHTML = `<pre>${escapeHtml(lastResponseText)}</pre>`;
      } else if (/^image\//.test(type)) {
        const blob = await res.blob();
        if (controller.signal.aborted) return;
        if (lastBlobUrl) URL.revokeObjectURL(lastBlobUrl);
        lastBlobUrl = URL.createObjectURL(blob);
        lastResponseText = location.origin + url;
        const size = res.headers.get('x-canvas-size');
        $('resp-type').textContent = `${type.split(';')[0].replace('image/', '').replace('svg+xml', 'svg')}${size ? ' · ' + size : ''} · ${(blob.size / 1024).toFixed(0)} KB`;
        viewer.innerHTML = `<img src="${lastBlobUrl}" alt="Respuesta del endpoint" />`;
      } else {
        const text = await res.text();
        lastResponseText = text;
        $('resp-type').textContent = type.split(';')[0] || 'text';
        viewer.innerHTML = `<pre>${escapeHtml(text)}</pre>`;
      }
      const stats = await fetch('/api/stats').then(r => r.json()).catch(() => null);
      if (stats) $('hits-badge').textContent = `${stats.total_requests || 0} peticiones`;
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      $('resp-status').textContent = 'status: error';
      viewer.innerHTML = `<pre>${escapeHtml(String(err))}</pre>`;
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
