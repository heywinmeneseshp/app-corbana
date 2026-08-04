"use client";

import { useState } from "react";
import { FiPlus } from "react-icons/fi";
import LaborItem from "./LaborItem";

// Celda Lote×Semana: lista de labores compactas, o un "+" sutil al pasar el
// mouse si está vacía y el usuario puede crear. Un click en vacío abre la
// creación; un click sobre una labor abre su edición (LaborItem ya hace
// stopPropagation).
export default function WeekCell({ ocurrencias, puedeCrear, onEmptyClick, onLaborClick }) {
  const [hover, setHover] = useState(false);
  const vacia = ocurrencias.length === 0;

  return (
    <td
      className="p-1"
      style={{ cursor: vacia && puedeCrear ? "pointer" : "default", minWidth: 140, verticalAlign: "middle" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => vacia && puedeCrear && onEmptyClick()}
    >
      <div className="d-flex flex-column align-items-center gap-1" style={{ minHeight: 28 }}>
        {ocurrencias.map((oc) => (
          <LaborItem key={oc.uuid} ocurrencia={oc} onClick={onLaborClick} />
        ))}
        {vacia && puedeCrear && (
          <div
            className="d-flex align-items-center justify-content-center text-secondary"
            style={{ height: 28, opacity: hover ? 1 : 0, transition: "opacity .1s" }}
          >
            <FiPlus size={14} />
          </div>
        )}
      </div>
    </td>
  );
}
