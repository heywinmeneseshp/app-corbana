"use client";

import { useMemo, useState } from "react";
import { FiX } from "react-icons/fi";

/**
 * Selector de "chips" con autocompletar: muestra solo lo ya asignado como
 * pastillas removibles, y un input que sugiere lo disponible para agregar.
 * No llama a ninguna API — el padre decide qué hacer con `onChange` y
 * cuándo persistir (normalmente con un botón "Guardar" aparte).
 *
 * `items` / `selected`: arreglos de { uuid, label, sublabel? }.
 */
export default function TagPicker({ items, selected, onChange, placeholder }) {
  const [query, setQuery] = useState("");

  const selectedUuids = useMemo(() => new Set(selected.map((s) => s.uuid)), [selected]);

  const suggestions = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toLowerCase();
    return items
      .filter((item) => !selectedUuids.has(item.uuid))
      .filter((item) => item.label.toLowerCase().includes(q) || item.sublabel?.toLowerCase().includes(q))
      .slice(0, 8);
  }, [items, selectedUuids, query]);

  const addItem = (item) => {
    onChange([...selected, item]);
    setQuery("");
  };

  const removeItem = (uuid) => {
    onChange(selected.filter((s) => s.uuid !== uuid));
  };

  return (
    <div>
      <div className="position-relative mb-2">
        <input
          type="text"
          className="form-control rounded-3"
          placeholder={placeholder || "Buscar para agregar..."}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {suggestions.length > 0 && (
          <div
            className="position-absolute w-100 bg-white border rounded-3 shadow-sm mt-1"
            style={{ zIndex: 20, maxHeight: "12rem", overflowY: "auto" }}
          >
            {suggestions.map((item) => (
              <button
                key={item.uuid}
                type="button"
                className="btn btn-light w-100 text-start rounded-0 border-0 py-2 px-3 small"
                onClick={() => addItem(item)}
              >
                {item.label}
                {item.sublabel && <span className="text-secondary ms-2">{item.sublabel}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="border rounded-3 p-2 d-flex flex-wrap gap-2" style={{ minHeight: "3rem" }}>
        {selected.length === 0 && <span className="text-secondary small px-1">Nada asignado todavía.</span>}
        {selected.map((item) => (
          <span key={item.uuid} className="badge rounded-pill bg-brand d-inline-flex align-items-center gap-2 py-2 px-3">
            {item.label}
            <button
              type="button"
              className="btn-close btn-close-white"
              style={{ fontSize: "0.6rem" }}
              onClick={() => removeItem(item.uuid)}
              aria-label="Quitar"
            ></button>
          </span>
        ))}
      </div>
    </div>
  );
}
