/**
 * Categoría: FUN (4 endpoints)
 * Entretenimiento honesto: zodiaco, compatibilidad, Bola 8 y roasts.
 * Todo es claramente lúdico (sin datos fingidos que se hagan pasar por reales).
 */

const { seedFrom } = require('../lib/util');

module.exports = {
  category: 'FUN',
  description: 'Entretenimiento determinista y aleatorio: zodiaco, compatibilidad, Bola 8 Mágica y roasts amistosos.',
  endpoints: [
    {
      name: 'Zodiac Sign',
      path: '/api/fun/zodiac',
      method: 'GET',
      description: 'Elemento, planeta regente, número de la suerte y predicción diaria de un signo.',
      responseType: 'json',
      params: [
        {
          name: 'sign',
          type: 'select',
          options: ['aries', 'tauro', 'geminis', 'cancer', 'leo', 'virgo', 'libra', 'escorpio', 'sagitario', 'capricornio', 'acuario', 'piscis'],
          required: false,
          example: 'libra',
          description: 'Signo del zodiaco'
        }
      ],
      handler: async (req, res) => {
        const signs = {
          aries: { element: 'Fuego', ruler: 'Marte', lucky_number: 9 },
          tauro: { element: 'Tierra', ruler: 'Venus', lucky_number: 6 },
          geminis: { element: 'Aire', ruler: 'Mercurio', lucky_number: 5 },
          cancer: { element: 'Agua', ruler: 'Luna', lucky_number: 2 },
          leo: { element: 'Fuego', ruler: 'Sol', lucky_number: 1 },
          virgo: { element: 'Tierra', ruler: 'Mercurio', lucky_number: 14 },
          libra: { element: 'Aire', ruler: 'Venus', lucky_number: 7 },
          escorpio: { element: 'Agua', ruler: 'Plutón', lucky_number: 8 },
          sagitario: { element: 'Fuego', ruler: 'Júpiter', lucky_number: 3 },
          capricornio: { element: 'Tierra', ruler: 'Saturno', lucky_number: 4 },
          acuario: { element: 'Aire', ruler: 'Urano', lucky_number: 11 },
          piscis: { element: 'Agua', ruler: 'Neptuno', lucky_number: 12 }
        };
        const sign = (req.query.sign || 'libra').toLowerCase();
        const info = signs[sign] || signs.libra;
        const day = new Date().toISOString().slice(0, 10);
        const seed = seedFrom(sign + day);
        const predictions = [
          'Buen día para cerrar pendientes y empezar algo con calma.',
          'Una conversación inesperada trae una idea útil.',
          'Avanza en lo importante antes del mediodía.',
          'Día estable: ordena, documenta y celebra lo avanzado.'
        ];
        res.json({
          status: true,
          data: { sign: sign.toUpperCase(), ...info, date: day, daily_prediction: predictions[seed % predictions.length] }
        });
      }
    },
    {
      name: 'Love Calculator',
      path: '/api/fun/love-calculator',
      method: 'GET',
      description: 'Compatibilidad determinista entre dos nombres (mismo resultado para los mismos nombres).',
      responseType: 'json',
      params: [
        { name: 'name1', type: 'string', required: true, example: 'Lyan', description: 'Primer nombre' },
        { name: 'name2', type: 'string', required: true, example: 'Valentin', description: 'Segundo nombre' }
      ],
      handler: async (req, res) => {
        const n1 = (req.query.name1 || '').trim();
        const n2 = (req.query.name2 || '').trim();
        if (!n1 || !n2) return res.status(400).json({ status: false, error: 'Los parámetros "name1" y "name2" son obligatorios.' });
        const combined = (n1 + '♥' + n2).toLowerCase();
        const score = Math.max(55, seedFrom(combined) % 101);
        res.json({
          status: true,
          data: {
            name1: n1,
            name2: n2,
            compatibility_percent: score,
            verdict: score > 85 ? 'Conexión legendaria.' : score > 70 ? 'Gran química y equipo sólido.' : 'Buena base con potencial.'
          }
        });
      }
    },
    {
      name: 'Magic 8-Ball',
      path: '/api/fun/8ball',
      method: 'GET',
      description: 'La Bola 8 responde preguntas de sí o no.',
      responseType: 'json',
      params: [
        { name: 'question', type: 'string', required: true, example: '¿Debería desplegar un viernes?', description: 'Tu pregunta' }
      ],
      handler: async (req, res) => {
        const question = (req.query.question || '').trim();
        if (!question) return res.status(400).json({ status: false, error: 'El parámetro "question" es obligatorio.' });
        const answers = [
          'Es decididamente así.',
          'Sin lugar a dudas.',
          'Sí, definitivamente.',
          'Las señales apuntan a que sí.',
          'Mejor no te lo digo ahora.',
          'Mis fuentes dicen que no.',
          'Concéntrate y vuelve a preguntar.'
        ];
        res.json({ status: true, data: { question, answer: answers[Math.floor(Math.random() * answers.length)] } });
      }
    },
    {
      name: 'Developer Roast',
      path: '/api/fun/roast',
      method: 'GET',
      description: 'Broma amistosa estilo roast para devs.',
      responseType: 'json',
      params: [
        { name: 'target', type: 'string', required: false, example: 'Bro', description: 'Nombre del amigo' }
      ],
      handler: async (req, res) => {
        const target = (req.query.target || 'Bro').trim().slice(0, 24);
        const roasts = [
          `${target} depura con tantos console.log() que la terminal parece los créditos de Star Wars.`,
          `El código de ${target} tiene más parches temporales que un servidor legacy de 1999.`,
          `${target} abre 47 pestañas de StackOverflow para centrar un div y aun así queda chueco.`,
          `${target} hace git push --force un viernes a las 6 pm y apaga el celular.`
        ];
        res.json({ status: true, data: { target, roast: roasts[Math.floor(Math.random() * roasts.length)] } });
      }
    }
  ]
};
