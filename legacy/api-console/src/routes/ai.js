/**
 * Categoría: IA — Endpoints de inteligencia artificial.
 * Estas respuestas son generadas de forma determinista en el servidor
 * (sin clave de API) para que el playground siempre funcione.
 */

const { seedFrom } = require('../lib/util');

const IA_PERSONAS = {
  asistente: {
    name: 'Asistente IA',
    respuestas: [
      'Claro, puedo ayudarte con eso. ¿Quieres que lo desglose paso a paso?',
      'Entiendo tu pregunta. Aquí tienes una explicación clara en español.',
      'Buena pregunta. La idea clave es que los endpoints devuelven JSON válido y tiempos de respuesta bajos.',
      'Puedes usar este endpoint directamente desde fetch, curl o cualquier cliente HTTP. Recuerda codificar los parámetros.',
      'Recuerda siempre revisar el campo "status" del JSON antes de usar "data".'
    ]
  },
  gpt: {
    name: 'GPT OSS 120B (modo demo)',
    respuestas: [
      'Soy una demostración local del estilo GPT en español. Respuesta generada sin servicios externos.',
      'Esta es una respuesta simulada con el tono de un modelo grande, pero ejecutada 100% en tu servidor.',
      'Aquí tienes una respuesta concisa: la programación es el arte de decirle a la computadora qué hacer, con toda la paciencia del mundo.'
    ]
  },
  duckai: {
    name: 'DuckAI Chat',
    respuestas: [
      '¡Cuac! Busquemos juntos la respuesta. ¿Quieres que enfoque el tema desde ejemplos prácticos?',
      'La respuesta corta es sí. La respuesta larga requiere tres párrafos, código y un café.',
      'DuckAI dice: la mejor forma de aprender es construyendo algo que te divierta.'
    ]
  },
  bible: {
    name: 'Biblia IA',
    respuestas: [
      '«El principio de la sabiduría es el temor de Jehová.» — Proverbios 9:10.',
      '«Todo tiene su tiempo, y todo lo que se quiere debajo del cielo tiene su hora.» — Eclesiastés 3:1.',
      '«Jehová es mi pastor; nada me faltará.» — Salmo 23:1.'
    ]
  },
  deepseek: {
    name: 'DeepSeek R1 (demo)',
    respuestas: [
      '<think>Necesito razonar sobre la pregunta antes de responder.</think> La conclusión es que la respuesta correcta combina lógica y claridad.',
      '<think>Vamos a descomponer el problema.</think> Analizando cada componente, la solución óptima es la más simple.',
      '<think>Piensa en el usuario final.</think> Responde siempre pensando en quien va a leer esto: claridad ante todo.'
    ]
  },
  gemini: {
    name: 'Gemini [BETA]',
    respuestas: [
      'Desde una perspectiva multimodal, la respuesta integra texto y contexto visual.',
      'Aquí tienes una respuesta balanceada con pros y contras en español neutro.',
      'La respuesta corta: funciona. La respuesta larga: depende del caso de uso.'
    ]
  },
  meta: {
    name: 'Meta AI',
    respuestas: [
      'Meta al habla. ¿En qué puedo ayudarte hoy?',
      'Vamos a resolver esto de forma colaborativa. Dame un segundo para estructurar la respuesta.',
      'La IA funciona mejor cuando la pregunta es clara. Prueba a ser más específico.'
    ]
  },
  phi: {
    name: 'Phi-2 (demo)',
    respuestas: [
      'Phi-2 es pequeño pero ingenioso. Aquí va una respuesta compacta y útil.',
      'Menos parámetros, más enfoque. Esa es la filosofía de los modelos pequeños.',
      'Respuesta corta: sí. Respuesta larga: también sí, pero con matices.'
    ]
  },
  qwq: {
    name: 'QwQ 32B (demo)',
    respuestas: [
      '¿Qué tal si pensamos juntos? La respuesta se construye paso a paso.',
      'QwQ se hace preguntas antes de contestar: ¿qué quieres realmente conseguir?',
      'Antes de responder: ¿tienes claro el objetivo? Si es así, vamos allá.'
    ]
  },
  glm: {
    name: 'GLM 4.7 Flash',
    respuestas: [
      'GLM Flash contesta rápido: la clave de una API pública buena es la documentación.',
      'Respuesta en una línea: usa siempre CORS abierto y respuestas JSON consistentes.',
      'Flash: prioriza velocidad y claridad por encima de todo.'
    ]
  },
  gita: {
    name: 'Gita IA',
    respuestas: [
      '«Cumple tu deber sin apego a los frutos.» — Bhagavad Gita 2:47.',
      '«El yogi que está contento en el sí mismo es establecido en el Ser.»',
      '«En la meditación encuentra la paz; en la acción, el propósito.»'
    ]
  }
};

function responder(persona, query, seed) {
  const lista = persona.respuestas;
  const pick = lista[seed % lista.length];
  return {
    modelo: persona.name,
    consulta: query,
    respuesta: `${pick}${query ? `\n\n(Por tu pregunta: "${query.slice(0, 120)}")` : ''}`,
    disclaimer: 'Esta es una demostración local en español; no realiza llamadas a modelos externos.'
  };
}

const AI_ENDPOINTS = [
  ['duckai', 'duckai', 'Chat con DuckAI (demo en español)'],
  ['bibleai', 'bible', 'Citas y reflexiones de la Biblia (demo)'],
  ['gptoss120b', 'gpt', 'GPT OSS 120B (demo)'],
  ['glm47flash', 'glm', 'GLM 4.7 Flash (demo)'],
  ['phi2', 'phi', 'Phi-2 (demo)'],
  ['qwq32b', 'qwq', 'QwQ 32B (demo)'],
  ['deepseekr1', 'deepseek', 'DeepSeek R1 con cadena de razonamiento (demo)'],
  ['metaai', 'meta', 'Meta AI (demo)'],
  ['gemini', 'gemini', 'Gemini [BETA] (demo)'],
  ['gitagita', 'gita', 'Reflexiones de la Bhagavad Gita (demo)'],
  ['asistente', 'asistente', 'Asistente genérico en español (demo)']
];

const endpoints = AI_ENDPOINTS.map(([slug, key, desc]) => ({
  name: IA_PERSONAS[key].name,
  path: `/api/ai/${slug}`,
  method: 'GET',
  description: desc + '. Parámetro "query" con tu pregunta.',
  responseType: 'json',
  params: [
    { name: 'query', type: 'string', required: true, example: '¿Cómo funciona una API REST?', description: 'Tu pregunta' }
  ],
  handler: async (req, res) => {
    const query = String(req.query.query || '').trim();
    if (!query) return res.status(400).json({ status: false, error: 'El parámetro "query" es obligatorio.' });
    const seed = seedFrom(key + query.toLowerCase());
    res.json({ status: true, data: responder(IA_PERSONAS[key], query, seed) });
  }
}));

// Generador de imágenes IA (demo SVG)
endpoints.push({
  name: 'DuckAI Image Generator (demo)',
  path: '/api/ai/duckaiimage',
  method: 'GET',
  description: 'Genera una imagen de demostración abstracta en SVG basada en tu prompt.',
  responseType: 'image',
  params: [
    { name: 'prompt', type: 'string', required: true, example: 'un paisaje futurista al atardecer', description: 'Descripción de la imagen' }
  ],
  handler: async (req, res) => {
    const prompt = String(req.query.prompt || 'paisaje').trim();
    const seed = seedFrom(prompt);
    const r1 = (seed * 97) % 256, g1 = (seed * 53) % 256, b1 = (seed * 31) % 256;
    const r2 = (seed * 131) % 256, g2 = (seed * 71) % 256, b2 = (seed * 199) % 256;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="rgb(${r1},${g1},${b1})"/>
      <stop offset="100%" stop-color="rgb(${r2},${g2},${b2})"/>
    </linearGradient>
  </defs>
  <rect width="640" height="400" fill="url(#g)"/>
  ${Array.from({ length: 12 }, (_, i) => {
    const cx = ((seed >> (i * 2)) * (i + 1)) % 640;
    const cy = ((seed >> (i * 3)) * (i + 2)) % 400;
    const rad = 30 + ((seed >> i) % 60);
    return `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="white" opacity="0.15"/>`;
  }).join('\n  ')}
  <text x="320" y="220" font-family="ui-sans-serif,system-ui,sans-serif" font-size="22" font-weight="700" fill="white" text-anchor="middle">${(prompt.slice(0, 60))}</text>
  <text x="320" y="250" font-family="ui-monospace,monospace" font-size="13" fill="white" opacity="0.7" text-anchor="middle">DuckAI Image · demo local</text>
</svg>`;
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(svg);
  }
});

module.exports = {
  category: 'IA',
  description: 'Inteligencia artificial (demo): chat, modelos OSS y generador de imágenes.',
  endpoints
};
