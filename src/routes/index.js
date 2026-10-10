'use strict';

const express = require('express');

/**
 * Router principal de la API (/api).
 * Cada módulo agrupa una categoría del catálogo y mantiene el mismo estilo:
 * validar parámetros → calcular → responder con sendSuccess.
 */
const router = express.Router();

router.use('/', require('./docs'));        // /api, /api/health, /api/info, /api/catalog, /api/openapi.json, /api/routes
router.use('/', require('./status'));      // /api/status
router.use('/random', require('./random'));
router.use('/time', require('./time'));
router.use('/text', require('./text'));
router.use('/json', require('./json'));
router.use('/math', require('./math'));
router.use('/util', require('./utils'));
router.use('/demo', require('./demo'));
router.use('/external', require('./external'));

module.exports = router;
