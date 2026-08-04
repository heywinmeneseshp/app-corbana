"use client";

import WeekCell from "./WeekCell";
import { celdaKey } from "@/lib/laborCalendarBuilder";

// Fila de un lote: nombre pegado a la izquierda (sticky) + una WeekCell por
// cada semana visible.
export default function LotRow({ lote, semanas, mapaCeldas, puedeCrear, onEmptyClick, onLaborClick }) {
  return (
    <tr>
      <td
        className="fw-medium small border-bottom py-2"
        style={{ position: "sticky", left: 0, backgroundColor: "#fff", zIndex: 1 }}
      >
        {lote.nombre}
      </td>
      {semanas.map((semana) => (
        <WeekCell
          key={semana.uuid}
          ocurrencias={mapaCeldas.get(celdaKey(semana.uuid, lote.uuid)) || []}
          puedeCrear={puedeCrear}
          onEmptyClick={() => onEmptyClick(semana, lote)}
          onLaborClick={onLaborClick}
        />
      ))}
    </tr>
  );
}
