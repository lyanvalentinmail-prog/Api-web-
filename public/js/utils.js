/* FreeAPI Hub — utilidades del navegador (sin dependencias externas) */
'use strict';

const FH = {
  /** Atajo para querySelector. */
  $(selector, scope = document) {
    return scope.querySelector(selector);
  },

  /** Atajo para querySelectorAll, devuelto como array. */
  $$(selector, scope = document) {
    return Array.from(scope.querySelectorAll(selector));
  },

  /** Crea un elemento con atributos y contenido seguro. */
  el(tag, attributes = {}, children = []) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attributes)) {
      if (value === undefined || value === null || value === false) continue;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key === 'html') node.innerHTML = value;
      else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
      else if (value === true) node.setAttribute(key, '');
      else node.setAttribute(key, String(value));
    }
    for (const child of [].concat(children)) {
      if (child === null || child === undefined) continue;
      node.append(child.nodeType ? child : document.createTextNode(String(child)));
    }
    return node;
  },

  /** Escapa texto para insertarlo en HTML de forma segura. */
  escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  /** Formatea bytes en una unidad legible. */
  formatBytes(bytes) {
    if (!Number.isFinite(bytes)) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  },

  /** Formatea milisegundos. */
  formatMs(ms) {
    if (!Number.isFinite(ms)) return '—';
    if (ms < 1000) return `${Math.round(ms)} ms`;
    return `${(ms / 1000).toFixed(2)} s`;
  },

  /** Formatea una fecha ISO en hora local legible. */
  formatTime(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return String(iso);
    }
  },

  /** Retrasa la ejecución hasta que el usuario deja de escribir. */
  debounce(fn, wait = 220) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  },

  /**
   * Resalta JSON para mostrarlo en un <pre>. Devuelve HTML ya escapado, así que
   * es seguro insertarlo con innerHTML (los datos pasan por escapeHtml).
   */
  highlightJson(value) {
    const json = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    const escaped = FH.escapeHtml(json);
    return escaped.replace(
      /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false)\b|\bnull\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
      (match, str, colon, bool, num) => {
        if (str !== undefined) {
          const cls = colon ? 'tok-key' : 'tok-string';
          return `<span class="${cls}">${str}</span>${colon || ''}`;
        }
        if (bool !== undefined) return `<span class="tok-bool">${bool}</span>`;
        if (num !== undefined) return `<span class="tok-number">${num}</span>`;
        return '<span class="tok-null">null</span>';
      }
    );
  },

  /**
   * Copia texto al portapapeles. Usa la API moderna y recurre a un textarea
   * temporal cuando no está disponible (contextos sin permiso).
   */
  async copy(text, message = 'Copiado al portapapeles') {
    const value = String(text ?? '');
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
      } else {
        const area = document.createElement('textarea');
        area.value = value;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.top = '-1000px';
        document.body.append(area);
        area.select();
        document.execCommand('copy');
        area.remove();
      }
      FH.toast(message, 'ok');
      return true;
    } catch (error) {
      FH.toast(`No se pudo copiar: ${error.message}`, 'error');
      return false;
    }
  },

  /** Muestra un aviso temporal en la zona de toasts. */
  toast(message, kind = '') {
    const zone = FH.$('#toastZone');
    if (!zone) return;
    const node = FH.el('div', { class: `toast ${kind === 'error' ? 'is-error' : kind === 'ok' ? 'is-ok' : ''}`, text: message });
    zone.append(node);
    setTimeout(() => {
      node.style.transition = 'opacity .3s ease';
      node.style.opacity = '0';
      setTimeout(() => node.remove(), 320);
    }, 2600);
  },

  /** Clase CSS del método HTTP. */
  methodClass(method) {
    return `method method-${String(method).toLowerCase()}`;
  },

  /** Clase CSS según el estado de un servicio. */
  statusClass(status) {
    return `status-item status-${status || 'down'}`;
  },

  /** Etiqueta legible del estado. */
  statusLabel(status) {
    return { operational: 'operativo', degraded: 'degradado', down: 'caído' }[status] || status || 'desconocido';
  },

  /** Etiqueta del tipo de endpoint. */
  typeInfo(type) {
    return {
      own: { label: 'Propia', cls: 'tag tag-own', help: 'Se ejecuta en este servidor, sin dependencias externas.' },
      demo: { label: 'Demo CRUD', cls: 'tag tag-demo', help: 'Recurso de ejemplo en memoria: se reinicia al reiniciar el servidor.' },
      external: { label: 'Externa', cls: 'tag tag-external', help: 'Proxy hacia una API pública de terceros; su disponibilidad depende del proveedor.' },
    }[type] || { label: type || '—', cls: 'tag', help: '' };
  },

  /** Botón de copiar reutilizable (iconos SVG en línea, sin dependencias). */
  copyButton(getValue, label = 'Copiar') {
    const svg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>`;
    const button = FH.el('button', {
      class: 'copy-btn',
      type: 'button',
      title: label,
      'aria-label': label,
      html: svg,
      onclick: (event) => {
        event.stopPropagation();
        FH.copy(typeof getValue === 'function' ? getValue() : getValue, '¡Copiado!');
      },
    });
    return button;
  },

  /** Construye una query string omitiendo valores vacíos. */
  buildQuery(params) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params || {})) {
      if (value === undefined || value === null || value === '') continue;
      search.append(key, value);
    }
    const text = search.toString();
    return text ? `?${text}` : '';
  },

  /** Convierte un objeto en texto JSON con indentación de 2 espacios. */
  pretty(value) {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  },
};

window.FH = FH;
