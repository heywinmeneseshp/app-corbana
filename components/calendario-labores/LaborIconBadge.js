"use client";

import { getLaborIcon } from "@/lib/laborIcons";

// Círculo del color de la labor con su icono en blanco adentro — la unidad
// visual que se repite en la grilla, la leyenda y el maestro de Labores.
export default function LaborIconBadge({ icono, color, size = 20 }) {
  const Icon = getLaborIcon(icono);

  return (
    <span
      className="d-inline-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
      style={{ width: size, height: size, backgroundColor: color || "#64748b" }}
    >
      {/* getLaborIcon devuelve un componente estable de la paleta (o el
          fallback), no crea uno nuevo en cada render. */}
      {/* eslint-disable-next-line react-hooks/static-components */}
      <Icon size={Math.round(size * 0.6)} color="#fff" />
    </span>
  );
}
