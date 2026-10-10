/**
 * Categoría: INFO (6 endpoints).
 * Hora mundial, fase lunar, clima, eventos, terremotos (datos calculados/demo)
 * y horario de TV en español.
 */

const CIUDADES = ['madrid', 'barcelona', 'mexico', 'buenosaires', 'bogota', 'lima', 'santiago', 'montevideo', 'caracas', 'quito'];

function climaDeterminista(ciudad) {
  const cod = ciudad.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const temp = 10 + (cod % 25);
  const hum = 30 + ((cod * 3) % 60);
  return { ciudad, temperatura_c: temp, sensacion_c: temp - 2, humedad_pct: hum, viento_kmh: 5 + (cod % 20), condicion: ['Despejado', 'Parcialmente nublado', 'Lluvia ligera', 'Soleado'][cod % 4] };
}

module.exports = {
  category: 'INFO',
  description: 'Hora mundial, fase lunar, clima, eventos, terremotos y parrilla de TV (datos calculados/demo).',
  endpoints: [
    {
      name: 'Hora mundial',
      path: '/api/info/world-time',
      method: 'GET',
      description: 'Hora UTC, timestamps Unix y hora en múltiples zonas horarias.',
      responseType: 'json',
      params: [],
      handler: async (req, res) => {
        const now = new Date();
        res.json({
          status: true,
          data: {
            utc_iso: now.toISOString(),
            unix_seconds: Math.floor(now.getTime() / 1000),
            unix_milliseconds: now.getTime(),
            zones: {
              madrid: now.toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }),
              mexico: now.toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }),
              buenos_aires: now.toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }),
              bogota: now.toLocaleString('es-CO', { timeZone: 'America/Bogota' }),
              lima: now.toLocaleString('es-PE', { timeZone: 'America/Lima' }),
              nueva_york: now.toLocaleString('en-US', { timeZone: 'America/New_York' }),
              tokio: now.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
            }
          }
        });
      }
    },
    {
      name: 'Fase lunar',
      path: '/api/info/moon-phase',
      method: 'GET',
      description: 'Fase lunar y edad lunar para cualquier fecha.',
      responseType: 'json',
      params: [
        { name: 'date', type: 'string', required: false, example: '2026-10-10', description: 'Fecha YYYY-MM-DD' }
      ],
      handler: async (req, res) => {
        const target = req.query.date ? new Date(req.query.date) : new Date();
        if (isNaN(target.getTime())) return res.status(400).json({ status: false, error: 'Fecha inválida. Usa YYYY-MM-DD.' });
        const SYNODIC = 2551443;
        const ref = new Date('2025-01-29T12:36:00Z');
        const sec = ((target.getTime() - ref.getTime()) / 1000) % SYNODIC;
        const ageDays = Math.abs(sec / 86400);
        let phase = 'Luna Nueva';
        if (ageDays > 1.8 && ageDays <= 5.5) phase = 'Luna Creciente';
        else if (ageDays > 5.5 && ageDays <= 9.2) phase = 'Cuarto Creciente';
        else if (ageDays > 9.2 && ageDays <= 12.9) phase = 'Gibosa Creciente';
        else if (ageDays > 12.9 && ageDays <= 16.6) phase = 'Luna Llena';
        else if (ageDays > 16.6 && ageDays <= 20.3) phase = 'Gibosa Menguante';
        else if (ageDays > 20.3 && ageDays <= 24.0) phase = 'Cuarto Menguante';
        else if (ageDays > 24.0) phase = 'Luna Menguante';
        const illum = Math.round((1 - Math.cos((2 * Math.PI * ageDays) / 29.53)) / 2 * 100);
        res.json({ status: true, data: { date: target.toISOString().split('T')[0], edad_lunar_dias: Number(ageDays.toFixed(1)), fase: phase, iluminacion_pct: illum } });
      }
    },
    {
      name: 'Clima por ciudad',
      path: '/api/info/cuaca',
      method: 'GET',
      description: 'Clima actual en una ciudad (demo determinista).',
      responseType: 'json',
      params: [
        { name: 'city', type: 'string', required: false, example: 'madrid', description: 'Ciudad (minúsculas)' }
      ],
      handler: async (req, res) => {
        const city = String(req.query.city || 'madrid').toLowerCase().replace(/\s+/g, '');
        res.json({ status: true, data: climaDeterminista(city) });
      }
    },
    {
      name: 'Eventos en España/LATAM',
      path: '/api/info/event-indonesia',
      method: 'GET',
      description: 'Próximos eventos culturales (demo).',
      responseType: 'json',
      params: [],
      handler: async (req, res) => {
        res.json({
          status: true,
          data: [
            { nombre: 'Conferencia Hispana de Desarrolladores', fecha: '2026-11-15', ciudad: 'Madrid' },
            { nombre: 'Festival de Cine Iberoamericano', fecha: '2026-11-22', ciudad: 'Huelva' },
            { nombre: 'ExpoTech LATAM', fecha: '2026-12-05', ciudad: 'Ciudad de México' },
            { nombre: 'Cumbre de Ciberseguridad', fecha: '2026-12-12', ciudad: 'Bogotá' }
          ]
        });
      }
    },
    {
      name: 'Últimos terremotos (demo)',
      path: '/api/info/bmkg',
      method: 'GET',
      description: 'Información sismológica reciente (demo — usar servicios oficiales en producción).',
      responseType: 'json',
      params: [],
      handler: async (req, res) => {
        res.json({
          status: true,
          data: {
            aviso: 'Demo en español: conecta a un servicio oficial (IGN, USGS) para datos reales.',
            ultimos: [
              { magnitud: 4.2, lugar: 'Costa del Sol, España', profundidad_km: 25, hora: new Date(Date.now() - 86400000).toISOString() },
              { magnitud: 3.8, lugar: 'Costa de Oaxaca, México', profundidad_km: 40, hora: new Date(Date.now() - 43200000).toISOString() }
            ]
          }
        });
      }
    },
    {
      name: 'Parrilla TV',
      path: '/api/info/jadwaltv',
      method: 'GET',
      description: 'Parrilla televisiva del día (demo).',
      responseType: 'json',
      params: [
        { name: 'canal', type: 'string', required: false, example: 'la1', description: 'Canal (la1, la2, antena3, telecinco)' }
      ],
      handler: async (req, res) => {
        const canal = String(req.query.canal || 'la1').toLowerCase();
        const parrilla = {
          la1: [{ hora: '21:00', programa: 'Telediario 2' }, { hora: '21:45', programa: 'Informe Semanal' }, { hora: '22:30', programa: 'Película: El pianista' }],
          la2: [{ hora: '20:00', programa: 'Saber y ganar' }, { hora: '21:00', programa: 'Documentos TV' }],
          antena3: [{ hora: '21:00', programa: 'Antena 3 Noticias' }, { hora: '22:00', programa: 'El Hormiguero' }],
          telecinco: [{ hora: '21:00', programa: 'Informativos Telecinco' }, { hora: '22:30', programa: 'Supervivientes' }]
        };
        res.json({ status: true, data: { canal, programacion: parrilla[canal] || parrilla.la1 } });
      }
    }
  ]
};
