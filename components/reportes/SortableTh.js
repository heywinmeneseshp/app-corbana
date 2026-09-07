"use client";

// <th> clicable para ordenar una tabla — mismo patrón en todas las tablas
// de Reportes (Embolses, Repiques, Cajas, Ratio, Aprovechamiento). Clic:
// si la columna no era la activa, ordena descendente; si ya era la activa,
// alterna asc/desc.
import { FiChevronUp, FiChevronDown } from "react-icons/fi";

export default function SortableTh({ label, field, sort, onSort, align = "end", className = "" }) {
  const activa = sort.field === field;
  return (
    <th
      className={`text-${align} ${className}`}
      style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
      onClick={() => onSort(field)}
    >
      <span className="d-inline-flex align-items-center gap-1">
        {label}
        {activa ? (
          sort.dir === "asc" ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />
        ) : (
          <span className="d-inline-flex flex-column text-secondary opacity-50" style={{ lineHeight: "0.5" }}>
            <FiChevronUp size={10} />
            <FiChevronDown size={10} />
          </span>
        )}
      </span>
    </th>
  );
}

// Helper de orden genérico: `getValue(row)` devuelve el valor comparable
// para la columna activa; null/undefined siempre van al final sea cual sea
// la dirección, para no ensuciar el tope de la tabla con "—".
export function ordenarFilas(filas, sort, getValue) {
  if (!sort.field) return filas;
  const factor = sort.dir === "asc" ? 1 : -1;
  return [...filas].sort((a, b) => {
    const va = getValue(a);
    const vb = getValue(b);
    if (va === null || va === undefined) return vb === null || vb === undefined ? 0 : 1;
    if (vb === null || vb === undefined) return -1;
    if (typeof va === "string") return factor * va.localeCompare(vb, "es");
    return factor * (va - vb);
  });
}
