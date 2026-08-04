"use client";

import LaborIconBadge from "./LaborIconBadge";

// Leyenda simple: un círculo del color de la labor con su icono en blanco
// adentro + nombre, por cada labor activa. El color identifica la labor
// (no la categoría) — cada labor ya trae su propio color e icono desde el
// maestro.
export default function CalendarLegend({ labores }) {
  if (labores.length === 0) return null;

  return (
    <div className="d-flex flex-wrap justify-content-end gap-3">
      {labores.map((labor) => (
        <span key={labor.uuid} className="d-flex align-items-center gap-2 small text-secondary">
          <LaborIconBadge icono={labor.icono} color={labor.color} size={16} />
          {labor.nombre}
        </span>
      ))}
    </div>
  );
}
