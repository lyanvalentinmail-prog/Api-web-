/**
 * Categoría: PRIMBON — Entretenimiento esotérico y cultural adaptado al español.
 * Equivalente a los endpoints tradicionales del primbon javanés: nombres, suerte,
 * compatibilidad, sueños, zodiaco, etc. Respuestas deterministas y de entretenimiento.
 */

const { seedFrom } = require('../lib/util');

function interpretarSueño(suenio) {
  const semilla = seedFrom(suenio);
  const interpretaciones = [
    'Sueño que sugiere un período de cambios positivos.',
    'Tu subconsciente te recuerda algo pendiente que debes resolver.',
    'Indica la llegada de una noticia inesperada.',
    'Simboliza renovación y cierre de ciclos.',
    'Refleja tus deseos de libertad o descanso.'
  ];
  return interpretaciones[semilla % interpretaciones.length];
}

module.exports = {
  category: 'PRIMBON',
  description: 'Entretenimiento esotérico en español: significado de nombres, compatibilidad, sueños, zodiaco, etc. TODO ES FICCIONAL.',
  endpoints: [
    {
      name: 'Significado de un nombre',
      path: '/api/primbon/artinama',
      method: 'GET',
      description: 'Significado ficticio-determinista de un nombre.',
      responseType: 'json',
      params: [
        { name: 'nama', type: 'string', required: true, example: 'Valentín', description: 'Tu nombre' }
      ],
      handler: async (req, res) => {
        const nama = String(req.query.nama || '').trim();
        if (!nama) return res.status(400).json({ status: false, error: 'Parámetro "nama" obligatorio.' });
        const s = seedFrom(nama);
        const adjs = ['creativo', 'curioso', 'leal', 'resiliente', 'generoso', 'sociable', 'analítico', 'intrépido'];
        res.json({
          status: true,
          data: {
            nombre: nama,
            significado: `Persona ${adjs[s % adjs.length]} y ${adjs[(s >> 2) % adjs.length]}.`,
            numero_de_suerte: (s % 9) + 1,
            advertencia: 'Resultado con fines de entretenimiento.'
          }
        });
      }
    },
    {
      name: 'Número de la suerte',
      path: '/api/primbon/nomorhoki',
      method: 'GET',
      description: 'Número de la suerte calculado a partir de tu nombre.',
      responseType: 'json',
      params: [
        { name: 'nama', type: 'string', required: true, example: 'Ana', description: 'Tu nombre' }
      ],
      handler: async (req, res) => {
        const nama = String(req.query.nama || '').trim();
        if (!nama) return res.status(400).json({ status: false, error: 'Parámetro "nama" obligatorio.' });
        const n = seedFrom(nama) % 100;
        res.json({ status: true, data: { nombre: nama, numero_de_la_suerte: [n, (n * 7) % 100, (n * 13) % 100].sort((a,b)=>a-b) } });
      }
    },
    {
      name: 'Compatibilidad de pareja',
      path: '/api/primbon/kecocokan_nama_pasangan',
      method: 'GET',
      description: 'Compatibilidad ficticia entre dos nombres.',
      responseType: 'json',
      params: [
        { name: 'nama1', type: 'string', required: true, example: 'María', description: 'Primer nombre' },
        { name: 'nama2', type: 'string', required: true, example: 'José', description: 'Segundo nombre' }
      ],
      handler: async (req, res) => {
        const n1 = String(req.query.nama1 || '').trim();
        const n2 = String(req.query.nama2 || '').trim();
        if (!n1 || !n2) return res.status(400).json({ status: false, error: 'Los parámetros "nama1" y "nama2" son obligatorios.' });
        const score = Math.max(40, seedFrom(n1 + '♥' + n2) % 101);
        res.json({ status: true, data: { nombre1: n1, nombre2: n2, compatibilidad_pct: score, veredicto: score > 85 ? 'Conexión fuerte.' : score > 60 ? 'Buena sintonía.' : 'Compatibilidad moderada, la comunicación es clave.' } });
      }
    },
    {
      name: 'Predicción de pareja (bali)',
      path: '/api/primbon/ramalanjodohbali',
      method: 'GET',
      description: 'Predicción al estilo balinés (demo).',
      responseType: 'json',
      params: [
        { name: 'nama1', type: 'string', required: true, example: 'Dewi', description: 'Primer nombre' },
        { name: 'nama2', type: 'string', required: true, example: 'Agus', description: 'Segundo nombre' }
      ],
      handler: async (req, res) => {
        const n1 = String(req.query.nama1 || '').trim();
        const n2 = String(req.query.nama2 || '').trim();
        if (!n1 || !n2) return res.status(400).json({ status: false, error: 'Faltan parámetros.' });
        const score = Math.max(30, seedFrom('bali' + n1 + n2) % 101);
        res.json({ status: true, data: { pareja: `${n1} & ${n2}`, porcentaje: score, mensaje: 'Predicción cultural balinesa — solo entretenimiento.' } });
      }
    },
    {
      name: 'Suerte según el día de nacimiento',
      path: '/api/primbon/rejeki_hoki_weton',
      method: 'GET',
      description: 'Suerte según la fecha de nacimiento (demo).',
      responseType: 'json',
      params: [
        { name: 'fecha', type: 'string', required: true, example: '1995-06-12', description: 'Fecha YYYY-MM-DD' }
      ],
      handler: async (req, res) => {
        const fecha = String(req.query.fecha || '').trim();
        if (!fecha) return res.status(400).json({ status: false, error: 'Parámetro "fecha" obligatorio.' });
        const s = seedFrom(fecha);
        res.json({ status: true, data: { fecha, suerte_del_dia: ['Buena', 'Muy buena', 'Estable', 'Desafíos'][s % 4], recomendacion: 'Mantén una actitud positiva y actúa con calma.' } });
      }
    },
    {
      name: 'Zodiaco occidental',
      path: '/api/primbon/zodiak',
      method: 'GET',
      description: 'Horóscopo según el signo zodiacal.',
      responseType: 'json',
      params: [
        { name: 'signo', type: 'string', required: true, example: 'libra', description: 'Signo zodiacal en español' }
      ],
      handler: async (req, res) => {
        const signo = String(req.query.signo || '').toLowerCase().trim();
        if (!signo) return res.status(400).json({ status: false, error: 'Parámetro "signo" obligatorio.' });
        const s = seedFrom(signo + new Date().toISOString().slice(0,10));
        const frases = ['Hoy es buen día para cerrar pendientes.', 'Una sorpresa llegará pronto.', 'Escucha antes de hablar.', 'Cuida tu descanso esta noche.'];
        res.json({ status: true, data: { signo, prediccion: frases[s % frases.length], numero_de_la_suerte: (s % 9) + 1 } });
      }
    },
    {
      name: 'Interpretación de sueños',
      path: '/api/primbon/tafsirmimpi',
      method: 'GET',
      description: 'Interpretación ficticia de un sueño.',
      responseType: 'json',
      params: [
        { name: 'mimpi', type: 'string', required: true, example: 'volar sobre el mar', description: 'Describe tu sueño' }
      ],
      handler: async (req, res) => {
        const mimpi = String(req.query.mimpi || '').trim();
        if (!mimpi) return res.status(400).json({ status: false, error: 'Parámetro "mimpi" obligatorio.' });
        res.json({ status: true, data: { sueño: mimpi, interpretacion: interpretarSueño(mimpi) } });
      }
    },
    {
      name: 'Rasgos y consejos de negocio',
      path: '/api/primbon/sifat_usaha_bisnis',
      method: 'GET',
      description: 'Rasgos de personalidad y consejos de negocio (demo).',
      responseType: 'json',
      params: [
        { name: 'nama', type: 'string', required: true, example: 'Carlos', description: 'Tu nombre' }
      ],
      handler: async (req, res) => {
        const nama = String(req.query.nama || '').trim();
        if (!nama) return res.status(400).json({ status: false, error: 'Parámetro "nama" obligatorio.' });
        const s = seedFrom(nama + 'biz');
        const consejos = ['Inicia pequeño pero piensa en grande.', 'Escucha a tus clientes antes de escalar.', 'Diversifica tus fuentes de ingreso.', 'Mantén las finanzas ordenadas.'];
        res.json({ status: true, data: { nombre: nama, rasgos: ['determinación', 'creatividad', 'empatía'], consejo_negocio: consejos[s % consejos.length] } });
      }
    },
    {
      name: 'Predicción de pareja general',
      path: '/api/primbon/ramalanjodoh',
      method: 'GET',
      description: 'Predicción amorosa genérica.',
      responseType: 'json',
      params: [
        { name: 'nama', type: 'string', required: true, example: 'Lucía', description: 'Tu nombre' }
      ],
      handler: async (req, res) => {
        const nama = String(req.query.nama || '').trim();
        if (!nama) return res.status(400).json({ status: false, error: 'Parámetro "nama" obligatorio.' });
        const s = seedFrom(nama + 'cinta');
        res.json({ status: true, data: { nombre: nama, prediccion: 'Se acercan días de conexión emocional.', probabilidad_pct: 50 + (s % 50) } });
      }
    },
    {
      name: 'Chequeo de potencial de salud (demo)',
      path: '/api/primbon/cek_potensi_penyakit',
      method: 'GET',
      description: 'Chequeo ficticio (NO MÉDICO) — sólo entretenimiento.',
      responseType: 'json',
      params: [
        { name: 'nama', type: 'string', required: true, example: 'Laura', description: 'Tu nombre' }
      ],
      handler: async (req, res) => {
        const nama = String(req.query.nama || '').trim();
        if (!nama) return res.status(400).json({ status: false, error: 'Parámetro "nama" obligatorio.' });
        const s = seedFrom(nama + 'salud');
        res.json({
          status: true,
          data: {
            nombre: nama,
            advertencia: 'Esto NO es un diagnóstico médico. Consulta a un profesional.',
            consejos: ['Dormir 7-8 horas', 'Hidratarte bien', 'Caminar 30 min al día', 'Reducir azúcares']
          }
        });
      }
    }
  ]
};
