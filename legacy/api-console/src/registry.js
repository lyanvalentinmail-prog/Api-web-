/**
 * Motor de Auto-Descubrimiento y Registro de Endpoints (estilo Siputzx API Console V2)
 * Lee automáticamente todos los archivos en src/routes/*.js, los registra en Express
 * y genera el catálogo estructurado para /api/endpoints y /playground.
 */

const fs = require('fs');
const path = require('path');

class EndpointRegistry {
  constructor() {
    this.categories = new Map();
    this.endpointsByKey = new Map();
    this.stats = {
      startedAt: new Date().toISOString(),
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalLatencyMs: 0,
      recentExecutions: [],
      hitsByEndpoint: {}
    };
  }

  /**
   * Carga todos los módulos de src/routes/*.js y los registra en la instancia Express
   */
  loadAllRoutes(app, routesDir = path.join(__dirname, 'routes')) {
    const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js')).sort();

    for (const file of files) {
      const fullPath = path.join(routesDir, file);
      delete require.cache[require.resolve(fullPath)];
      const routeModule = require(fullPath);

      if (!routeModule || !routeModule.category || !Array.isArray(routeModule.endpoints)) {
        continue;
      }

      const categoryName = routeModule.category.toUpperCase();
      if (!this.categories.has(categoryName)) {
        this.categories.set(categoryName, {
          name: categoryName,
          description: routeModule.description || '',
          file,
          endpoints: []
        });
      }

      for (const ep of routeModule.endpoints) {
        this.registerEndpoint(app, categoryName, ep);
      }
    }
  }

  /**
   * Registra un endpoint individual en Express y en el catálogo del Playground
   */
  registerEndpoint(app, categoryName, ep) {
    const method = (ep.method || 'GET').toUpperCase();
    const expressMethod = method.toLowerCase();
    const routePath = ep.path.startsWith('/') ? ep.path : `/${ep.path}`;
    const key = `${method}:${routePath}`;

    const metadata = {
      id: key,
      name: ep.name || routePath,
      path: routePath,
      method,
      category: categoryName,
      description: ep.description || '',
      responseType: ep.responseType || 'json',
      params: Array.isArray(ep.params) ? ep.params : [],
      status: ep.status || 'active'
    };

    if (!this.categories.has(categoryName)) {
      this.categories.set(categoryName, {
        name: categoryName,
        description: 'Categoría personalizada',
        file: 'custom.js',
        endpoints: []
      });
    }

    const catObj = this.categories.get(categoryName);
    const existingIdx = catObj.endpoints.findIndex(item => item.id === key);
    if (existingIdx >= 0) {
      catObj.endpoints[existingIdx] = metadata;
    } else {
      catObj.endpoints.push(metadata);
    }

    this.endpointsByKey.set(key, { ...metadata, handler: ep.handler });

    // Registrar ruta en Express con middleware de telemetría
    if (typeof app[expressMethod] === 'function') {
      app[expressMethod](routePath, async (req, res) => {
        const start = performance.now();
        this.stats.totalRequests += 1;
        this.stats.hitsByEndpoint[routePath] = (this.stats.hitsByEndpoint[routePath] || 0) + 1;

        // Interceptar res.json para añadir metadatos estándar estilo Siputzx
        const originalJson = res.json.bind(res);
        res.json = (body) => {
          const elapsed = Math.max(1, Math.round(performance.now() - start));
          res.setHeader('X-Response-Time', `${elapsed}ms`);

          if (body && typeof body === 'object' && !Array.isArray(body)) {
            const enriched = {
              status: body.status !== undefined ? body.status : true,
              creator: 'API CONSOLE V2',
              response_time: `${elapsed}ms`,
              timestamp: new Date().toISOString(),
              ...body
            };
            return originalJson(enriched);
          }
          return originalJson(body);
        };

        res.on('finish', () => {
          const elapsed = Math.max(1, Math.round(performance.now() - start));
          this.stats.totalLatencyMs += elapsed;
          if (res.statusCode >= 200 && res.statusCode < 400) {
            this.stats.successfulRequests += 1;
          } else {
            this.stats.failedRequests += 1;
          }
          this.stats.recentExecutions.unshift({
            method,
            path: routePath,
            status: res.statusCode,
            latencyMs: elapsed,
            time: new Date().toISOString()
          });
          if (this.stats.recentExecutions.length > 25) {
            this.stats.recentExecutions.pop();
          }
        });

        try {
          const current = this.endpointsByKey.get(key);
          await current.handler(req, res);
        } catch (err) {
          console.error(`Error en endpoint ${key}:`, err);
          if (!res.headersSent) {
            res.status(500).json({
              status: false,
              error: err.message || 'Internal Server Error'
            });
          }
        }
      });
    }

    return metadata;
  }

  /**
   * Devuelve el catálogo completo para /api/endpoints
   */
  getCatalog() {
    const categoriesArray = Array.from(this.categories.values()).map(cat => ({
      name: cat.name,
      description: cat.description,
      count: cat.endpoints.length,
      endpoints: cat.endpoints.map(ep => ({
        ...ep,
        hits: this.stats.hitsByEndpoint[ep.path] || 0
      }))
    }));

    const totalEndpoints = categoriesArray.reduce((sum, c) => sum + c.count, 0);

    return {
      status: true,
      creator: 'API CONSOLE V2',
      version: '2.0.0',
      total_categories: categoriesArray.length,
      total_endpoints: totalEndpoints,
      categories: categoriesArray
    };
  }

  /**
   * Devuelve las métricas del servidor en tiempo real para /api/stats
   */
  getStats() {
    const catalog = this.getCatalog();
    const avgLatency = this.stats.totalRequests > 0
      ? Math.round(this.stats.totalLatencyMs / this.stats.totalRequests)
      : 4;

    return {
      status: true,
      uptime_seconds: Math.floor(process.uptime()),
      started_at: this.stats.startedAt,
      total_categories: catalog.total_categories,
      total_endpoints: catalog.total_endpoints,
      total_requests: this.stats.totalRequests,
      successful_requests: this.stats.successfulRequests,
      failed_requests: this.stats.failedRequests,
      average_latency_ms: avgLatency,
      memory_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      recent_executions: this.stats.recentExecutions,
      hits_by_endpoint: this.stats.hitsByEndpoint
    };
  }
}

module.exports = new EndpointRegistry();
