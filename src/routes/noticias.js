/**
 * Categoría: NOTICIAS — titulares en español (datos de demostración).
 * En un despliegue real estos se extraerían de RSS públicos.
 */

const HEADLINES = {
  tecnologia: [
    'La API pública sin clave se consolida como recurso clave para desarrolladores',
    'Nuevo estándar de imágenes optimizadas reduce tiempos de carga en un 40%',
    'JavaScript añade métodos nativos esperados durante años',
    'Los bots de comunidad impulsan la creatividad en servidores de Discord y Telegram'
  ],
  deportes: [
    'La liga hispanohablante rompe récord de asistencia esta temporada',
    'Atleta juvenil sorprende con marca histórica en los 100 metros',
    'Se presenta el calendario internacional de fútbol para el próximo año'
  ],
  ciencia: [
    'Descubren exoplaneta con condiciones similares a la Tierra',
    'Nuevo tratamiento experimental muestra resultados prometedores',
    'Inteligencia artificial ayuda a acelerar el descubrimiento de fármacos'
  ],
  cultura: [
    'Festival de cine independiente premia ópera prima latinoamericana',
    'Museo Nacional inaugura exposición inmersiva de arte digital',
    'Autora hispana gana premio internacional de novela'
  ]
};

function pickTitular(categoria, fuente) {
  const lista = HEADLINES[categoria] || HEADLINES.tecnologia;
  return lista.map((titulo, i) => ({
    titulo,
    fecha: new Date(Date.now() - i * 3600_000 * 4).toISOString(),
    fuente,
    enlace: `#demo-${fuente.toLowerCase()}-${i}`
  }));
}

const FUENTES = [
  ['elpais', 'El País', 'tecnologia'],
  ['bbc', 'BBC Mundo', 'ciencia'],
  ['cnn', 'CNN en Español', 'tecnologia'],
  ['tribuna', 'Tribuna Noticias', 'deportes'],
  ['liputan6', 'Liputan6 ES', 'cultura'],
  ['suara', 'Suara Noticias', 'cultura'],
  ['sindonews', 'SindoNews ES', 'deportes'],
  ['cnbc', 'CNBC en Español', 'tecnologia'],
  ['merdeka', 'Merdeka ES', 'cultura'],
  ['antara', 'Antara Noticias', 'ciencia']
];

module.exports = {
  category: 'NOTICIAS',
  description: 'Titulares recientes en español (demo). Usa el parámetro "q" para filtrar.',
  endpoints: FUENTES.map(([slug, nombreFuente, cat]) => ({
    name: nombreFuente,
    path: `/api/berita/${slug}`,
    method: 'GET',
    description: `Últimos titulares de ${nombreFuente} (demo en español).`,
    responseType: 'json',
    params: [
      { name: 'q', type: 'string', required: false, example: 'tecnología', description: 'Filtro por palabra clave' }
    ],
    handler: ((fuente, categoria) => async (req, res) => {
      let items = pickTitular(categoria, fuente);
      const q = String(req.query.q || '').toLowerCase().trim();
      if (q) items = items.filter(n => n.titulo.toLowerCase().includes(q));
      res.json({ status: true, fuente, items, total: items.length });
    })(nombreFuente, cat)
  }))
};
