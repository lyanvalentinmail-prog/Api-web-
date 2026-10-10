/* FreeAPI Hub — interfaz web (catálogo, probador, documentación y estado) */
'use strict';

const App = (() => {
  const BASE_URL = window.location.origin;

  /** Estado en memoria de la interfaz. */
  const state = {
    info: null,
    catalog: null,
    categories: [],
    endpoints: [],
    filters: { search: '', type: '', method: '', category: '' },
    selectedId: null,
    selectedMethod: null,
    values: {},
    customBody: false,
    codeLang: 'javascript',
    lastRequest: null,
    lastResponse: null,
    history: [],
    statusLoaded: false,
  };

  /* ------------------------------------------------------------------ API */

  /** Petición a la API propia, con el cuerpo y las cabeceras adecuadas. */
  async function api(path, options = {}) {
    const response = await fetch(`${BASE_URL}${path}`, {
      headers: { accept: 'application/json', ...(options.body ? { 'content-type': 'application/json' } : {}) },
      ...options,
    });
    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { ok: false, error: { code: 'RESPUESTA_NO_JSON', message: text.slice(0, 300) || 'Respuesta vacía' } };
    }
    return { response, body, text };
  }

  /* --------------------------------------------------------- carga inicial */

  async function loadInfo() {
    try {
      const { body } = await api('/api/info');
      if (!body || !body.ok) throw new Error('Respuesta no válida de /api/info');
      state.info = body.data;

      const info = body.data;
      FH.$('#brandVersion').textContent = `v${info.version} · ${info.counts.totalEndpoints} endpoints`;
      FH.$('#authState').textContent = 'no hace falta ninguna';

      for (const [key, value] of Object.entries(info.counts)) {
        const node = FH.$(`[data-stat="${key}"]`);
        if (node) node.textContent = value;
      }

      const badges = FH.$('#heroBadges');
      badges.textContent = '';
      badges.append(
        FH.el('li', { class: 'badge badge-live' }, [FH.el('span', { class: 'dot' }), 'Servidor en marcha y respondiendo']),
        FH.el('li', { class: 'badge' }, 'Sin registro, sin login y sin API key'),
        FH.el('li', { class: 'badge' }, `${info.counts.ownEndpoints + info.counts.demoEndpoints} endpoints propios`),
        FH.el('li', { class: 'badge' }, `${info.counts.externalEndpoints} endpoints de terceros`),
        FH.el('li', { class: 'badge' }, 'CORS abierto para uso público')
      );

      FH.$('#testerBase').textContent = `Base: ${BASE_URL}`;
      FH.$('#examplesBase').textContent = `Base: ${BASE_URL}`;

      const limits = FH.$('#rateLimitList');
      limits.textContent = '';
      for (const [name, text] of Object.entries(info.rateLimits || {})) {
        const label = { general: 'Peticiones generales', external: 'Endpoints externos', write: 'Métodos de escritura' }[name] || name;
        limits.append(FH.el('li', {}, [FH.el('strong', { text: `${label}: ` }), text]));
      }
      limits.append(
        FH.el('li', {}, [
          FH.el('strong', { text: 'Proveedores externos: ' }),
          'cada uno impone su propia cuota gratuita (por ejemplo 100 peticiones al día o por hora). Se indica en la documentación de cada endpoint y el servidor cachea las respuestas para no agotarla.',
        ])
      );
    } catch (error) {
      const badges = FH.$('#heroBadges');
      badges.textContent = '';
      badges.append(FH.el('li', { class: 'badge badge-live is-error' }, [FH.el('span', { class: 'dot' }), 'No se pudo contactar con /api/info']));
      FH.toast(`Error cargando la información del servicio: ${error.message}`, 'error');
    }
  }

  async function loadCatalog() {
    try {
      const { body } = await api('/api/catalog');
      if (!body || !body.ok) throw new Error(body?.error?.message || 'Respuesta no válida de /api/catalog');
      state.catalog = body.data;
      state.categories = body.data.categories;
      state.endpoints = body.data.endpoints;

      renderCategoryChips();
      renderEndpointSelects();
      renderGrid();
      renderExamplesSection();

      const initial = state.endpoints.find((endpoint) => endpoint.id === 'health') || state.endpoints[0];
      selectEndpoint(initial.id, { scroll: false });
      renderDocs(initial.id);
    } catch (error) {
      FH.$('#endpointGrid').textContent = '';
      FH.$('#endpointGrid').append(
        FH.el('p', { class: 'empty' }, `No se pudo cargar el catálogo: ${error.message}. Comprueba que el servidor Node.js esté en marcha.`)
      );
      FH.toast(`Error cargando el catálogo: ${error.message}`, 'error');
    }
  }

  /* ------------------------------------------------------------- catálogo */

  function renderCategoryChips() {
    const container = FH.$('#categoryChips');
    container.textContent = '';

    const all = FH.el('button', {
      class: `chip${state.filters.category === '' ? ' is-active' : ''}`,
      type: 'button',
      onclick: () => setFilter('category', ''),
    }, ['Todas las categorías ', FH.el('small', { text: `(${state.endpoints.length})` })]);
    container.append(all);

    for (const category of state.categories) {
      const count = state.endpoints.filter((endpoint) => endpoint.category === category.id).length;
      container.append(
        FH.el('button', {
          class: `chip${state.filters.category === category.id ? ' is-active' : ''}`,
          type: 'button',
          title: category.description,
          onclick: () => setFilter('category', state.filters.category === category.id ? '' : category.id),
        }, [category.name, ' ', FH.el('small', { text: `(${count})` })])
      );
    }
  }

  function setFilter(key, value) {
    state.filters[key] = value;
    const control = { search: '#searchInput', type: '#typeFilter', method: '#methodFilter' }[key];
    if (control) {
      const node = FH.$(control);
      if (node && node.value !== value) node.value = value;
    }
    renderCategoryChips();
    renderGrid();
  }

  function visibleEndpoints() {
    const { search, type, method, category } = state.filters;
    const needle = search.trim().toLowerCase();
    return state.endpoints.filter((endpoint) => {
      if (type && endpoint.type !== type) return false;
      if (method && !endpoint.methods.includes(method)) return false;
      if (category && endpoint.category !== category) return false;
      if (needle) {
        const haystack = [endpoint.name, endpoint.summary, endpoint.path, endpoint.category, endpoint.provider || '', ...(endpoint.tags || [])]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }

  function renderGrid() {
    const grid = FH.$('#endpointGrid');
    const list = visibleEndpoints();
    grid.textContent = '';

    FH.$('#catalogCount').textContent = `${list.length} de ${state.endpoints.length} endpoints`;
    FH.$('#emptyState').hidden = list.length !== 0;

    const description = FH.$('#categoryDescription');
    const category = state.categories.find((item) => item.id === state.filters.category);
    description.hidden = !category;
    if (category) description.textContent = category.description;

    list.forEach((endpoint, index) => {
      const card = renderCard(endpoint);
      card.style.animationDelay = `${Math.min(index * 18, 320)}ms`;
      grid.append(card);
    });
  }

  function renderCard(endpoint) {
    const type = FH.typeInfo(endpoint.type);
    const card = FH.el('article', {
      class: `card${state.selectedId === endpoint.id ? ' is-selected' : ''}`,
      'data-id': endpoint.id,
    });

    card.append(
      FH.el('div', { class: 'card-top' }, [
        FH.el('h3', { text: endpoint.name }),
        FH.el('div', { class: 'card-tags' }, endpoint.methods.map((method) => FH.el('span', { class: FH.methodClass(method), text: method }))),
      ]),
      FH.el('div', { class: 'card-tags' }, [
        FH.el('span', { class: type.cls, title: type.help, text: type.label }),
        FH.el('span', { class: 'tag tag-category', text: state.categories.find((item) => item.id === endpoint.category)?.name || endpoint.category }),
        ...(endpoint.provider ? [FH.el('span', { class: 'tag', text: endpoint.provider })] : []),
      ]),
      FH.el('div', { class: 'card-path' }, [FH.el('span', { text: `${endpoint.methods[0]} ${endpoint.path}` }), FH.copyButton(() => `${BASE_URL}${endpoint.path}`, 'Copiar ruta del endpoint')]),
      FH.el('p', { class: 'card-summary', text: endpoint.summary })
    );

    const actions = FH.el('div', { class: 'card-actions' }, [
      FH.el('button', {
        class: 'btn btn-primary btn-sm',
        type: 'button',
        text: 'Probar',
        onclick: () => {
          selectEndpoint(endpoint.id, { scroll: true });
        },
      }),
      FH.el('button', {
        class: 'btn btn-ghost btn-sm',
        type: 'button',
        text: 'Documentación',
        onclick: () => {
          renderDocs(endpoint.id);
          FH.$('#documentacion').scrollIntoView({ behavior: 'smooth', block: 'start' });
        },
      }),
    ]);

    if (endpoint.type === 'demo' && endpoint.id === 'demo-reset') {
      actions.append(FH.el('span', { class: 'mini-note', text: 'Borra los cambios de la demo.' }));
    }

    card.append(actions);
    return card;
  }

  /* -------------------------------------------------------------- selects */

  function renderEndpointSelects() {
    const tester = FH.$('#endpointSelect');
    const docs = FH.$('#docsSelect');
    tester.textContent = '';
    docs.textContent = '';

    for (const category of state.categories) {
      const group = FH.el('optgroup', { label: category.name });
      const groupDocs = FH.el('optgroup', { label: category.name });
      for (const endpoint of state.endpoints.filter((item) => item.category === category.id)) {
        const label = `${endpoint.methods.join('/')} ${endpoint.path} — ${endpoint.name}`;
        group.append(FH.el('option', { value: endpoint.id, text: label }));
        groupDocs.append(FH.el('option', { value: endpoint.id, text: label }));
      }
      if (group.children.length) {
        tester.append(group);
        docs.append(groupDocs);
      }
    }

    tester.onchange = () => selectEndpoint(tester.value, { scroll: false });
    docs.onchange = () => renderDocs(docs.value);
  }

  function currentEndpoint() {
    return state.endpoints.find((endpoint) => endpoint.id === state.selectedId) || null;
  }

  /* ------------------------------------------------------------- probador */

  function selectEndpoint(id, { scroll = true } = {}) {
    const endpoint = state.endpoints.find((item) => item.id === id);
    if (!endpoint) return;

    state.selectedId = id;
    state.selectedMethod = endpoint.methods[0];
    state.customBody = false;
    state.values = {};

    // Precarga: valores obligatorios y de ruta con su ejemplo.
    for (const param of endpoint.parameters) {
      if (param.name === 'cualquiera') continue;
      if (param.required || param.in === 'path') state.values[param.name] = param.example !== undefined ? String(param.example) : '';
    }

    FH.$('#endpointSelect').value = id;
    FH.$('#docsSelect').value = id;

    renderMethodChips();
    renderParams();
    renderTesterLimits();
    updateUrlPreview();
    // La sección de documentación sigue al endpoint elegido en el probador.
    renderDocs(id);

    for (const card of FH.$$('.card')) card.classList.toggle('is-selected', card.dataset.id === id);

    if (scroll) FH.$('#probador').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderMethodChips() {
    const endpoint = currentEndpoint();
    const container = FH.$('#methodChips');
    container.textContent = '';
    if (!endpoint) return;

    for (const method of endpoint.methods) {
      container.append(
        FH.el('button', {
          class: `method-btn${state.selectedMethod === method ? ' is-active' : ''}`,
          type: 'button',
          text: method,
          onclick: () => {
            state.selectedMethod = method;
            renderMethodChips();
            renderParams();
            updateUrlPreview();
          },
        })
      );
    }

    const hint = FH.$('#methodHint');
    hint.textContent =
      endpoint.methods.length === 1
        ? `Este endpoint sólo admite ${endpoint.methods[0]}; los demás métodos responden 405 con un mensaje claro.`
        : `Métodos admitidos: ${endpoint.methods.join(', ')}. Puedes probar los demás para ver el error 405 de la API.`;
  }

  function paramInput(param, value, onChange) {
    const isLong = ['text', 'json', 'data', 'description', 'search', 'items', 'numbers'].includes(param.name) && !param.enum;
    const input = isLong
      ? FH.el('textarea', { rows: param.name === 'json' ? 4 : 2, spellcheck: 'false', placeholder: String(param.example ?? '') })
      : FH.el('input', { type: 'text', placeholder: String(param.example ?? ''), inputmode: param.type === 'number' || param.type === 'integer' ? 'decimal' : 'text' });

    if (param.enum) {
      const select = FH.el('select');
      select.append(FH.el('option', { value: '', text: '— usar valor por defecto —' }));
      for (const option of param.enum) select.append(FH.el('option', { value: option, text: option }));
      input.replaceWith(select);
      select.value = value ?? '';
      select.addEventListener('input', () => onChange(select.value));
      return select;
    }

    input.value = value ?? '';
    input.addEventListener('input', () => onChange(input.value));
    return input;
  }

  function renderParams() {
    const endpoint = currentEndpoint();
    const container = FH.$('#paramsContainer');
    container.textContent = '';
    if (!endpoint) return;

    const bodyField = FH.$('#bodyField');
    const customWrap = FH.$('#customBodyWrap');
    const bodyParams = endpoint.parameters.filter((param) => param.in === 'body');

    for (const param of endpoint.parameters) {
      if (param.name === 'cualquiera') {
        const free = FH.el('input', { type: 'text', placeholder: 'debug=1&hola=mundo' });
        free.value = state.values.__free || '';
        free.addEventListener('input', () => {
          state.values.__free = free.value;
          updateUrlPreview();
        });
        container.append(
          FH.el('div', { class: 'param-row' }, [
            FH.el('label', { class: 'param-label' }, [FH.el('code', { text: 'parámetros libres' }), FH.el('span', { class: 'tag', text: 'opcional' })]),
            FH.el('p', { class: 'param-desc', text: 'Escribe cualquier pareja clave=valor separada por & (por ejemplo debug=1&hola=mundo). Se devolverá tal cual en la respuesta.' }),
            free,
          ])
        );
        continue;
      }

      if (param.in === 'body' && ['GET', 'HEAD'].includes(state.selectedMethod)) continue;

      const value = state.values[param.name] ?? '';
      const input = paramInput(param, value, (next) => {
        state.values[param.name] = next;
        if (param.in === 'body') updateBodyPreview();
        updateUrlPreview();
      });

      const badges = [
        FH.el('span', { class: 'tag', text: param.in === 'path' ? 'ruta' : param.in === 'body' ? 'cuerpo' : 'query' }),
        FH.el('span', { class: `tag ${param.required ? 'tag-own' : ''}`, text: param.required ? 'obligatorio' : 'opcional' }),
        param.type ? FH.el('span', { class: 'tag', text: param.type }) : null,
      ].filter(Boolean);

      if (param.example !== undefined && param.example !== '') {
        badges.push(
          FH.el('span', { class: 'param-example' }, [
            FH.el('button', {
              type: 'button',
              text: `usar ejemplo: ${String(param.example).slice(0, 26)}`,
              onclick: () => {
                state.values[param.name] = String(param.example);
                if (input.tagName === 'SELECT') input.value = String(param.example);
                else input.value = String(param.example);
                if (param.in === 'body') updateBodyPreview();
                updateUrlPreview();
              },
            }),
          ])
        );
      }

      container.append(
        FH.el('div', { class: 'param-row' }, [
          FH.el('label', { class: 'param-label' }, [FH.el('code', { text: param.name }), ...badges]),
          FH.el('p', { class: 'param-desc', text: param.description || '' }),
          input,
        ])
      );
    }

    // Cuerpo editable a mano (útil para JSON complejo, como /api/json/validate).
    if (bodyParams.length > 0 && !['GET', 'HEAD'].includes(state.selectedMethod)) {
      customWrap.hidden = false;
      bodyField.hidden = !state.customBody;
      FH.$('#customBodyToggle').checked = state.customBody;
      updateBodyPreview();
    } else {
      customWrap.hidden = true;
      bodyField.hidden = true;
    }
  }

  /** Cuerpo que se enviará, generado a partir de los campos del formulario. */
  function generatedBody() {
    const endpoint = currentEndpoint();
    if (!endpoint) return null;
    const request = Examples.buildRequest(endpoint, state.values, BASE_URL, state.selectedMethod);
    return request.body;
  }

  function updateBodyPreview() {
    const area = FH.$('#bodyInput');
    if (!area || FH.$('#bodyField').hidden) return;
    if (!state.customBody) area.value = FH.pretty(generatedBody() ?? {});
  }

  function updateUrlPreview() {
    const endpoint = currentEndpoint();
    if (!endpoint) return;
    const request = Examples.buildRequest(endpoint, state.values, BASE_URL, state.selectedMethod);
    state.lastRequest = request;
    FH.$('#urlPreview').textContent = request.url;
    renderCode(state.codeLang, request);
  }

  function renderTesterLimits() {
    const endpoint = currentEndpoint();
    const node = FH.$('#testerLimits');
    if (!endpoint || !state.info) {
      node.textContent = '';
      return;
    }
    const base = endpoint.type === 'external' ? state.info.rateLimits.external : state.info.rateLimits.general;
    const extra =
      endpoint.type === 'external'
        ? ` Además, el proveedor ${endpoint.provider} impone su propia cuota: el servidor guarda la respuesta en caché para no agotarla.`
        : endpoint.type === 'demo'
          ? ' Los datos del CRUD de ejemplo viven en memoria y se reinician al reiniciar el servidor.'
          : '';
    node.textContent = `Límite aplicado por este servidor: ${base}.${extra}`;
  }

  /* ------------------------------------------------------------ petición */

  async function sendRequest(event) {
    event.preventDefault();
    const endpoint = currentEndpoint();
    if (!endpoint) return;

    let request = Examples.buildRequest(endpoint, state.values, BASE_URL, state.selectedMethod);

    if (state.customBody && !FH.$('#bodyField').hidden) {
      const text = FH.$('#bodyInput').value.trim();
      if (text !== '') {
        try {
          request = { ...request, body: JSON.parse(text) };
          state.values.__customBody = text;
        } catch (error) {
          FH.toast(`El cuerpo JSON no es válido: ${error.message}`, 'error');
          return;
        }
      } else {
        request = { ...request, body: null };
      }
    }

    const isBodyMethod = !['GET', 'HEAD'].includes(request.method);
    const hasBody = isBodyMethod && request.body !== null;

    const spinner = FH.$('#sendSpinner');
    const button = FH.$('#sendButton');
    spinner.hidden = false;
    button.disabled = true;
    const startedAt = performance.now();

    try {
      const response = await fetch(request.url, {
        method: request.method,
        headers: {
          accept: 'application/json',
          ...(hasBody ? { 'content-type': 'application/json' } : {}),
        },
        ...(hasBody ? { body: JSON.stringify(request.body) } : {}),
      });
      const clientMs = performance.now() - startedAt;
      const text = await response.text();

      let payload = null;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        payload = null;
      }

      renderResponse({ request, response, clientMs, text, payload });
      pushHistory(request, response.status, clientMs);
    } catch (error) {
      const clientMs = performance.now() - startedAt;
      FH.toast(`No se pudo completar la petición: ${error.message}`, 'error');
      FH.$('#statusChip').hidden = false;
      FH.$('#statusChip').className = 'meta-chip meta-err';
      FH.$('#statusChip').textContent = 'Sin respuesta';
      FH.$('#responseBody').innerHTML = FH.highlightJson({
        error: 'La petición no llegó a completarse',
        detalle: error.message,
        sugerencia: 'Comprueba que el servidor sigue en marcha y que la URL es correcta.',
        duracion_cliente_ms: Math.round(clientMs),
      });
    } finally {
      spinner.hidden = true;
      button.disabled = false;
    }
  }

  function statusClass(status) {
    if (status >= 200 && status < 300) return 'meta-chip meta-ok';
    if (status >= 400 && status < 500) return 'meta-chip meta-warn';
    return 'meta-chip meta-err';
  }

  /** Busca imágenes en la respuesta para poder mostrarlas (QR, fotos de perros, avatares). */
  function findImages(payload) {
    const images = [];
    const data = payload?.data;
    if (!data) return images;
    if (typeof data.dataUrl === 'string' && data.dataUrl.startsWith('data:image')) images.push({ src: data.dataUrl, caption: 'Imagen generada por el proveedor externo' });
    const raw = data.raw;
    if (raw && typeof raw.message === 'string' && /^https?:\/\/\S+\.(jpg|jpeg|png|gif|webp|svg)$/i.test(raw.message)) {
      images.push({ src: raw.message, caption: `Imagen servida por ${data.provider || 'el proveedor'}` });
    }
    if (raw && Array.isArray(raw.results)) {
      for (const user of raw.results.slice(0, 4)) {
        if (user?.picture?.large) images.push({ src: user.picture.large, caption: `${user.name?.first || 'Usuario'} ${user.name?.last || ''} (dato ficticio)` });
      }
    }
    return images;
  }

  function renderResponse({ request, response, clientMs, text, payload }) {
    state.lastResponse = { request, status: response.status, text, payload };

    const statusChip = FH.$('#statusChip');
    statusChip.hidden = false;
    statusChip.className = statusClass(response.status);
    statusChip.textContent = `HTTP ${response.status} ${response.statusText || ''}`.trim();

    const serverMs = payload?.meta?.durationMs;
    const timeChip = FH.$('#timeChip');
    timeChip.hidden = false;
    timeChip.className = 'meta-chip';
    timeChip.textContent = serverMs !== undefined
      ? `${FH.formatMs(serverMs)} en servidor · ${FH.formatMs(clientMs)} total`
      : `${FH.formatMs(clientMs)} (medido en el navegador)`;

    const sizeChip = FH.$('#sizeChip');
    sizeChip.hidden = false;
    sizeChip.className = 'meta-chip';
    sizeChip.textContent = `${FH.formatBytes(new Blob([text]).size)} · ${text.length} caracteres`;

    const view = FH.$('#responseBody');
    view.innerHTML = payload ? FH.highlightJson(payload) : FH.escapeHtml(text || '(respuesta vacía)');

    const preview = FH.$('#imagePreview');
    preview.textContent = '';
    const images = findImages(payload);
    preview.hidden = images.length === 0;
    for (const image of images) {
      preview.append(
        FH.el('figure', { style: 'margin:0' }, [
          FH.el('img', { src: image.src, alt: image.caption, loading: 'lazy' }),
          FH.el('figcaption', { text: image.caption }),
        ])
      );
    }

    // Encabezados de la respuesta tal como los ve el navegador.
    const tbody = FH.el('tbody');
    const headerEntries = Array.from(response.headers.entries());
    if (payload?.meta?.requestId) headerEntries.push(['x-request-id-cuerpo', payload.meta.requestId]);
    if (headerEntries.length === 0) {
      tbody.append(FH.el('tr', {}, [FH.el('td', { colspan: '2', class: 'muted', text: 'El navegador no expone encabezados para esta respuesta.' })]));
    } else {
      for (const [name, value] of headerEntries) {
        tbody.append(FH.el('tr', {}, [FH.el('td', { class: 'mono', text: name }), FH.el('td', { class: 'mono', text: value })]));
      }
    }
    FH.$('#headersTable').replaceChildren(theadRow(), tbody);

    renderCode(state.codeLang, request);
  }

  function theadRow() {
    const head = FH.el('thead');
    head.append(FH.el('tr', {}, [FH.el('th', { text: 'Encabezado' }), FH.el('th', { text: 'Valor' })]));
    return head;
  }

  function renderCode(lang, request) {
    const snippets = Examples.forRequest(request || state.lastRequest || { method: 'GET', url: `${BASE_URL}/api/health`, body: null });
    const output = FH.$('#codeOutput');
    output.textContent = snippets[lang] || snippets.javascript;
    state.codeLang = lang;
    for (const tab of FH.$$('#codeTabs .code-tab')) tab.classList.toggle('is-active', tab.dataset.lang === lang);
  }

  function pushHistory(request, status, clientMs) {
    state.history.unshift({
      method: request.method,
      url: request.url,
      status,
      ms: Math.round(clientMs),
      at: new Date().toISOString(),
      request,
    });
    state.history = state.history.slice(0, 12);
    renderHistory();
  }

  function renderHistory() {
    const list = FH.$('#historyList');
    list.textContent = '';
    if (state.history.length === 0) {
      list.append(FH.el('li', { class: 'muted', text: 'Todavía no has enviado peticiones.' }));
      return;
    }
    for (const entry of state.history) {
      list.append(
        FH.el('li', {}, [
          FH.el('div', { class: 'history-item' }, [
            FH.el('code', { text: `${entry.method} ${entry.url.replace(BASE_URL, '')}` }),
            FH.el('span', { class: `tag ${entry.status < 400 ? 'tag-own' : 'tag-external'}`, text: `${entry.status} · ${entry.ms} ms` }),
            FH.el('button', {
              class: 'btn btn-ghost btn-sm',
              type: 'button',
              text: 'Repetir',
              onclick: () => repeatRequest(entry.request),
            }),
          ]),
        ])
      );
    }
  }

  async function repeatRequest(request) {
    const spinner = FH.$('#sendSpinner');
    spinner.hidden = false;
    const startedAt = performance.now();
    try {
      const hasBody = !['GET', 'HEAD'].includes(request.method) && request.body !== null;
      const response = await fetch(request.url, {
        method: request.method,
        headers: { accept: 'application/json', ...(hasBody ? { 'content-type': 'application/json' } : {}) },
        ...(hasBody ? { body: JSON.stringify(request.body) } : {}),
      });
      const clientMs = performance.now() - startedAt;
      const text = await response.text();
      let payload = null;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        payload = null;
      }
      renderResponse({ request, response, clientMs, text, payload });
      pushHistory(request, response.status, clientMs);
      FH.$('#probador').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      FH.toast(`No se pudo repetir la petición: ${error.message}`, 'error');
    } finally {
      spinner.hidden = true;
    }
  }

  /* ------------------------------------------------------ documentación */

  function renderDocs(id) {
    const endpoint = state.endpoints.find((item) => item.id === id);
    const container = FH.$('#docsContent');
    if (!endpoint || !container) return;

    FH.$('#docsSelect').value = id;
    container.textContent = '';

    const type = FH.typeInfo(endpoint.type);
    const category = state.categories.find((item) => item.id === endpoint.category);
    // Petición de ejemplo con los valores documentados, reutilizada en varios sitios.
    const docsRequest = Examples.buildRequest(endpoint, Examples.exampleValues(endpoint), BASE_URL, endpoint.methods[0]);

    container.append(
      FH.el('div', { class: 'panel' }, [
        FH.el('div', { class: 'card-tags' }, [
          ...endpoint.methods.map((method) => FH.el('span', { class: FH.methodClass(method), text: method })),
          FH.el('span', { class: type.cls, text: type.label }),
          FH.el('span', { class: 'tag tag-category', text: category?.name || endpoint.category }),
          ...(endpoint.provider ? [FH.el('span', { class: 'tag', text: endpoint.provider })] : []),
        ]),
        FH.el('h3', { text: endpoint.name, style: 'margin-top:.6rem' }),
        FH.el('div', { class: 'card-path' }, [FH.el('span', { text: `${endpoint.methods[0]} ${endpoint.path}` }), FH.copyButton(() => `${BASE_URL}${endpoint.path}`, 'Copiar ruta')]),
        FH.el('p', { class: 'section-sub', text: endpoint.description }),
        FH.el('div', { class: 'card-actions' }, [
          FH.el('button', {
            class: 'btn btn-primary btn-sm',
            type: 'button',
            text: 'Abrir en el probador',
            onclick: () => selectEndpoint(endpoint.id, { scroll: true }),
          }),
          FH.el('a', {
            class: 'btn btn-ghost btn-sm',
            href: docsRequest.url,
            target: '_blank',
            rel: 'noopener',
            text: 'Abrir la URL de ejemplo en otra pestaña',
          }),
        ]),
      ])
    );

    // Aviso de terceros: transparencia sobre el origen y los límites.
    if (endpoint.type === 'external' && endpoint.source) {
      container.append(
        FH.el('div', { class: 'callout callout-warn' }, [
          FH.el('strong', { text: 'API externa: ' }),
          `Esta respuesta no la genera FreeAPI Hub, sino ${endpoint.source.provider} (${endpoint.source.host}). `,
          `El servidor actúa como proxy de solo lectura sin añadir claves. Límites del proveedor: ${endpoint.source.limits} `,
          FH.el('a', { href: endpoint.source.docUrl, target: '_blank', rel: 'noopener', text: 'Documentación oficial del proveedor' }),
          ' · ',
          FH.el('a', { href: `${BASE_URL}/api/status`, text: 'Ver estado actual' }),
        ])
      );
    }

    if (endpoint.type === 'demo') {
      container.append(
        FH.el('div', { class: 'callout' }, [
          FH.el('strong', { text: 'Datos en memoria: ' }),
          'este recurso de ejemplo no usa ninguna base de datos. Los cambios se pierden al reiniciar el servidor y hay un máximo de 200 tareas. Puedes restaurar el estado inicial con POST /api/demo/reset.',
        ])
      );
    }

    const docsGrid = FH.el('div', { class: 'docs-grid' });

    // Parámetros
    const paramsPanel = FH.el('div', { class: 'panel' }, [FH.el('h3', { text: 'Parámetros' })]);
    if (!endpoint.parameters || endpoint.parameters.length === 0) {
      paramsPanel.append(FH.el('p', { class: 'muted', text: 'Este endpoint no acepta parámetros: sólo hay que llamarlo.' }));
    } else {
      const table = FH.el('table', { class: 'data-table' }, [
        FH.el('thead', {}, [FH.el('tr', {}, [
          FH.el('th', { text: 'Nombre' }),
          FH.el('th', { text: 'Ubicación' }),
          FH.el('th', { text: 'Tipo' }),
          FH.el('th', { text: 'Obligatorio' }),
          FH.el('th', { text: 'Ejemplo' }),
          FH.el('th', { text: 'Descripción' }),
        ])]),
      ]);
      const body = FH.el('tbody');
      for (const param of endpoint.parameters) {
        body.append(FH.el('tr', {}, [
          FH.el('td', {}, [FH.el('code', { text: param.name })]),
          FH.el('td', { text: param.in }),
          FH.el('td', { text: param.type + (param.enum ? ` (${param.enum.join(' | ')})` : '') }),
          FH.el('td', { text: param.required ? 'Sí' : 'No' }),
          FH.el('td', {}, [FH.el('code', { text: String(param.example ?? param.default ?? '—').slice(0, 60) })]),
          FH.el('td', { text: param.description || '' }),
        ]));
      }
      table.append(body);
      paramsPanel.append(FH.el('div', { class: 'table-wrap table-scroll' }, [table]));
    }
    docsGrid.append(paramsPanel);

    // Ejemplo de respuesta + campos
    const example = endpoint.exampleResponse?.body;
    const responsePanel = FH.el('div', { class: 'panel' }, [
      FH.el('h3', { text: 'Respuesta esperada' }),
      FH.el('p', { class: 'mini-note', text: endpoint.exampleNote || `Ejemplo real de la forma de la respuesta y su código HTTP (${endpoint.exampleResponse?.status || 200}).` }),
    ]);
    if (example) {
      responsePanel.append(FH.el('div', { class: 'response-toolbar' }, [FH.copyButton(() => FH.pretty(example), 'Copiar ejemplo de respuesta')]));
      responsePanel.append(FH.el('pre', { class: 'code-block', html: FH.highlightJson(example) }));
    }
    if (endpoint.responseFields?.length) {
      const list = FH.el('ul', { class: 'mini-list' });
      for (const field of endpoint.responseFields) {
        list.append(FH.el('li', {}, [FH.el('code', { text: field.name }), ` — ${field.description}`]));
      }
      responsePanel.append(FH.el('h4', { text: 'Campos destacados' }), list);
    }
    docsGrid.append(responsePanel);
    container.append(docsGrid);

    // Errores posibles
    const errorsPanel = FH.el('div', { class: 'panel' }, [FH.el('h3', { text: 'Errores posibles' })]);
    if (!endpoint.errors || endpoint.errors.length === 0) {
      errorsPanel.append(FH.el('p', { class: 'muted', text: 'Documentado sin errores específicos. Cualquier endpoint puede devolver 429 si se superan los límites de peticiones, 404 si la ruta no existe y 500 ante un fallo interno.' }));
    } else {
      const table = FH.el('table', { class: 'data-table' }, [
        FH.el('thead', {}, [FH.el('tr', {}, [FH.el('th', { text: 'HTTP' }), FH.el('th', { text: 'Código' }), FH.el('th', { text: 'Mensaje' })])]),
      ]);
      const body = FH.el('tbody');
      for (const error of endpoint.errors) {
        body.append(FH.el('tr', {}, [
          FH.el('td', {}, [FH.el('code', { text: String(error.status) })]),
          FH.el('td', {}, [FH.el('code', { text: error.code })]),
          FH.el('td', { text: error.message }),
        ]));
      }
      table.append(body);
      errorsPanel.append(FH.el('div', { class: 'table-wrap' }, [table]));
    }
    container.append(errorsPanel);

    // Ejemplos de código con valores de ejemplo
    const request = Examples.buildRequest(endpoint, Examples.exampleValues(endpoint), BASE_URL, endpoint.methods[0]);
    const snippets = Examples.forRequest(request);
    const codePanel = FH.el('div', { class: 'panel' }, [
      FH.el('h3', { text: 'Ejemplos de uso' }),
      FH.el('p', { class: 'mini-note', text: `Petición de ejemplo con los valores de la columna «Ejemplo»: ${request.method} ${request.url}` }),
      FH.el('div', { class: 'code-tabs' }, [
        codeTabButton('javascript', 'JavaScript (fetch)'),
        codeTabButton('python', 'Python (requests)'),
        codeTabButton('curl', 'cURL'),
        codeTabButton('node', 'Node.js'),
      ]),
      FH.el('div', { class: 'response-toolbar' }, [
        FH.el('button', {
          class: 'btn btn-ghost btn-sm',
          type: 'button',
          text: 'Copiar ejemplo de cURL',
          onclick: () => FH.copy(snippets.curl, 'cURL copiado'),
        }),
        FH.el('button', {
          class: 'btn btn-ghost btn-sm',
          type: 'button',
          text: 'Copiar ejemplo de JavaScript',
          onclick: () => FH.copy(snippets.javascript, 'Ejemplo de JavaScript copiado'),
        }),
        FH.el('button', {
          class: 'btn btn-ghost btn-sm',
          type: 'button',
          text: 'Copiar ejemplo de Python',
          onclick: () => FH.copy(snippets.python, 'Ejemplo de Python copiado'),
        }),
      ]),
    ]);

    const pre = FH.el('pre', { class: 'code-block', text: snippets.javascript });
    codePanel.append(pre);
    for (const tab of FH.$$('.code-tab', codePanel)) {
      tab.addEventListener('click', () => {
        for (const other of FH.$$('.code-tab', codePanel)) other.classList.toggle('is-active', other === tab);
        pre.textContent = snippets[tab.dataset.lang];
      });
    }
    container.append(codePanel);
  }

  function codeTabButton(lang, label) {
    return FH.el('button', { class: `code-tab${lang === 'javascript' ? ' is-active' : ''}`, 'data-lang': lang, type: 'button', text: label });
  }

  /* ------------------------------------------------------------- estado */

  async function loadStatus({ refresh = false } = {}) {
    const containerSelf = FH.$('#selfTestList');
    const containerExternal = FH.$('#externalList');
    if (refresh) {
      containerSelf.textContent = '';
      containerSelf.append(FH.el('li', { class: 'muted', text: 'Ejecutando pruebas funcionales contra la API…' }));
      containerExternal.textContent = '';
      containerExternal.append(FH.el('li', { class: 'muted', text: 'Consultando proveedores externos… (puede tardar unos segundos)' }));
    }

    FH.$('#checkStatus').disabled = true;
    try {
      const { body } = await api(`/api/status${refresh ? '?refresh=true' : ''}`);
      if (!body || !body.ok) throw new Error(body?.error?.message || 'Respuesta no válida de /api/status');
      const data = body.data;
      state.statusLoaded = true;

      FH.$('#statusGenerated').textContent = `${refresh ? 'Comprobado' : 'Datos de'} ${FH.formatTime(data.generatedAt)}${data.cached ? ` (caché de ${Math.round((data.cacheAgeMs || 0) / 1000)} s)` : ''}`;

      const notice = FH.$('#statusNotice');
      if (data.networkHint) {
        notice.hidden = false;
        notice.className = 'callout callout-warn';
        notice.textContent = data.networkHint;
      } else {
        notice.hidden = true;
      }

      const summary = FH.$('#statusSummary');
      summary.textContent = '';
      const cards = [
        ['Servicios operativos', `${data.summary.operational}/${data.summary.totalServices}`],
        ['Degradados', data.summary.degraded],
        ['Caídos', data.summary.down],
        ['Pruebas propias superadas', `${data.summary.ownSelfTests.passed}/${data.summary.ownSelfTests.total}`],
        ['Duración del chequeo', FH.formatMs(data.durationMs)],
        ['Caché', `${data.cacheTtlSeconds} s`],
      ];
      for (const [label, value] of cards) {
        summary.append(FH.el('div', { class: 'summary-card' }, [FH.el('span', { text: label }), FH.el('strong', { text: String(value) })]));
      }

      FH.$('#ownStatusPill').textContent = `${data.own?.status === 'operational' ? 'operativo' : FH.statusLabel(data.own?.status)} · ${data.own?.selfTests.filter((test) => test.ok).length}/${data.own?.selfTests.length} pruebas`;

      containerSelf.textContent = '';
      for (const test of data.own?.selfTests || []) {
        containerSelf.append(
          FH.el('li', { class: `${FH.statusClass(test.ok ? 'operational' : 'down')}` }, [
            FH.el('div', { class: 'status-item-head' }, [
              FH.el('span', { class: 'status-name' }, [
                FH.el('span', { class: 'status-dot' }),
                FH.el('span', { class: `${test.ok ? 'status-ok-mark' : 'status-bad-mark'}`, text: test.ok ? '✓' : '✕' }),
                test.name,
              ]),
              FH.el('span', { class: 'status-meta', text: `${test.httpStatus || '—'} · ${FH.formatMs(test.durationMs)}` }),
            ]),
            FH.el('div', { class: 'status-msg' }, [
              `${test.endpoint} → esperado: ${test.expected} · obtenido: ${test.actual}`,
              test.ok ? '' : ` · ${test.message}`,
            ]),
          ])
        );
      }

      const external = data.external || [];
      FH.$('#externalStatusPill').textContent = external.length
        ? `${external.filter((item) => item.status === 'operational').length}/${external.length} operativos`
        : 'sin datos (usa scope=external)';

      containerExternal.textContent = '';
      for (const provider of external) {
        containerExternal.append(
          FH.el('li', { class: FH.statusClass(provider.status) }, [
            FH.el('div', { class: 'status-item-head' }, [
              FH.el('span', { class: 'status-name' }, [
                FH.el('span', { class: 'status-dot' }),
                provider.name,
                FH.el('span', { class: `status-pill`, text: FH.statusLabel(provider.status) }),
                ...(provider.cached ? [FH.el('span', { class: 'status-pill', text: 'caché' })] : []),
              ]),
              FH.el('span', { class: 'status-meta', text: `${provider.host} · ${provider.httpStatus || '—'} · ${FH.formatMs(provider.durationMs)}` }),
            ]),
            FH.el('div', { class: 'status-msg', text: provider.message }),
            FH.el('div', { class: 'status-meta', text: `${provider.exampleEndpoint} · límites: ${String(provider.limits || '').slice(0, 150)}` }),
            FH.el('div', { class: 'card-actions' }, [
              FH.el('a', { class: 'btn btn-ghost btn-sm', href: provider.docUrl, target: '_blank', rel: 'noopener', text: 'Documentación' }),
              FH.el('button', {
                class: 'btn btn-ghost btn-sm',
                type: 'button',
                text: 'Probar este proveedor',
                onclick: () => {
                  const id = state.endpoints.find((endpoint) => endpoint.type === 'external' && endpoint.provider === provider.name)?.id;
                  if (id) selectEndpoint(id, { scroll: true });
                },
              }),
            ]),
          ])
        );
      }
    } catch (error) {
      FH.toast(`Error consultando el estado: ${error.message}`, 'error');
    } finally {
      FH.$('#checkStatus').disabled = false;
    }
  }

  /* ------------------------------------------------------------ ejemplos */

  function renderExamplesSection() {
    const grid = FH.$('#examplesGrid');
    grid.textContent = '';
    const featured = [
      'health', 'info', 'random-number', 'random-uuid', 'time',
      'text-reverse', 'text-uppercase', 'json-validate', 'math-add', 'math-multiply',
    ];

    for (const id of featured) {
      const endpoint = state.endpoints.find((item) => item.id === id);
      if (!endpoint) continue;
      const request = Examples.buildRequest(endpoint, Examples.exampleValues(endpoint), BASE_URL, endpoint.methods[0]);
      const code = Examples.forRequest(request);

      grid.append(
        FH.el('article', { class: 'card example-card' }, [
          FH.el('div', { class: 'card-top' }, [
            FH.el('h3', { text: endpoint.name }),
            FH.el('div', { class: 'card-tags' }, endpoint.methods.map((method) => FH.el('span', { class: FH.methodClass(method), text: method }))),
          ]),
          FH.el('p', { text: endpoint.summary }),
          FH.el('div', { class: 'card-path' }, [FH.el('span', { text: request.url.replace(BASE_URL, '') }), FH.copyButton(() => request.url, 'Copiar URL completa')]),
          FH.el('pre', { class: 'code-block', text: code.curl, style: 'max-height:150px' }),
          FH.el('div', { class: 'card-actions' }, [
            FH.el('button', {
              class: 'btn btn-primary btn-sm',
              type: 'button',
              text: 'Ejecutar aquí',
              onclick: () => selectEndpoint(endpoint.id, { scroll: true }),
            }),
            FH.el('button', {
              class: 'btn btn-ghost btn-sm',
              type: 'button',
              text: 'Copiar cURL',
              onclick: () => FH.copy(code.curl, 'cURL copiado'),
            }),
            FH.el('button', {
              class: 'btn btn-ghost btn-sm',
              type: 'button',
              text: 'Ver documentación',
              onclick: () => {
                renderDocs(endpoint.id);
                FH.$('#documentacion').scrollIntoView({ behavior: 'smooth', block: 'start' });
              },
            }),
          ]),
        ])
      );
    }
  }

  /* --------------------------------------------------------- interacción */

  function wireEvents() {
    // Menú móvil
    const toggle = FH.$('#navToggle');
    const nav = FH.$('#mainNav');
    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    for (const link of FH.$$('#mainNav a')) {
      link.addEventListener('click', () => {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    }

    // Filtros
    FH.$('#searchInput').addEventListener('input', FH.debounce((event) => setFilter('search', event.target.value), 200));
    FH.$('#typeFilter').addEventListener('change', (event) => setFilter('type', event.target.value));
    FH.$('#methodFilter').addEventListener('change', (event) => setFilter('method', event.target.value));
    FH.$('#reloadCatalog').addEventListener('click', () => {
      loadCatalog();
      FH.toast('Catálogo recargado desde la API');
    });

    // Probador
    FH.$('#testerForm').addEventListener('submit', sendRequest);
    FH.$('#resetParams').addEventListener('click', () => {
      const endpoint = currentEndpoint();
      if (endpoint) selectEndpoint(endpoint.id, { scroll: false });
      FH.toast('Formulario restablecido con los valores de ejemplo');
    });
    FH.$('#copyUrl').addEventListener('click', () => FH.copy(FH.$('#urlPreview').textContent, 'URL copiada'));
    FH.$('#customBodyToggle').addEventListener('change', (event) => {
      state.customBody = event.target.checked;
      FH.$('#bodyField').hidden = !state.customBody;
      updateBodyPreview();
    });

    // Pestañas de la respuesta
    for (const tab of FH.$$('#responseTabs .tab')) {
      tab.addEventListener('click', () => {
        for (const other of FH.$$('#responseTabs .tab')) {
          const active = other === tab;
          other.classList.toggle('is-active', active);
          other.setAttribute('aria-selected', String(active));
        }
        for (const panel of FH.$$('.tab-panel')) panel.classList.toggle('is-active', panel.dataset.panel === tab.dataset.tab);
      });
    }

    // Pestañas de lenguaje del probador
    for (const tab of FH.$$('#codeTabs .code-tab')) {
      tab.addEventListener('click', () => renderCode(tab.dataset.lang, state.lastRequest));
    }

    // Acciones sobre la respuesta
    FH.$('#copyResponse').addEventListener('click', () => {
      if (!state.lastResponse) return FH.toast('Todavía no hay ninguna respuesta que copiar', 'error');
      FH.copy(state.lastResponse.text, 'Respuesta copiada');
    });
    FH.$('#downloadResponse').addEventListener('click', () => {
      if (!state.lastResponse) return FH.toast('Todavía no hay ninguna respuesta que descargar', 'error');
      const blob = new Blob([state.lastResponse.text], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `freeapi-hub-${state.lastResponse.status}.json`;
      link.click();
      URL.revokeObjectURL(link.href);
      FH.toast('Descarga iniciada');
    });
    FH.$('#copyHeaders').addEventListener('click', () => {
      const rows = FH.$$('#headersTable tbody tr').map((row) => Array.from(row.children).map((cell) => cell.textContent).join(': '));
      FH.copy(rows.join('\n'), 'Encabezados copiados');
    });
    FH.$('#copyCode').addEventListener('click', () => FH.copy(FH.$('#codeOutput').textContent, 'Código copiado'));
    FH.$('#clearHistory').addEventListener('click', () => {
      state.history = [];
      renderHistory();
      FH.toast('Historial vaciado');
    });

    // Estado
    FH.$('#checkStatus').addEventListener('click', () => loadStatus({ refresh: FH.$('#statusRefresh').checked }));

    // Carga perezosa del estado al llegar a la sección.
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !state.statusLoaded) {
            loadStatus({ refresh: false });
            observer.disconnect();
          }
        }
      }, { rootMargin: '200px' });
      observer.observe(FH.$('#estado'));
    }
  }

  return {
    init() {
      wireEvents();
      renderHistory();
      loadInfo();
      loadCatalog();
    },
    state,
  };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
