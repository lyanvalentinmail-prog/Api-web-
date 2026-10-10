'use strict';

const express = require('express');
const { sendSuccess } = require('../lib/respond');
const { collectParams, asInteger, asEnum, asPattern } = require('../lib/validate');
const { errors, ApiError } = require('../lib/errors');

const router = express.Router();

/**
 * Recurso de ejemplo en memoria.
 *
 * Aviso importante y documentado en la interfaz: estos datos NO se guardan en
 * ninguna base de datos. Viven en el proceso y se reinician al reiniciar el
 * servidor. Sirve para practicar un CRUD REST completo sin montar nada más.
 */
const MAX_ITEMS = 200;
const PRIORITIES = ['baja', 'media', 'alta'];
const UPDATABLE_FIELDS = ['title', 'description', 'completed', 'priority', 'tags'];

const SEED = [
  {
    title: 'Probar el endpoint /api/health',
    description: 'Verifica que el servidor responde antes de nada.',
    completed: true,
    priority: 'alta',
    tags: ['pruebas'],
  },
  {
    title: 'Explorar el catálogo de APIs',
    description: 'Filtra por categoría y método desde la interfaz web.',
    completed: false,
    priority: 'media',
    tags: ['catálogo'],
  },
  {
    title: 'Documentar los endpoints',
    description: 'Cada endpoint incluye parámetros, ejemplos y errores posibles.',
    completed: false,
    priority: 'media',
    tags: ['docs'],
  },
  {
    title: 'Publicar el proyecto',
    description: 'README, instrucciones de despliegue y comprobación de estado.',
    completed: false,
    priority: 'baja',
    tags: ['release'],
  },
];

let items = [];
let nextId = 1;

/** Crea el estado inicial del recurso de ejemplo. */
function resetStore() {
  const now = new Date().toISOString();
  items = SEED.map((item, index) => ({
    id: index + 1,
    title: item.title,
    description: item.description,
    completed: item.completed,
    priority: item.priority,
    tags: item.tags,
    createdAt: now,
    updatedAt: now,
  }));
  nextId = items.length + 1;
  return items.length;
}

resetStore();

/** Lee un booleano "blando" (admite true/false, 1/0, "true"/"false"). */
function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === 0) return Boolean(value);
  const text = String(value).trim().toLowerCase();
  if (['true', '1', 'si', 'sí', 'yes'].includes(text)) return true;
  if (['false', '0', 'no'].includes(text)) return false;
  return null;
}

/**
 * Devuelve el cuerpo de la petición como objeto, admitiendo JSON, texto con
 * JSON y formularios urlencoded.
 * @param {import('express').Request} req
 */
function readObjectBody(req) {
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) return req.body;
  if (typeof req.body === 'string' && req.body.trim() !== '') {
    const contentType = String(req.headers['content-type'] || '');
    if (contentType.includes('application/x-www-form-urlencoded')) {
      return Object.fromEntries(new URLSearchParams(req.body));
    }
    try {
      const parsed = JSON.parse(req.body);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
      throw new Error('no es un objeto');
    } catch {
      throw errors.badRequest(
        'INVALID_JSON_BODY',
        'El cuerpo no es un objeto JSON válido. Ejemplo: {"title":"Mi tarea","priority":"alta"}'
      );
    }
  }
  return {};
}

/**
 * Valida los campos de una tarea.
 * @param {Record<string, unknown>} body
 * @param {{partial: boolean}} options
 */
function validateTask(body, { partial }) {
  const details = [];
  const result = {};

  if (!partial || body.title !== undefined) {
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (title.length === 0) {
      details.push({ name: 'title', value: body.title ?? null, description: 'Es obligatorio (2 a 200 caracteres).' });
    } else if (title.length < 2 || title.length > 200) {
      details.push({ name: 'title', value: title.length, description: 'Debe tener entre 2 y 200 caracteres.' });
    } else {
      result.title = title;
    }
  }

  if (body.description !== undefined) {
    if (typeof body.description !== 'string' || body.description.length > 1000) {
      details.push({ name: 'description', value: null, description: 'Debe ser texto de hasta 1000 caracteres.' });
    } else {
      result.description = body.description.trim();
    }
  }

  if (body.completed !== undefined) {
    const completed = parseBoolean(body.completed);
    if (completed === null) {
      details.push({ name: 'completed', value: body.completed, description: 'Debe ser true o false.' });
    } else {
      result.completed = completed;
    }
  }

  if (body.priority !== undefined) {
    const priority = String(body.priority).toLowerCase();
    if (!PRIORITIES.includes(priority)) {
      details.push({ name: 'priority', value: body.priority, description: `Debe ser uno de: ${PRIORITIES.join(', ')}.` });
    } else {
      result.priority = priority;
    }
  }

  if (body.tags !== undefined) {
    const tags = Array.isArray(body.tags)
      ? body.tags.map((tag) => String(tag).trim()).filter(Boolean)
      : String(body.tags).split(',').map((tag) => tag.trim()).filter(Boolean);
    if (tags.length > 10 || tags.some((tag) => tag.length > 40)) {
      details.push({ name: 'tags', value: tags.length, description: 'Máximo 10 etiquetas de hasta 40 caracteres.' });
    } else {
      result.tags = tags;
    }
  }

  if (!partial && result.completed === undefined) result.completed = false;
  if (!partial && result.priority === undefined) result.priority = 'media';

  if (details.length > 0) {
    throw errors.unprocessable('VALIDATION_ERROR', 'Algunos campos no son válidos. Revisa "error.details".', details);
  }

  return result;
}

/** Busca una tarea por id o lanza 404. */
function findItem(id) {
  const item = items.find((entry) => entry.id === id);
  if (!item) {
    throw errors.notFound(`No existe ninguna tarea con id ${id}. Consulta la lista completa en GET /api/demo/tasks.`, 'ITEM_NOT_FOUND');
  }
  return item;
}

/** GET /api/demo/tasks — lista con búsqueda, filtros, orden y paginación. */
router.get('/tasks', (req, res, next) => {
  try {
    const search = req.query.search ? String(req.query.search).slice(0, 100).toLowerCase() : null;
    let completedFilter = null;
    if (req.query.completed !== undefined && req.query.completed !== '') {
      completedFilter = parseBoolean(req.query.completed);
      if (completedFilter === null) {
        throw errors.badRequest('INVALID_BOOLEAN', 'El parámetro completed debe ser true o false.');
      }
    }
    const sort = asEnum(req.query.sort, 'sort', ['id', 'title', 'completed', 'createdAt'], 'id');
    const order = asEnum(req.query.order, 'order', ['asc', 'desc'], 'asc');
    const page = asInteger(req.query.page, 'page', 1);
    const limit = asInteger(req.query.limit, 'limit', 10);

    if (page < 1) throw errors.badRequest('INVALID_INTEGER', 'page debe ser mayor o igual que 1.');
    if (limit < 1 || limit > 50) throw errors.badRequest('INVALID_INTEGER', 'limit debe estar entre 1 y 50.');

    let filtered = items.filter((item) => {
      if (completedFilter !== null && item.completed !== completedFilter) return false;
      if (search) {
        const haystack = `${item.title} ${item.description} ${item.tags.join(' ')}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });

    filtered = filtered.sort((a, b) => {
      const factor = order === 'asc' ? 1 : -1;
      if (sort === 'id') return (a.id - b.id) * factor;
      if (sort === 'completed') return (Number(a.completed) - Number(b.completed)) * factor || a.id - b.id;
      if (sort === 'title') return a.title.localeCompare(b.title, 'es') * factor;
      return (new Date(a.createdAt) - new Date(b.createdAt)) * factor;
    });

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;
    const pageItems = filtered.slice(start, start + limit);

    sendSuccess(
      res,
      {
        items: pageItems,
        pagination: {
          total,
          page,
          limit,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
        filters: { search: req.query.search || null, completed: completedFilter },
        sorting: { sort, order },
        storage: 'memoria del proceso (sin base de datos): los datos se reinician al reiniciar el servidor',
      },
      { self: false }
    );
  } catch (error) {
    next(error);
  }
});

/** POST /api/demo/tasks — crea una tarea. */
router.post('/tasks', (req, res, next) => {
  try {
    const body = readObjectBody(req);
    const fields = validateTask(body, { partial: false });

    if (items.length >= MAX_ITEMS) {
      throw new ApiError(
        409,
        'LIMIT_REACHED',
        `El recurso de ejemplo admite un máximo de ${MAX_ITEMS} tareas. Elimina alguna o llama a POST /api/demo/reset.`
      );
    }

    const now = new Date().toISOString();
    const item = {
      id: nextId,
      title: fields.title,
      description: fields.description || '',
      completed: fields.completed,
      priority: fields.priority,
      tags: fields.tags || [],
      createdAt: now,
      updatedAt: now,
    };

    items.push(item);
    nextId += 1;

    sendSuccess(
      res,
      { item, location: `/api/demo/tasks/${item.id}`, totalItems: items.length },
      { status: 201, self: false, headers: { Location: `/api/demo/tasks/${item.id}` } }
    );
  } catch (error) {
    next(error);
  }
});

/** GET /api/demo/tasks/:id — obtiene una tarea. */
router.get('/tasks/:id', (req, res, next) => {
  try {
    const id = asPattern(req.params.id, 'id', /^\d{1,9}$/, { hint: 'El id debe ser un número entero positivo.' });
    const item = findItem(Number(id));
    sendSuccess(res, { item }, { self: false });
  } catch (error) {
    next(error);
  }
});

/** PUT /api/demo/tasks/:id — reemplaza una tarea completa. */
router.put('/tasks/:id', (req, res, next) => {
  try {
    const id = asPattern(req.params.id, 'id', /^\d{1,9}$/, { hint: 'El id debe ser un número entero positivo.' });
    const item = findItem(Number(id));
    const body = readObjectBody(req);
    const fields = validateTask(body, { partial: false });

    const now = new Date().toISOString();
    Object.assign(item, {
      title: fields.title,
      description: fields.description || '',
      completed: fields.completed,
      priority: fields.priority,
      tags: fields.tags || [],
      updatedAt: now,
    });

    sendSuccess(res, { item, replaced: true }, { self: false });
  } catch (error) {
    next(error);
  }
});

/** PATCH /api/demo/tasks/:id — modifica sólo los campos enviados. */
router.patch('/tasks/:id', (req, res, next) => {
  try {
    const id = asPattern(req.params.id, 'id', /^\d{1,9}$/, { hint: 'El id debe ser un número entero positivo.' });
    const item = findItem(Number(id));
    const body = readObjectBody(req);

    const unknownFields = Object.keys(body).filter((field) => !UPDATABLE_FIELDS.includes(field));
    const providedFields = Object.keys(body).filter((field) => UPDATABLE_FIELDS.includes(field));

    if (providedFields.length === 0) {
      throw errors.unprocessable(
        'NO_FIELDS',
        `No se envió ningún campo actualizable. Campos admitidos: ${UPDATABLE_FIELDS.join(', ')}.`,
        unknownFields.map((field) => ({ name: field, value: body[field], description: 'Campo no reconocido; se ignora.' }))
      );
    }

    const fields = validateTask(body, { partial: true });
    Object.assign(item, fields, { updatedAt: new Date().toISOString() });

    sendSuccess(
      res,
      {
        item,
        updatedFields: providedFields,
        ...(unknownFields.length ? { ignoredFields: unknownFields } : {}),
      },
      { self: false }
    );
  } catch (error) {
    next(error);
  }
});

/** DELETE /api/demo/tasks/:id — elimina una tarea. */
router.delete('/tasks/:id', (req, res, next) => {
  try {
    const id = asPattern(req.params.id, 'id', /^\d{1,9}$/, { hint: 'El id debe ser un número entero positivo.' });
    const item = findItem(Number(id));
    items = items.filter((entry) => entry.id !== item.id);
    sendSuccess(res, { deleted: true, item, totalItems: items.length }, { self: false });
  } catch (error) {
    next(error);
  }
});

/** POST /api/demo/reset — restaura las tareas de ejemplo. */
router.post('/reset', (req, res, next) => {
  try {
    const count = resetStore();
    sendSuccess(
      res,
      { reset: true, items: count, message: 'Recurso de ejemplo restaurado a su estado inicial.' },
      { self: false }
    );
  } catch (error) {
    next(error);
  }
});

module.exports = router;
