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

export function guardarConfiguracion({ fincaId, edades, valores }) {
  return apiFetch("/precalibracion/configuracion", {
    method: "PUT",
    body: JSON.stringify({ fincaUuid: fincaId || null, edades, valores }),
  });
}

export function restablecerConfigFinca(fincaId) {
  return apiFetch(`/precalibracion/configuracion/${fincaId}`, { method: "DELETE" });
}
