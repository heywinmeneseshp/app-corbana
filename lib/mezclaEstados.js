// Estado de una prueba de mezcla (MezclaVersion.estadoPrueba) — mismo
// enum que el backend (ver mezcla.service.js). Centralizado acá porque lo
// usan la lista, el detalle y el historial de pruebas.
export const ESTADO_PRUEBA_INFO = {
  BORRADOR: { label: "Borrador", bg: "#f1f5f9", color: "#475569" },
  EN_PRUEBA: { label: "En prueba", bg: "#fef3c7", color: "#92400e" },
  OPTIMA: { label: "Óptima / Válida", bg: "#d1fae5", color: "#047857" },
  NO_VALIDA: { label: "No válida", bg: "#fee2e2", color: "#b91c1c" },
  CONVERTIDA: { label: "Convertida en elaborado", bg: "#dbeafe", color: "#1d4ed8" },
};

export function estadoPruebaInfo(estado) {
  return ESTADO_PRUEBA_INFO[estado] || { label: estado || "—", bg: "#f1f5f9", color: "#475569" };
}

// Debe coincidir con ESTADOS_EDITABLES en mezcla.service.js — una prueba
// finalizada (OPTIMA/NO_VALIDA) o convertida queda de solo lectura.
export const ESTADOS_PRUEBA_EDITABLES = ["BORRADOR", "EN_PRUEBA"];
