// Datos MOCK del módulo de Precalibración (etapa frontend).
//
// Representan lo que en el futuro llegará desde la app móvil de captura:
// un registro por cada racimo que cumple con la medida del calibrador
// físico (finca, lote, cinta, edad, valor, usuario, fecha, hora, GPS).
//
// El generador es determinista (semilla fija): los mismos filtros siempre
// devuelven los mismos datos, como si vinieran de una API real.
//
// Para reemplazar por la API real, ver lib/precalibracion/api.js (flag
// USE_MOCK). Ningún componente importa este archivo directamente.

// RNG determinista (mulberry32) — estable entre recargas.
function mulberry32(semilla) {
  let a = semilla >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260928);
const entre = (min, max) => min + Math.floor(rand() * (max - min + 1));
const elegir = (arr) => arr[Math.floor(rand() * arr.length)];
const redondear2 = (n) => Math.round(n * 100) / 100;

export const FINCAS = [
  { id: "finca-oasis", codigo: "OAS", nombre: "OASIS", lat: 9.99, lng: -83.65 },
  { id: "finca-san-francisco", codigo: "SFR", nombre: "SAN FRANCISCO", lat: 10.02, lng: -83.7 },
  { id: "finca-la-palma", codigo: "LPA", nombre: "LA PALMA", lat: 9.95, lng: -83.6 },
  { id: "finca-pantoja", codigo: "PAN", nombre: "PANTOJA", lat: 10.05, lng: -83.62 },
];

// Semanas agrícolas (lunes a domingo). La "actual" mock es S40-2026
// (28-sep al 04-oct 2026); el gráfico de ratio muestra 26 atrás + actual +
// 26 adelante, cruzando de año (hasta S14-2027).
function fechaMasDias(baseIso, dias) {
  const d = new Date(`${baseIso}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

// Número de semana ISO + año ISO de una fecha calendario (cálculos en UTC
// para que el huso horario no corra el día).
export function semanaISODeFecha(fechaIso) {
  const t = new Date(`${fechaIso}T12:00:00Z`);
  const dia = (t.getUTCDay() + 6) % 7; // lunes = 0
  t.setUTCDate(t.getUTCDate() - dia + 3); // jueves de esa semana
  const anio = t.getUTCFullYear();
  const primerJueves = new Date(Date.UTC(anio, 0, 4));
  const diaPrimero = (primerJueves.getUTCDay() + 6) % 7;
  primerJueves.setUTCDate(primerJueves.getUTCDate() - diaPrimero + 3);
  const numero = 1 + Math.round((t - primerJueves) / (7 * 86400000));
  return { anio, numero };
}

export const SEMANAS = (() => {
  const lista = [];
  for (let desfase = -26; desfase <= 26; desfase++) {
    const fechaInicio = fechaMasDias("2026-09-28", desfase * 7);
    const { anio, numero } = semanaISODeFecha(fechaInicio);
    lista.push({
      id: `sem-${anio}-${numero}`,
      codigo: `S${numero}-${anio}`,
      numero,
      anio,
      fechaInicio,
      fechaFin: fechaMasDias("2026-09-28", desfase * 7 + 6),
    });
  }
  return lista;
})();

export const SEMANA_ACTUAL_ID = "sem-2026-40";

// Ventana del gráfico de ratio: 26 semanas atrás + actual + 26 adelante
// (por rango de fechas, porque cruza de año).
export function getVentanaRatio() {
  const actual = SEMANA_POR_ID.get(SEMANA_ACTUAL_ID) || SEMANAS[SEMANAS.length - 1];
  const desde = fechaMasDias(actual.fechaInicio, -26 * 7);
  const hasta = fechaMasDias(actual.fechaInicio, 26 * 7 + 6);
  return SEMANAS.filter((s) => s.fechaInicio >= desde && s.fechaInicio <= hasta);
}

// Valores de calibrador físico entregados al colaborador.
export const VALORES = [
  { id: "val-32", codigo: "32", nombre: "Calibre 32" },
  { id: "val-34", codigo: "34", nombre: "Calibre 34" },
  { id: "val-36", codigo: "36", nombre: "Calibre 36" },
];

// Cintas del móvil: cada botón corresponde a una edad objetivo. Las
// columnas de la tabla se derivan de este arreglo (dinámicas).
export const CINTAS = [
  { id: "cinta-1", nombre: "Cinta 1", edad: 12, color: "#2563eb", colorNombre: "Azul" },
  { id: "cinta-2", nombre: "Cinta 2", edad: 11, color: "#eab308", colorNombre: "Amarillo" },
  { id: "cinta-3", nombre: "Cinta 3", edad: 10, color: "#7c3aed", colorNombre: "Morado" },
  { id: "cinta-4", nombre: "Cinta 4", edad: 9, color: "#16a34a", colorNombre: "Verde" },
];

export const USUARIOS = [
  { id: "usr-juan", nombre: "Juan Pérez" },
  { id: "usr-maria", nombre: "María Gómez" },
  { id: "usr-carlos", nombre: "Carlos Ruiz" },
  { id: "usr-pedro", nombre: "Pedro Díaz" },
  { id: "usr-ana", nombre: "Ana Torres" },
  { id: "usr-luis", nombre: "Luis Mora" },
];

// Lotes con su área en producción (ha). El nombre es numérico, como en campo.
function generarLotes() {
  const lotes = [];
  const cantidades = { "finca-oasis": 8, "finca-san-francisco": 7, "finca-la-palma": 6, "finca-pantoja": 7 };
  for (const finca of FINCAS) {
    const n = cantidades[finca.id];
    for (let i = 1; i <= n; i++) {
      lotes.push({
        id: `lote-${finca.codigo.toLowerCase()}-${i}`,
        fincaId: finca.id,
        nombre: String(i),
        areaHa: redondear2(2.2 + rand() * 2.6),
      });
    }
  }
  return lotes;
}

export const LOTES = generarLotes();

// Mapas de búsqueda rápida por id (antes de REGISTROS: la generación los
// usa para acotar semanas).
export const FINCA_POR_ID = new Map(FINCAS.map((f) => [f.id, f]));
export const LOTE_POR_ID = new Map(LOTES.map((l) => [l.id, l]));
export const SEMANA_POR_ID = new Map(SEMANAS.map((s) => [s.id, s]));
export const VALOR_POR_ID = new Map(VALORES.map((v) => [v.id, v]));
export const CINTA_POR_ID = new Map(CINTAS.map((c) => [c.id, c]));
export const USUARIO_POR_ID = new Map(USUARIOS.map((u) => [u.id, u]));

// Días ISO entre dos fechas (inclusive).
function diasEntre(desde, hasta) {
  const dias = [];
  const actual = new Date(`${desde}T12:00:00`);
  const fin = new Date(`${hasta}T12:00:00`);
  while (actual <= fin) {
    dias.push(actual.toISOString().slice(0, 10));
    actual.setDate(actual.getDate() + 1);
  }
  return dias;
}

// Pesos de reparto por cinta (las edades medias concentran más racimos).
const PESO_CINTA = [0.18, 0.3, 0.32, 0.2];

function generarRegistros() {
  const registros = [];
  let n = 0;
  for (const lote of LOTES) {
    const finca = FINCAS.find((f) => f.id === lote.fincaId);
    // Cada lote se evalúa en 4 a 7 semanas ya transcurridas (cobertura
    // realista para la ventana de 26 semanas; nunca en semanas futuras a
    // la actual mock S40-2026). Con 70% de probabilidad se incluye la
    // semana actual para que el potencial de cosecha siempre tenga datos.
    const inicioActual = SEMANA_POR_ID.get(SEMANA_ACTUAL_ID).fechaInicio;
    const pasadas = SEMANAS.filter((s) => s.fechaInicio <= inicioActual);
    const semanasEvaluadas = [...pasadas].sort(() => rand() - 0.5).slice(0, entre(4, 7));
    const actual = SEMANA_POR_ID.get(SEMANA_ACTUAL_ID);
    if (!semanasEvaluadas.some((s) => s.id === actual.id) && rand() < 0.7) {
      semanasEvaluadas[0] = actual;
    }
    for (const semana of semanasEvaluadas) {
      const valor = elegir([VALORES[0], VALORES[0], VALORES[1], VALORES[1], VALORES[2]]);
      const usuario = elegir(USUARIOS);
      const totalRacimos = entre(20, 70);
      const dias = diasEntre(semana.fechaInicio, semana.fechaFin);
      // La evaluación de un lote se hace en 1 o 2 jornadas de esa semana.
      const jornadas = [...dias].sort(() => rand() - 0.5).slice(0, entre(1, 2)).sort();
      for (let i = 0; i < totalRacimos; i++) {
        const r = rand();
        let cintaIdx = 0;
        let acumulado = 0;
        for (let c = 0; c < PESO_CINTA.length; c++) {
          acumulado += PESO_CINTA[c];
          if (r <= acumulado) {
            cintaIdx = c;
            break;
          }
        }
        const cinta = CINTAS[cintaIdx];
        const fecha = elegir(jornadas);
        const hora = `${String(entre(6, 14)).padStart(2, "0")}:${String(entre(0, 59)).padStart(2, "0")}`;
        n += 1;
        registros.push({
          id: `reg-${n}`,
          fincaId: finca.id,
          loteId: lote.id,
          cintaId: cinta.id,
          edad: cinta.edad,
          valorId: valor.id,
          semanaId: semana.id,
          usuarioId: usuario.id,
          fecha,
          hora,
          lat: Math.round((finca.lat + (rand() - 0.5) * 0.02) * 10000) / 10000,
          lng: Math.round((finca.lng + (rand() - 0.5) * 0.02) * 10000) / 10000,
        });
      }
    }
  }
  // Orden cronológico, como llegarían del móvil.
  registros.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.hora < b.hora ? -1 : 1));
  return registros;
}

export const REGISTROS = generarRegistros();

// Saldo de racimos por lote y cinta (lo que hay hoy en el lote, como vendrá
// del inventario de racimos). Mock: siempre cubre a los aptos.
// RNG aparte con otra semilla para no alterar la secuencia determinista de
// REGISTROS.
const randSaldo = mulberry32(77031);

export const SALDO_POR_LOTE_CINTA = (() => {
  const aptos = new Map();
  for (const r of REGISTROS) {
    const k = `${r.loteId}|${r.cintaId}`;
    aptos.set(k, (aptos.get(k) || 0) + 1);
  }
  const mapa = {};
  for (const lote of LOTES) {
    for (const cinta of CINTAS) {
      const k = `${lote.id}|${cinta.id}`;
      const a = aptos.get(k) || 0;
      const extra = Math.floor(randSaldo() * (a * 1.2 + 12));
      mapa[k] = a + extra;
    }
  }
  return mapa;
})();

export function getSaldoLoteCinta(loteId, cintaId) {
  return SALDO_POR_LOTE_CINTA[`${loteId}|${cintaId}`] || 0;
}

// Histórico mock del ratio (aptos por hectárea) por finca y número de
// semana, años 2023–2025. Alimenta la línea de "promedio histórico" del
// gráfico de ratio (mismo concepto que estimaciones: misma semana, otros
// años). RNG aparte para no alterar las demás secuencias.
const randHist = mulberry32(40517);
const BASE_RATIO_FINCA = {
  "finca-oasis": 10,
  "finca-san-francisco": 12,
  "finca-la-palma": 11.5,
  "finca-pantoja": 12.5,
};

export const RATIO_HISTORICO = (() => {
  const filas = [];
  // Números únicos (S14-2026 y S14-2027 comparten número: el histórico es
  // estacional, por número de semana).
  const numeros = [...new Set(SEMANAS.map((s) => s.numero))];
  for (const finca of FINCAS) {
    for (const numero of numeros) {
      for (const anio of [2023, 2024, 2025]) {
        const estacional = Math.sin((numero / 52) * Math.PI * 2) * 1.5;
        const ruido = (randHist() - 0.5) * 4;
        filas.push({
          fincaId: finca.id,
          numeroSemana: numero,
          anio,
          ratio: Math.round((BASE_RATIO_FINCA[finca.id] + estacional + ruido) * 100) / 100,
        });
      }
    }
  }
  return filas;
})();

// Semanas seleccionables en filtros: solo hasta la actual (las futuras no
// tienen registros).
export function getSemanasFiltro() {
  const inicioActual = SEMANA_POR_ID.get(SEMANA_ACTUAL_ID).fechaInicio;
  return SEMANAS.filter((s) => s.fechaInicio <= inicioActual);
}

// Escalera mock de Estimación de fincas para la semana actual (como la
// vista escalera: Estimado = Σ racimos por edad, Cajas = Estimado × ratio).
// El estimado supera a los precalibrados (no todo lo estimado cumple el
// calibre). En la API real saldrá de GET /estimaciones/resumen-finca.
const FACTOR_ESTIMADO_FINCA = {
  "finca-oasis": 3.1,
  "finca-san-francisco": 2.9,
  "finca-la-palma": 3.3,
  "finca-pantoja": 2.7,
};
const FACTOR_CAJAS_FINCA = {
  "finca-oasis": 2.24,
  "finca-san-francisco": 2.04,
  "finca-la-palma": 2.38,
  "finca-pantoja": 2.07,
};

export const ESCALERA_ACTUAL = (() => {
  const mapa = {};
  for (const finca of FINCAS) {
    const racimos = REGISTROS.filter(
      (r) => r.fincaId === finca.id && r.semanaId === SEMANA_ACTUAL_ID,
    ).length;
    const estimado = Math.round(racimos * (FACTOR_ESTIMADO_FINCA[finca.id] ?? 3));
    const cajas = Math.round(racimos * (FACTOR_CAJAS_FINCA[finca.id] ?? 2.2));
    // El ratio usado se CALCULA (cajas ÷ racimos), no se fija.
    mapa[finca.id] = {
      estimado,
      cajas,
      ratio: estimado > 0 ? Math.round((cajas / estimado) * 1000) / 1000 : null,
    };
  }
  return mapa;
})();

// Promedio histórico de una semana (por finca, o global si fincaId es "").
export function getPromedioHistorico(fincaId, numeroSemana) {
  const filas = RATIO_HISTORICO.filter(
    (r) => r.numeroSemana === numeroSemana && (!fincaId || r.fincaId === fincaId),
  );
  if (filas.length === 0) return null;
  const suma = filas.reduce((a, r) => a + r.ratio, 0);
  return Math.round((suma / filas.length) * 100) / 100;
}
