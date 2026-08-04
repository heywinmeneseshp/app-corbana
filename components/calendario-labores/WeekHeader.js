"use client";

import { formatRangoSemana } from "@/lib/laborCalendarBuilder";

// Encabezado de la grilla: "Lote" + una columna por semana visible,
// mostrando el código real de la semana (S01-2026...) y, debajo, el rango
// de fechas que cubre (29 Dic - 4 Ene).
export default function WeekHeader({ semanas }) {
  return (
    <thead>
      <tr>
        <th
          className="text-secondary fw-medium small border-bottom py-2"
          style={{ position: "sticky", left: 0, backgroundColor: "#fff", zIndex: 1, minWidth: 160 }}
        >
          Lote
        </th>
        {semanas.map((semana) => (
          <th key={semana.uuid} className="border-bottom py-2 text-center" style={{ minWidth: 140 }}>
            <div className="text-secondary fw-medium small">{semana.codigo}</div>
            <div className="text-secondary fw-normal" style={{ fontSize: "0.7rem" }}>
              {formatRangoSemana(semana.fechaInicio, semana.fechaFin)}
            </div>
          </th>
        ))}
      </tr>
    </thead>
  );
}
