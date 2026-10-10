/**
 * Categoría: JUEGOS — minijuegos basados en texto y preguntas (en español).
 */

const { seedFrom } = require('../lib/util');

const JUEGOS = [
  { slug: 'adivinarpalabra', nombre: 'Adivina la palabra', banco: ['manzana', 'programa', 'consola', 'servidor', 'internet', 'biblioteca', 'elefante', 'guitarra'] },
  { slug: 'completarfrase', nombre: 'Completa la frase', banco: ['El que mucho abarca, poco ___', 'A quien madruga, Dios le ___', 'Camarón que se duerme, se lo ___'] },
  { slug: 'provincias', nombre: 'Provincias de España', banco: ['Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Bilbao', 'Málaga', 'Zaragoza'] },
  { slug: 'acertijos', nombre: 'Acertijos', banco: ['¿Qué cosa es que cuanto más le quitas más grande es? → El agujero.', '¿Qué sube y baja pero nunca se mueve? → La escalera.', '¿Cuál es el día más largo de la semana? → El miércoles, porque tiene nueve letras.'] },
  { slug: 'trivia', nombre: 'Trivia general', banco: ['¿Cuál es el río más largo del mundo? → El Amazonas.', '¿En qué año llegó el hombre a la Luna? → 1969.', '¿Qué elemento tiene como símbolo químico "O"? → Oxígeno.'] }
];

function pregunta(slug, banco) {
  const seed = Date.now() % banco.length + slug.length;
  const idx = Math.floor(Math.random() * banco.length);
  const item = banco[idx];
  return {
    juego: slug,
    pista: item.split('→')[0].trim(),
    respuesta: item.includes('→') ? item.split('→')[1].trim() : null,
    opciones: banco.slice(0, 4)
  };
}

// Construcción dinámica: un endpoint por juego del array original + endpoints especiales.
const GENERIC = [
  { slug: 'lengkapikalimat', nombre: 'Lengkapi kalimat', banco: JUEGOS[1].banco },
  { slug: 'kabupaten', nombre: 'Kabupaten (ciudades)', banco: JUEGOS[2].banco },
  { slug: 'tekateki', nombre: 'Teka-teki (acertijos)', banco: JUEGOS[3].banco },
  { slug: 'tebakjkt', nombre: 'Tebak JKT', banco: ['Ayana', 'Shani', 'Cindy', 'Gracia', 'Feni'] },
  { slug: 'tebakkalimat', nombre: 'Tebak kalimat', banco: JUEGOS[1].banco },
  { slug: 'caklontong', nombre: 'Cak Lontong', banco: JUEGOS[4].banco },
  { slug: 'cc-sd', nombre: 'Cerdas Cermat SD', banco: JUEGOS[4].banco },
  { slug: 'tebaklogo', nombre: 'Tebak Logo', banco: ['Apple', 'Google', 'Microsoft', 'Amazon', 'Meta', 'Netflix'] },
  { slug: 'susunkata', nombre: 'Susun Kata (anagramas)', banco: ['programa', 'servidor', 'consola', 'apiweb', 'palabra'] },
  { slug: 'tebakwarna', nombre: 'Adivina el color', banco: [{ color: 'rojo', hex: '#e5484d' }, { color: 'azul', hex: '#0a84ff' }, { color: 'verde', hex: '#8ACE00' }, { color: 'amarillo', hex: '#f5c518' }] },
  { slug: 'tebaklagu', nombre: 'Adivina la canción', banco: ['Despacito', 'La Bamba', 'Bésame mucho', 'La Tortura', 'Hasta que te conocí'] },
  { slug: 'asahotak', nombre: 'Asah Otak (agilidad mental)', banco: JUEGOS[3].banco },
  { slug: 'tebaklirik', nombre: 'Adivina la letra', banco: ['La cucaracha, la cucaracha, ya no puede caminar', 'Ay, ay, ay, ay, canta y no llores'] },
  { slug: 'maths', nombre: 'Matemáticas rápidas', banco: [] },
  { slug: 'tebakkata', nombre: 'Adivina la palabra', banco: JUEGOS[0].banco },
  { slug: 'tebakkimia', nombre: 'Adivina elementos químicos', banco: ['Oxígeno', 'Hidrógeno', 'Carbono', 'Sodio', 'Hierro', 'Oro'] },
  { slug: 'surah', nombre: 'Tebak Surah', banco: ['Al-Fatiha', 'Al-Baqarah', 'An-Nas', 'Al-Ikhlas', 'Ar-Rahman'] },
  { slug: 'tebakhewan', nombre: 'Adivina el animal', banco: ['Elefante', 'Jirafa', 'Canguro', 'Pingüino', 'Delfín'] },
  { slug: 'tebaktebakan', nombre: 'Tebak-tebakan', banco: JUEGOS[3].banco },
  { slug: 'tebakbendera', nombre: 'Adivina la bandera', banco: ['España', 'México', 'Argentina', 'Chile', 'Colombia', 'Perú'] },
  { slug: 'tebakkartun', nombre: 'Adivina el dibujo animado', banco: ['Doraemon', 'Pokémon', 'Los Simpsons', 'SpongeBob', 'Dragon Ball'] },
  { slug: 'siapakahaku', nombre: '¿Quién soy?', banco: ['Soy el rey del pop: Michael Jackson', 'Soy el creador de la teoría de la relatividad: Einstein'] },
  { slug: 'tebakgame', nombre: 'Adivina el videojuego', banco: ['Minecraft', 'Fortnite', 'Tetris', 'Among Us', 'Zelda', 'Mario Bros'] },
  { slug: 'karakter-freefire', nombre: 'Personajes Free Fire', banco: ['Alok', 'Hayato', 'Kelly', 'DJ Alok', 'Jota', 'Andrew'] },
  { slug: 'tebakheroml', nombre: 'Héroes Mobile Legends', banco: ['Layla', 'Miya', 'Zilong', 'Alucard', 'Gusion', 'Lancelot'] },
  { slug: 'tebakgambar', nombre: 'Adivina la imagen', banco: JUEGOS[3].banco },
  { slug: 'family100', nombre: 'Family 100', banco: ['¿Qué se hace al levantarse?', '¿Qué hay en una cocina?', '¿Qué llevas a la playa?'] }
];

const endpoints = GENERIC.map(g => ({
  name: g.nombre,
  path: `/api/games/${g.slug}`,
  method: 'GET',
  description: `Pregunta o reto de ${g.nombre} en español (demo).`,
  responseType: 'json',
  params: [
    { name: 'respuesta', type: 'string', required: false, example: '', description: 'Tu respuesta (opcional)' }
  ],
  handler: ((banco, nombre) => async (req, res) => {
    if (!banco || !banco.length) {
      // Maths
      const a = 1 + Math.floor(Math.random() * 20);
      const b = 1 + Math.floor(Math.random() * 20);
      const op = ['+', '-', '*'][Math.floor(Math.random() * 3)];
      const res_ = op === '+' ? a + b : op === '-' ? a - b : a * b;
      return res.json({
        status: true, data: {
          juego: nombre,
          pregunta: `¿Cuánto es ${a} ${op} ${b}?`,
          respuesta_correcta: req.query.respuesta ? Number(req.query.respuesta) === res_ : null,
          correcta: res_
        }
      });
    }
    const idx = Math.floor(Math.random() * banco.length);
    const item = banco[idx];
    const esObjeto = typeof item === 'object';
    const pista = esObjeto ? `Palabra: ${item.color}` : item.split('→')[0].trim();
    const correcta = esObjeto ? item.color : (item.includes('→') ? item.split('→')[1].trim() : item);
    const respuestaUsuario = String(req.query.respuesta || '').trim();
    res.json({
      status: true,
      data: {
        juego: nombre,
        pista,
        opciones: banco.slice(0, 4).map(x => typeof x === 'object' ? x.color : x.split('→')[0].trim()),
        tu_respuesta: respuestaUsuario || null,
        es_correcta: respuestaUsuario ? respuestaUsuario.toLowerCase() === String(correcta).toLowerCase() : null,
        respuesta: respuestaUsuario ? correcta : null
      }
    });
  })(g.banco, g.nombre)
}));

module.exports = {
  category: 'JUEGOS',
  description: 'Minijuegos de texto: trivias, acertijos, adivinanzas y preguntas rápidas en español.',
  endpoints
};
