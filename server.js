/**
 * API CONSOLE V3 — Servidor principal.
 * Auto-descubre los endpoints de src/routes/*.js y sirve:
 *   /            → landing limpia
 *   /playground  → consola de ejecución
 *   /assets/*    → imágenes del proyecto (IQC, tarjetas, UI)
 *   /api/endpoints, /api/stats → catálogo y telemetría reales
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const registry = require('./src/registry');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '1mb' }));

// Registro automático de todos los endpoints de src/routes/*.js
registry.loadAllRoutes(app);

// Catálogo y métricas para el Playground y clientes externos
app.get('/api/endpoints', (req, res) => res.json(registry.getCatalog()));
app.get('/api/stats', (req, res) => res.json(registry.getStats()));

// Assets estáticos del proyecto (avatares IQC, fondos, patrones, UI)
app.use('/assets', express.static(path.join(__dirname, 'assets'), { maxAge: '1d' }));

// Web estática
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get(['/playground', '/playground/'], (req, res) => res.sendFile(path.join(__dirname, 'public', 'playground.html')));

// 404 JSON para rutas /api/* inexistentes
app.use('/api', (req, res) => {
  res.status(404).json({
    status: false,
    error: `El endpoint ${req.method} ${req.originalUrl} no existe.`,
    hint: 'Consulta GET /api/endpoints para ver el catálogo completo.'
  });
});

// Cualquier otra ruta vuelve a la landing
app.use((req, res) => res.redirect('/'));

if (require.main === module) {
  app.listen(PORT, HOST, () => {
    const catalog = registry.getCatalog();
    console.log(`API CONSOLE V3 en http://${HOST}:${PORT}`);
    console.log(`Categorías: ${catalog.total_categories} · Endpoints: ${catalog.total_endpoints}`);
    console.log(`Playground: http://${HOST}:${PORT}/playground`);
  });
}

module.exports = app;
