// Adaptador de datos del módulo de Precalibración.
//
// Hoy: USE_MOCK = true — todo se calcula en cliente desde mockData.js.
// Mañana: poner USE_MOCK = false e implementar cada función con apiFetch:
//
//   Contraro REST futuro (propuesta):
//   GET /precalibracion/resumen?semanaId&fincaId&loteId&valorId&cintaId
//     → { kpis, tabla, distribucion, potencial, ratio }
//   GET /precalibracion/lotes/:loteId/detalle?semanaId&fincaId&valorId&cintaId
//     → { lote, finca, valor, resultados, total, registros }
//   Las filas tipo escalera del potencial (Estimado/Ratio/Cajas por semana)
//   salen de Estimación de fincas, vista escalera:
//   GET /estimaciones/resumen-finca?fincaUuid → próximas semanas con totales
//   por edad + ratio (Estimado = Σ racimos, Cajas = Estimado × ratio).
//   La nueva estimación ajustada se guardará como un registro NUEVO
//   (POST /estimaciones, sin modificar la original).
//
// La página y los componentes solo importan este archivo: el cambio de
// mock a API no toca la UI.

import {
  CINTAS,
  FINCAS,
  LOTES,
  REGISTROS,
  USUARIOS,
  VALORES,
  getSemanasFiltro,
  getVentanaRatio,
} from "./mockData.js";
import {
  datosGraficoRatio,
  detalleDeLote,
  distribucionPorCinta,
  filtrarRegistros,
  getSemanaReferencia,
  cintasConEmbolse,
  kpisDe,
  potencialCosecha,
  tablaPorLote,
} from "./agregaciones.js";

export const USE_MOCK = true;

// Cintas en orden de edad ascendente (9 → 12): así salen las columnas de
// la tabla, el modal y el gráfico.
const CINTAS_POR_EDAD = [...CINTAS].sort((a, b) => a.edad - b.edad);

// Opciones para los selects de filtros (derivadas de los datos). Las
// semanas se limitan hasta la actual: las futuras no tienen registros.
export function getOpcionesFiltros() {
  return { fincas: FINCAS, lotes: LOTES, semanas: getSemanasFiltro(), valores: VALORES, cintas: CINTAS };
}

// Lotes visibles para el filtro de lote (acotados a la finca elegida).
export function getLotesDeFinca(fincaId) {
  if (!fincaId) return LOTES;
  return LOTES.filter((l) => l.fincaId === fincaId);
}

export function getUsuarios() {
  return USUARIOS;
}

// Resumen completo para el dashboard con los filtros aplicados.
export function getResumen(filtros = {}) {
  const registros = filtrarRegistros(REGISTROS, filtros);
  const semanaRef = getSemanaReferencia(registros, filtros);
  const cintas = cintasConEmbolse(CINTAS_POR_EDAD, semanaRef);
  return {
    totalRegistros: registros.length,
    kpis: kpisDe(registros, LOTES),
    tabla: tablaPorLote(registros, LOTES, CINTAS),
    distribucion: distribucionPorCinta(registros, cintas),
    potencial: potencialCosecha(REGISTROS, filtros.fincaId || ""),
    ratio: datosGraficoRatio(registros, LOTES, getVentanaRatio(), filtros.fincaId || ""),
    cintas,
  };
}

// Detalle de un lote (respeta los filtros globales activos).
export function getDetalleLote(loteId, filtros = {}) {
  const registros = filtrarRegistros(REGISTROS, filtros);
  const semanaRef = getSemanaReferencia(registros, filtros);
  return detalleDeLote(loteId, registros, LOTES, cintasConEmbolse(CINTAS_POR_EDAD, semanaRef));
}
