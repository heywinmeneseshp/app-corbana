"use client";

import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  const [focused, setFocused] = useState(false);
  const [dropdownRect, setDropdownRect] = useState(null);
  const inputRef = useRef(null);

  const updateDropdownRect = () => {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setDropdownRect({ top: r.bottom + 4, left: r.left, width: r.width });
  };

  const selectedUuids = useMemo(() => new Set(selected.map((s) => s.uuid)), [selected]);

  const suggestions = useMemo(() => {
    const disponibles = items.filter((item) => !selectedUuids.has(item.uuid));
    const q = query.trim().toLowerCase();
    if (!q) return disponibles.slice(0, 50);
    return disponibles
      .filter((item) => item.label.toLowerCase().includes(q) || item.sublabel?.toLowerCase().includes(q))
      .slice(0, 8);
  }, [items, selectedUuids, query]);

  const addItem = (item) => {
    onChange([...selected, item]);
    setQuery("");
    setFocused(false);
  };

  const removeItem = (uuid) => {
    onChange(selected.filter((s) => s.uuid !== uuid));
  };

  return (
    <div>
      <div className="position-relative mb-2">
        <input
          ref={inputRef}
          type="text"
          className="form-control rounded-3"
          placeholder={placeholder || "Buscar para agregar..."}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            updateDropdownRect();
            setFocused(true);
          }}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
        />
        {focused &&
          suggestions.length > 0 &&
          dropdownRect &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              className="bg-white border rounded-3 shadow-sm"
              style={{
                position: "fixed",
                top: dropdownRect.top,
                left: dropdownRect.left,
                width: dropdownRect.width,
                zIndex: 1100,
                maxHeight: "min(50vh, 20rem)",
                overflowY: "auto",
              }}
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
            </div>,
            document.body,
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
