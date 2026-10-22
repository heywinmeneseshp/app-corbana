// Datos del módulo de Precalibración (API real: /precalibracion).
//
// La página y los componentes solo importan este archivo. Los filtros de la UI son
// { semanaId, fincaId, valorId } (uuids de semana y finca, y el valor del calibrador como "34").
//
// El "Potencial de cosecha" compara los aptos de la semana con la Estimación de fincas (cajas estimadas, ratio y
// racimos estimados = cajas ÷ ratio); si no hay estimación cargada, la API devuelve estimacion: null.

import { apiFetch } from "@/lib/api";

function paramsDe(filtros = {}) {
  const qs = new URLSearchParams();
  if (filtros.semanaId) qs.set("semanaUuid", filtros.semanaId);
  if (filtros.fincaId) qs.set("fincaUuid", filtros.fincaId);
  if (filtros.valorId) qs.set("valor", filtros.valorId);
  if (filtros.cintaId) qs.set("edad", String(filtros.cintaId).replace("edad-", ""));
  const texto = qs.toString();
  return texto ? `?${texto}` : "";
}

// Opciones para los selects de filtros: fincas, lotes, semanas (hasta la actual), valores y cintas de hoy.
export function getOpciones() {
  return apiFetch("/precalibracion/opciones");
}

// Resumen del dashboard con los filtros aplicados: KPIs, tabla por lote, distribución, ratio y potencial.
export function getResumen(filtros = {}) {
  return apiFetch(`/precalibracion/resumen${paramsDe(filtros)}`);
}

// Detalle de un lote (respeta los filtros globales activos).
export function getDetalleLote(loteId, filtros = {}) {
  return apiFetch(`/precalibracion/lotes/${loteId}/detalle${paramsDe(filtros)}`);
}

// Guarda un ajuste de estimación (cajas y ratio) de la semana consultada para una finca. Va a su propia tabla:
// NO modifica las estimaciones de la escalera.
export function guardarAjusteEstimacion({ fincaId, semanaId, racimosAptos, cajas, ratio, estimacionCajas }) {
  return apiFetch("/precalibracion/estimaciones", {
    method: "POST",
    body: JSON.stringify({ fincaUuid: fincaId, semanaUuid: semanaId, racimosAptos, cajas, ratio, estimacionCajas }),
  });
}

// Configuración: edades de cinta y valores del calibrador (global y por finca).
export function getConfiguracion() {
  return apiFetch("/precalibracion/configuracion");
}

export function guardarConfiguracion({ fincaId, edades, valores, segundosEspera, modalidad }) {
  return apiFetch("/precalibracion/configuracion", {
    method: "PUT",
    body: JSON.stringify({ fincaUuid: fincaId || null, edades, valores, segundosEspera, modalidad }),
  });
}

export function restablecerConfigFinca(fincaId) {
  return apiFetch(`/precalibracion/configuracion/${fincaId}`, { method: "DELETE" });
}

// Sesiones de precalibración (una por inicio/fin en la app de campo): racimos aptos por edad, ha, horas, duración y recorrido.
// Filtros opcionales: { fincaId, semanaId, tipo, fechaDesde, fechaHasta }.
export function getSesiones(filtros = {}) {
  const qs = new URLSearchParams();
  if (filtros.fincaId) qs.set("fincaUuid", filtros.fincaId);
  if (filtros.semanaId) qs.set("semanaUuid", filtros.semanaId);
  if (filtros.tipo) qs.set("tipo", filtros.tipo);
  if (filtros.fechaDesde) qs.set("fechaDesde", filtros.fechaDesde);
  if (filtros.fechaHasta) qs.set("fechaHasta", filtros.fechaHasta);
  const texto = qs.toString();
  return apiFetch(`/precalibracion/sesiones${texto ? `?${texto}` : ""}`);
}

// Rendimiento semanal por trabajador (suma de sus sesiones de la semana). Filtros: { semanaId, fincaId }.
export function getRendimiento(filtros = {}) {
  const qs = new URLSearchParams();
  if (filtros.semanaId) qs.set("semanaUuid", filtros.semanaId);
  if (filtros.fincaId) qs.set("fincaUuid", filtros.fincaId);
  const texto = qs.toString();
  return apiFetch(`/precalibracion/rendimiento${texto ? `?${texto}` : ""}`);
}

// Tracking GPS guardado por la app de campo durante una sesión: { puntos: [{ lat, lng, t }] }.
export function getTrazaSesion(sesionId) {
  return apiFetch(`/precalibracion/sesiones/${sesionId}/traza`);
}

// Resumen por semana de precalibración (suma de todas sus sesiones). Filtros: { fincaId, tipo }.
export function getSemanal(filtros = {}) {
  const qs = new URLSearchParams();
  if (filtros.fincaId) qs.set("fincaUuid", filtros.fincaId);
  if (filtros.tipo) qs.set("tipo", filtros.tipo);
  const texto = qs.toString();
  return apiFetch(`/precalibracion/semanal${texto ? `?${texto}` : ""}`);
}

// Carga manual desde Excel: `filas` (una por lote y día, con los racimos aptos por edad). Con simular=true solo valida.
export function importarPrecalibracion({ filas, simular }) {
  return apiFetch("/precalibracion/importar", { method: "POST", body: JSON.stringify({ filas, simular: Boolean(simular) }) });
}
