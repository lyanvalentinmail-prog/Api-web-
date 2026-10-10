/* FreeAPI Hub — construcción de peticiones y generación de ejemplos de código */
'use strict';

const Examples = {
  /**
   * Convierte una definición del catálogo + los valores del formulario en una
   * petición HTTP real (método, URL y cuerpo).
   * @param {object} endpoint definición del catálogo
   * @param {Record<string,string>} values valores introducidos por la persona usuaria
   * @param {string} baseUrl origen del servidor (window.location.origin)
   * @param {string} [method] método elegido; por defecto el primero admitido
   */
  buildRequest(endpoint, values = {}, baseUrl = '', method) {
    const httpMethod = method || endpoint.methods[0];
    const params = endpoint.parameters || [];
    let path = endpoint.path;

    // 1. Parámetros de ruta (:id, :breed…). Si están vacíos se usa el ejemplo.
    for (const param of params.filter((item) => item.in === 'path')) {
      const value = values[param.name] !== undefined && values[param.name] !== '' ? values[param.name] : param.example;
      path = path.replace(`:${param.name}`, encodeURIComponent(value ?? `{${param.name}}`));
    }

    // 2. Parámetros de consulta.
    const query = {};
    for (const param of params.filter((item) => item.in === 'query')) {
      if (param.name === 'cualquiera') continue; // campo libre del endpoint de eco
      const value = values[param.name];
      if (value !== undefined && value !== '') query[param.name] = value;
    }
    if (params.some((param) => param.name === 'cualquiera') && values.__free) {
      for (const pair of String(values.__free).split('&')) {
        const [key, value] = pair.split('=');
        if (key && key.trim()) query[key.trim()] = value ?? '';
      }
    }

    // 3. Cuerpo: sólo tiene sentido en métodos que envían datos.
    const bodyParams = params.filter((item) => item.in === 'body');
    let body = null;
    if (bodyParams.length > 0 && !['GET', 'HEAD', 'DELETE'].includes(httpMethod)) {
      const payload = {};
      for (const param of bodyParams) {
        const raw = values[param.name];
        if (raw === undefined || raw === '') continue;
        if (param.type === 'array<string>' || param.type === 'array') {
          try {
            payload[param.name] = JSON.parse(raw);
          } catch {
            payload[param.name] = String(raw).split(',').map((item) => item.trim()).filter(Boolean);
          }
        } else if (param.type === 'boolean') {
          payload[param.name] = ['true', '1', 'si', 'sí'].includes(String(raw).toLowerCase());
        } else if (param.type === 'integer' || param.type === 'number') {
          const numeric = Number(raw);
          payload[param.name] = Number.isFinite(numeric) ? numeric : raw;
        } else {
          payload[param.name] = String(raw);
        }
      }
      if (Object.keys(payload).length > 0) body = payload;
    }

    const url = `${baseUrl}${path}${FH.buildQuery(query)}`;
    return { method: httpMethod, url, body, endpoint };
  },

  /** Ejemplo de cuerpo JSON listo para mostrar en los fragmentos de código. */
  bodyText(body) {
    if (body === null || body === undefined) return null;
    return JSON.stringify(body, null, 2);
  },

  /**
   * Rellena los valores de ejemplo de un endpoint (para la documentación).
   * Usa los valores obligatorios y, si un parámetro trae ejemplo, también lo incluye.
   */
  exampleValues(endpoint) {
    const values = {};
    for (const param of endpoint.parameters || []) {
      if (param.name === 'cualquiera') continue;
      if (param.example !== undefined && (param.required || param.in === 'path')) {
        values[param.name] = String(param.example);
      }
    }
    return values;
  },

  /** Genera los cuatro fragmentos de código para una petición concreta. */
  forRequest(request) {
    const { method, url, body } = request;
    const prettyBody = Examples.bodyText(body);
    const safeUrl = url || 'http://localhost:3000/api/health';

    const curlLines = [`curl -X ${method} "${safeUrl}"`];
    if (prettyBody) curlLines.push(`  -H "Content-Type: application/json"`, `  -d '${prettyBody.replace(/\n\s*/g, ' ')}'`);

    const fetchCode = [
      `const url = ${JSON.stringify(safeUrl)};`,
      '',
      'const response = await fetch(url, {',
      `  method: '${method}',`,
      ...(prettyBody ? ["  headers: { 'Content-Type': 'application/json' },", `  body: JSON.stringify(${prettyBody})`] : []),
      '});',
      '',
      '// Código HTTP y respuesta real del servidor',
      'console.log(response.status);',
      'const data = await response.json();',
      'console.log(data);',
    ].join('\n');

    const pythonCode = [
      'import json',
      'import requests',
      '',
      `url = ${JSON.stringify(safeUrl)}`,
      ...(prettyBody ? [`payload = json.loads(r'''${prettyBody}''')`] : []),
      '',
      `response = requests.${method.toLowerCase()}(url${prettyBody ? ', json=payload' : ''}, timeout=10)`,
      'print(response.status_code)',
      'print(response.json())',
    ].join('\n');

    const nodeCode = [
      `// Node.js 18 o superior (fetch incluido)`,
      '(async () => {',
      `  const response = await fetch(${JSON.stringify(safeUrl)}, {`,
      `    method: '${method}',`,
      ...(prettyBody ? ["    headers: { 'Content-Type': 'application/json' },", `    body: JSON.stringify(${prettyBody})`] : []),
      '  });',
      '  console.log(response.status, await response.json());',
      '})();',
    ].join('\n');

    return {
      javascript: fetchCode,
      python: pythonCode,
      curl: curlLines.join(' \\\n'),
      node: nodeCode,
    };
  },

  /** Fragmento corto de una línea (por ejemplo para tarjetas de ejemplo). */
  forEndpoint(endpoint, baseUrl) {
    const request = Examples.buildRequest(endpoint, Examples.exampleValues(endpoint), baseUrl);
    return { request, code: Examples.forRequest(request) };
  },
};

window.Examples = Examples;
