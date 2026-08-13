"use client";

import { useState } from "react";
import { FiPlus } from "react-icons/fi";

// Estilo del chip por nivel — más sólido/grande en el nivel de arriba
// (menú), más chico y suave en los de abajo (submenú, permiso puntual),
// para que la jerarquía se note a simple vista en vez de que los tres
// niveles se vean iguales. Ojo: .bg-brand fija el color con !important (ver
// globals.css), así que bg-opacity-10 no le hace nada — para el tono suave
// se usa el verde claro real (--brand-100) por inline style, no una
// "opacidad" simulada sobre el verde oscuro (eso dejaba texto oscuro sobre
// fondo oscuro, ilegible).
const VARIANTES = {
  solido: { className: "badge rounded-pill bg-brand text-white d-inline-flex align-items-center gap-2 py-2 px-3" },
  suave: {
    className: "badge rounded-pill d-inline-flex align-items-center gap-2 py-1 px-2 small",
    style: { backgroundColor: "var(--brand-100)", color: "var(--brand-800)", border: "1px solid var(--brand-700)" },
  },
  outline: {
    className: "badge rounded-pill bg-white text-secondary border d-inline-flex align-items-center gap-2 py-1 px-2 small",
  },
};

/**
 * Selector con lista desplegable + botón "Agregar" (en vez del input con
 * autocompletar de TagPicker) — mismo contrato: `items` / `selected`
 * arreglos de { uuid, label, sublabel? }, `onChange(nuevaLista)`.
 * `variante`: "solido" (default) | "suave" | "outline" — controla el estilo
 * del chip seleccionado, para diferenciar niveles jerárquicos.
 */
export default function SelectAddPicker({ items, selected, onChange, placeholder, variante = "solido", compact = false }) {
  const selectedUuids = new Set(selected.map((s) => s.uuid));
  const disponibles = items.filter((item) => !selectedUuids.has(item.uuid));
  const [elegido, setElegido] = useState("");

  const handleAgregar = () => {
    if (!elegido) return;
    const item = items.find((i) => i.uuid === elegido);
    if (!item) return;
    onChange([...selected, item]);
    setElegido("");
  };

  const removeItem = (uuid) => {
    onChange(selected.filter((s) => s.uuid !== uuid));
  };

  const chip = VARIANTES[variante] || VARIANTES.solido;
  const claseBotonCerrar = variante === "solido" ? "btn-close btn-close-white" : "btn-close";

  return (
    <div>
      <div className={`d-flex gap-2 ${compact ? "mb-1" : "mb-2"}`}>
        <select
          className={`form-select rounded-3 ${compact ? "form-select-sm" : ""}`}
          value={elegido}
          onChange={(e) => setElegido(e.target.value)}
        >
          <option value="">{placeholder || "Selecciona..."}</option>
          {disponibles.map((item) => (
            <option key={item.uuid} value={item.uuid}>
              {item.label}
              {item.sublabel ? ` — ${item.sublabel}` : ""}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={`btn rounded-3 text-nowrap d-flex align-items-center gap-1 ${compact ? "btn-sm" : ""} ${variante === "solido" ? "btn-brand" : "btn-outline-secondary"}`}
          disabled={!elegido}
          onClick={handleAgregar}
        >
          <FiPlus /> Agregar
        </button>
      </div>

      {selected.length > 0 && (
        <div className="d-flex flex-wrap gap-2">
          {selected.map((item) => (
            <span key={item.uuid} className={chip.className} style={chip.style}>
              {item.label}
              <button
                type="button"
                className={claseBotonCerrar}
                style={{ fontSize: "0.55rem" }}
                onClick={() => removeItem(item.uuid)}
                aria-label="Quitar"
              ></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
