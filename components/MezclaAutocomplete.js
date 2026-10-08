"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// Input con sugerencias tipo datalist para elegir una mezcla: a medida que se
// escribe se filtran por nombre/código y SIEMPRE se ordenan con la usada más
// recientemente primero (`ultimoUsoEn`; las nunca usadas van al final, por
// nombre). Se confirma con clic, con Enter (toma la sugerida resaltada) o
// escribiendo el nombre/código exacto y saliendo del campo.
const etiqueta = (m) => `${m.nombre || m.codigo}`;
const detalle = (m) => {
  const dosis = m.dosisPorHectarea != null ? Number(m.dosisPorHectarea).toFixed(2) : null;
  const unidad = m.dosisPorHectareaUnidad?.simbolo || m.unidadRendimiento?.simbolo || "";
  return dosis ? `${dosis} ${unidad}/ha` : "";
};

export default function MezclaAutocomplete({ mezclas, value, onChange, placeholder = "Escribe para buscar...", required = false, limit = 30 }) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [activo, setActivo] = useState(0);
  const ref = useRef(null);

  const porUuid = useMemo(() => Object.fromEntries(mezclas.map((m) => [m.uuid, m])), [mezclas]);

  // Recientes primero; las que nunca se usaron, alfabéticas al final.
  const ordenadas = useMemo(() => {
    const t = (m) => (m.ultimoUsoEn ? new Date(m.ultimoUsoEn).getTime() : -1);
    return [...mezclas].sort((a, b) => t(b) - t(a) || etiqueta(a).localeCompare(etiqueta(b), "es"));
  }, [mezclas]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const m = value ? porUuid[value] : null;
    setText(m ? etiqueta(m) : "");
  }, [value, porUuid]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const sugeridas = useMemo(() => {
    const palabras = text.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const seleccionada = value ? porUuid[value] : null;
    // Con una mezcla ya elegida y el texto intacto se muestran todas, no solo la elegida.
    if (!palabras.length || (seleccionada && text === etiqueta(seleccionada))) return ordenadas.slice(0, limit);
    return ordenadas.filter((m) => palabras.every((p) => `${m.nombre || ""} ${m.codigo || ""}`.toLowerCase().includes(p))).slice(0, limit);
  }, [ordenadas, text, value, porUuid, limit]);

  useEffect(() => {
    function fuera(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);

  function elegir(m) {
    setText(etiqueta(m));
    setOpen(false);
    if (m.uuid !== value) onChange(m.uuid);
  }

  // Al salir del campo: coincide exacto con una mezcla → se toma; si no, se revierte
  // a la elegida (no queda texto que parezca aplicado sin estarlo).
  function confirmarTexto() {
    const q = text.trim().toLowerCase();
    if (!q) {
      if (value) onChange("");
      return;
    }
    const exacta = mezclas.find((m) => etiqueta(m).toLowerCase() === q || (m.codigo || "").toLowerCase() === q);
    if (exacta) {
      if (exacta.uuid !== value) onChange(exacta.uuid);
      setText(etiqueta(exacta));
    } else {
      const actual = value ? porUuid[value] : null;
      setText(actual ? etiqueta(actual) : "");
    }
  }

  function teclado(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActivo((i) => Math.min(i + 1, sugeridas.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActivo((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (open && sugeridas[activo]) {
        e.preventDefault();
        elegir(sugeridas[activo]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={ref} className="position-relative">
      <input
        type="text"
        className="form-control form-control-sm rounded-3"
        placeholder={placeholder}
        required={required && !value}
        autoComplete="off"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setActivo(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => confirmarTexto(), 150)}
        onKeyDown={teclado}
      />
      {open && (
        <ul
          className="list-group position-absolute w-100 shadow-sm"
          style={{ zIndex: 1055, maxHeight: "16rem", overflowY: "auto", top: "100%", marginTop: 2 }}
        >
          {sugeridas.length === 0 && <li className="list-group-item small text-secondary py-1">Sin coincidencias</li>}
          {sugeridas.map((m, i) => (
            <li
              key={m.uuid}
              className={`list-group-item list-group-item-action small py-1 px-2 d-flex justify-content-between gap-2 ${i === activo ? "active" : ""}`}
              style={{ cursor: "pointer" }}
              onMouseDown={(e) => {
                e.preventDefault();
                elegir(m);
              }}
              onMouseEnter={() => setActivo(i)}
            >
              <span>{etiqueta(m)}</span>
              <span className={i === activo ? "" : "text-secondary"} style={{ whiteSpace: "nowrap" }}>
                {i === 0 && m.ultimoUsoEn && !text.trim() ? "★ " : ""}
                {detalle(m)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
