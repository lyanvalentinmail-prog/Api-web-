/**
 * Categoría: ANIME.
 * Endpoints de citas, búsqueda y detalle de anime (datos de ejemplo deterministas).
 */

const { seedFrom } = require('../lib/util');

const FRASES_ANIME = [
  { cita: 'El verdadero poder no está en nunca caer, sino en levantarse cada vez.', personaje: 'Naruto Uzumaki', anime: 'Naruto' },
  { cita: 'Si solo haces lo que puedes hacer, nunca serás más de lo que eres ahora.', personaje: 'Saitama', anime: 'One Punch Man' },
  { cita: 'Los sueños comienzan cuando crees en ellos.', personaje: 'Monkey D. Luffy', anime: 'One Piece' },
  { cita: 'No importa cuántas veces te derriben, levántate y sigue.', personaje: 'Izuku Midoriya', anime: 'My Hero Academia' },
  { cita: 'La vida no es un juego de suerte. Si quieres ganar, tienes que trabajar.', personaje: 'Kageyama Tobio', anime: 'Haikyuu!!' },
  { cita: 'El dolor te hace más fuerte, o te rompe; tú eliges.', personaje: 'Gon Freecss', anime: 'Hunter x Hunter' },
  { cita: 'Un corazón roto también es un corazón que aprendió a latir con más fuerza.', personaje: 'Violet Evergarden', anime: 'Violet Evergarden' },
  { cita: 'Incluso en la oscuridad más profunda, siempre hay una luz que te guía.', personaje: 'Tanjiro Kamado', anime: 'Demon Slayer' }
];

const ANIMES_POPULARES = [
  { titulo: 'Jujutsu Kaisen', genero: 'Acción, Sobrenatural', capitulos: 47, estado: 'En emisión' },
  { titulo: 'Spy x Family', genero: 'Comedia, Acción', capitulos: 37, estado: 'En emisión' },
  { titulo: 'Chainsaw Man', genero: 'Acción, Terror', capitulos: 12, estado: 'Temporada 2 confirmada' },
  { titulo: 'Frieren: Beyond Journey\'s End', genero: 'Fantasía, Drama', capitulos: 28, estado: 'Finalizado' },
  { titulo: 'Dandadan', genero: 'Acción, Comedia', capitulos: 12, estado: 'En emisión' },
  { titulo: 'Solo Leveling', genero: 'Acción, Fantasía', capitulos: 24, estado: 'En emisión' },
  { titulo: 'Oshi no Ko', genero: 'Drama, Misterio', capitulos: 22, estado: 'En emisión' }
];

module.exports = {
  category: 'ANIME',
  description: 'Frases de anime, búsqueda de animes populares y detalles (demo en español).',
  endpoints: [
    {
      name: 'Frase de anime aleatoria',
      path: '/api/s/animequotes',
      method: 'GET',
      description: 'Devuelve una frase célebre de un personaje de anime en español.',
      responseType: 'json',
      params: [],
      handler: async (req, res) => {
        const pick = FRASES_ANIME[Math.floor(Math.random() * FRASES_ANIME.length)];
        res.json({ status: true, data: pick });
      }
    },
    {
      name: 'Buscar anime',
      path: '/api/anime/auratail-search',
      method: 'GET',
      description: 'Busca en un catálogo local de animes populares (demo).',
      responseType: 'json',
      params: [
        { name: 'q', type: 'string', required: true, example: 'jujutsu', description: 'Término de búsqueda' }
      ],
      handler: async (req, res) => {
        const q = String(req.query.q || '').toLowerCase().trim();
        if (!q) return res.status(400).json({ status: false, error: 'Parámetro "q" obligatorio.' });
        const resultados = ANIMES_POPULARES.filter(a => a.titulo.toLowerCase().includes(q) || a.genero.toLowerCase().includes(q));
        res.json({ status: true, query: q, data: resultados, total: resultados.length });
      }
    },
    {
      name: 'Animes recientes / en emisión',
      path: '/api/anime/auratail-latest',
      method: 'GET',
      description: 'Lista de animes en emisión o recientes (demo).',
      responseType: 'json',
      params: [],
      handler: async (req, res) => {
        res.json({ status: true, data: ANIMES_POPULARES.filter(a => a.estado.includes('emisión')) });
      }
    },
    {
      name: 'Calendario de la temporada',
      path: '/api/anime/auratail-schedule',
      method: 'GET',
      description: 'Calendario semanal de estrenos (demo).',
      responseType: 'json',
      params: [],
      handler: async (req, res) => {
        res.json({
          status: true,
          data: {
            lunes: ['Jujutsu Kaisen'],
            martes: ['Oshi no Ko'],
            miercoles: ['Spy x Family'],
            jueves: ['Solo Leveling'],
            viernes: ['Dandadan'],
            sabado: ['Chainsaw Man'],
            domingo: ['Frieren']
          }
        });
      }
    },
    {
      name: 'Detalle de anime',
      path: '/api/anime/auratail-detail',
      method: 'GET',
      description: 'Devuelve información detallada de un anime del catálogo (demo).',
      responseType: 'json',
      params: [
        { name: 'title', type: 'string', required: true, example: 'Jujutsu Kaisen', description: 'Título del anime' }
      ],
      handler: async (req, res) => {
        const title = String(req.query.title || '').trim();
        if (!title) return res.status(400).json({ status: false, error: 'Parámetro "title" obligatorio.' });
        const anime = ANIMES_POPULARES.find(a => a.titulo.toLowerCase().includes(title.toLowerCase()));
        if (!anime) return res.status(404).json({ status: false, error: 'Anime no encontrado.' });
        const seed = seedFrom(title);
        res.json({
          status: true,
          data: {
            ...anime,
            rating: (8 + (seed % 15) / 10).toFixed(1),
            sinopsis: 'Una historia llena de acción, personajes memorables y momentos épicos que han marcado a los fans.',
            enlaces_episodios: Array.from({ length: 3 }, (_, i) => ({ episodio: i + 1, url: `#demo-ep-${i + 1}` }))
          }
        });
      }
    }
  ]
};
