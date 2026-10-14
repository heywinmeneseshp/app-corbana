// Proyección anual de embolses y cajas (API real: /proyeccion). Un escenario guarda el año, los parámetros (rampa de
// hectáreas nuevas, años históricos, % no cosechado y hectáreas base por finca) y el plan de hectáreas nuevas.

import { apiFetch, apiFetchBlob, apiFetchFormData } from "@/lib/api";

export const listarEscenarios = (anio) => apiFetch(`/proyeccion/escenarios${anio ? `?anio=${anio}` : ""}`);
export const getEscenario = (uuid) => apiFetch(`/proyeccion/escenarios/${uuid}`);
export const crearEscenario = (datos) => apiFetch("/proyeccion/escenarios", { method: "POST", body: JSON.stringify(datos) });
export const actualizarEscenario = (uuid, datos) => apiFetch(`/proyeccion/escenarios/${uuid}`, { method: "PUT", body: JSON.stringify(datos) });
export const eliminarEscenario = (uuid) => apiFetch(`/proyeccion/escenarios/${uuid}`, { method: "DELETE" });
export const guardarAreas = (uuid, areas) => apiFetch(`/proyeccion/escenarios/${uuid}/areas`, { method: "PUT", body: JSON.stringify({ areas }) });
export const getResultado = (uuid) => apiFetch(`/proyeccion/escenarios/${uuid}/resultado`);
export const exportarEscenario = (uuid) => apiFetchBlob(`/proyeccion/escenarios/${uuid}/exportar`);

// Carga masiva (Excel/CSV con columnas finca, semana, hectareas, nota). Con dryRun solo valida.
export function cargarAreasMasivo(uuid, archivo, dryRun) {
  const formData = new FormData();
  formData.append("file", archivo);
  formData.append("dryRun", dryRun ? "true" : "false");
  return apiFetchFormData(`/proyeccion/escenarios/${uuid}/areas-bulk`, formData);
}
