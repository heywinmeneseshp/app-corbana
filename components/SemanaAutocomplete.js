"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// Input de texto con sugerencias tipo datalist: a medida que se escribe se
// filtran las semanas por código, y se puede confirmar tanto haciendo clic
// en una sugerencia como escribiendo el código exacto y saliendo del campo
// (blur o Enter) — no exige usar el mouse para elegir.
export default function SemanaAutocomplete({ semanas, value, onChange, placeholder = "Todas", width = "7rem", limit = 20 }) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const semanaMap = useMemo(() => {
    const m = {};
    for (const s of semanas) m[s.uuid] = s;
    return m;
  }, [semanas]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (value) {
      const s = semanaMap[value];
      if (s) setText(s.codigo);
    } else {
      setText("");
    }
  }, [value, semanaMap]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const filtered = useMemo(() => {
    if (!text) return semanas.slice(0, limit);
    const q = text.toLowerCase();
    return semanas.filter((s) => s.codigo.toLowerCase().includes(q)).slice(0, limit);
  }, [semanas, text, limit]);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Si el usuario escribe el código exacto de una semana (sin llegar a
  // hacer clic en la sugerencia) y sale del campo, se toma igual como
  // elegida — si no coincide con ninguna semana real, revierte al valor
  // vigente para no dejar texto que parezca aplicado sin estarlo.
  function confirmarTexto() {
    const q = text.trim().toLowerCase();
    if (!q) {
      if (value) onChange("");
      return;
    }
    const exacta = semanas.find((s) => s.codigo.toLowerCase() === q);
    if (exacta) {
      if (exacta.uuid !== value) onChange(exacta.uuid);
    } else {
      const actual = value ? semanaMap[value] : null;
      setText(actual ? actual.codigo : "");
    }
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input
        type="text"
        className="form-control form-control-sm rounded-3"
        style={{ width }}
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={confirmarTexto}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            confirmarTexto();
            setOpen(false);
            e.target.blur();
          }
        }}
      />
      {open && filtered.length > 0 && (
        <div
          style={{
            position: "absolute", top: "100%", left: 0, right: 0, zIndex: 1050,
            maxHeight: "300px", overflowY: "auto",
            background: "#fff", border: "1px solid #d1d5db",
            borderRadius: "0.5rem", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
          }}
        >
          {filtered.map((s) => (
            <div
              key={s.uuid}
              className="px-2 py-1 small"
              style={{ cursor: "pointer" }}
              onMouseDown={() => {
                onChange(s.uuid);
                setText(s.codigo);
                setOpen(false);
              }}
              onMouseOver={(e) => {
                e.target.style.background = "#f3f4f6";
              }}
              onMouseOut={(e) => {
                e.target.style.background = "";
              }}
            >
              {s.codigo}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
