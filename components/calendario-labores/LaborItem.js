"use client";

import { useState } from "react";
import LaborIconBadge from "./LaborIconBadge";
import LaborTooltip from "./LaborTooltip";

// Fila compacta: círculo del color de la labor con su icono en blanco
// adentro + nombre en texto neutro. Sin fondo ni borde de color en el texto
// — el color vive únicamente en el círculo. Muestra LaborTooltip al pasar
// el mouse.
export default function LaborItem({ ocurrencia, onClick }) {
  const [hoverPos, setHoverPos] = useState(null);

  return (
    <div
      role="button"
      tabIndex={0}
      className="d-flex align-items-center gap-2 px-2 py-1 rounded-2 labor-item"
      style={{ cursor: "pointer" }}
      onMouseEnter={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setHoverPos({ x: rect.left, y: rect.bottom });
      }}
      onMouseLeave={() => setHoverPos(null)}
      onClick={(e) => {
        e.stopPropagation();
        setHoverPos(null);
        onClick(ocurrencia);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(ocurrencia);
        }
      }}
    >
      <LaborIconBadge icono={ocurrencia.labor?.icono} color={ocurrencia.labor?.color} size={20} />
      <span className="small text-body text-truncate">{ocurrencia.labor?.nombre}</span>
      {hoverPos && <LaborTooltip ocurrencia={ocurrencia} position={hoverPos} />}
    </div>
  );
}
