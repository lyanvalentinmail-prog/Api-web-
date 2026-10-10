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
    $('resp-type').textContent = ep.responseType === 'image' ? 'image/svg' : 'json';
    $('exec-modal').classList.add('open');
  }

  function closeModal() { $('exec-modal').classList.remove('open'); }
  $('modal-close').addEventListener('click', closeModal);
  $('exec-modal').addEventListener('click', e => { if (e.target === $('exec-modal')) closeModal(); });

  function buildForm(ep) {
    const form = $('params-form');
    if (!ep.params || !ep.params.length) {
      form.innerHTML = '<p style="color:var(--muted); font-size:13px;">Este endpoint no recibe parámetros.</p>';
      return;
    }
    form.innerHTML = ep.params.map(p => {
      const label = `<div class="field-label"><span>${p.name}</span>${p.required ? '<span class="req">requerido</span>' : ''}</div>`;
      if (p.type === 'select' && Array.isArray(p.options)) {
        return `${label}<select class="param-select" name="${p.name}">
          ${p.options.map(o => `<option value="${o}" ${o === p.example ? 'selected' : ''}>${o}</option>`).join('')}
        </select>`;
      }
      return `${label}<input class="param-input" name="${p.name}" value="${p.example !== undefined ? String(p.example).replace(/"/g, '&quot;') : ''}" placeholder="${p.description || ''}" />`;
    }).join('');
  }

  $('reset-params').addEventListener('click', () => { if (selected) buildForm(selected); });

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
      js: `const res = await fetch("${abs}");\n${selected.responseType === 'image'
        ? '// imagen SVG directa: úsala en un <img>\nimg.src = "' + url + '";'
        : 'const data = await res.json();\nconsole.log(data);'}`,
      python: selected.responseType === 'image'
        ? `import requests\n\nr = requests.get("${abs}")\nopen("out.svg", "wb").write(r.content)`
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
  $('params-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (!selected) return;
    const url = buildUrl();
    const start = performance.now();
    $('resp-status').textContent = 'status: …';
    $('response-viewer').innerHTML = '<div class="placeholder">Petición en curso…</div>';
    try {
      const res = await fetch(url);
      const ms = Math.round(performance.now() - start);
      const type = res.headers.get('content-type') || '';
      $('resp-time').textContent = `${ms} ms`;
      $('resp-status').textContent = `status: ${res.status}`;
      if (type.includes('json')) {
        const data = await res.json();
        lastResponseText = JSON.stringify(data, null, 2);
        $('resp-type').textContent = 'json';
        $('response-viewer').innerHTML = `<pre>${escapeHtml(lastResponseText)}</pre>`;
      } else {
        const text = await res.text();
        lastResponseText = text;
        $('resp-type').textContent = type.includes('svg') ? 'image/svg' : type.split(';')[0];
        const blobUrl = URL.createObjectURL(new Blob([text], { type: type || 'image/svg+xml' }));
        $('response-viewer').innerHTML = `<img src="${blobUrl}" alt="Respuesta del endpoint" />`;
      }
      const stats = await fetch('/api/stats').then(r => r.json()).catch(() => null);
      if (stats) $('hits-badge').textContent = `${stats.total_requests || 0} peticiones`;
    } catch (err) {
      $('resp-status').textContent = 'status: error';
      $('response-viewer').innerHTML = `<pre>${escapeHtml(String(err))}</pre>`;
    }
  });

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  load();
});
