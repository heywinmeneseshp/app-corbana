"use client";

// Selector de año(s) — checklist desplegable (mismo mecanismo que
// SelectorObjetivos), no chips: los chips ocupaban demasiado ancho al lado
// del selector de fincas/grupos en la fila de una canasta, y quedaban
// "pegados" contra los demás filtros de la página.
import { useMemo, useRef, useState } from "react";
import { FiChevronDown, FiCheck } from "react-icons/fi";

export default function SelectorAnios({ anios, seleccionados, onChange, sinEtiqueta = false }) {
  const [abierto, setAbierto] = useState(false);
  const wrapRef = useRef(null);

  function toggle(anio) {
    onChange(seleccionados.includes(anio) ? seleccionados.filter((a) => a !== anio) : [...seleccionados, anio]);
  }

  function cerrarSiClickAfuera(e) {
    if (wrapRef.current && !wrapRef.current.contains(e.target)) {
      setAbierto(false);
      document.removeEventListener("mousedown", cerrarSiClickAfuera);
    }
  }

  function abrir() {
    setAbierto(true);
    document.addEventListener("mousedown", cerrarSiClickAfuera);
  }

  const etiqueta = useMemo(() => {
    if (seleccionados.length === 0) return "Año actual";
    if (seleccionados.length === 1) return String(seleccionados[0]);
    return [...seleccionados].sort((a, b) => a - b).join(", ");
  }, [seleccionados]);

  return (
    <div className="position-relative" ref={wrapRef}>
      {!sinEtiqueta && <label className="form-label small fw-medium mb-1 d-block">Años</label>}
      <button
        type="button"
        className={`btn btn-outline-secondary btn-sm rounded-3 d-flex align-items-center gap-2 justify-content-between ${sinEtiqueta ? "w-100" : ""}`}
        style={{ minWidth: sinEtiqueta ? undefined : "9rem" }}
        onClick={() => (abierto ? setAbierto(false) : abrir())}
      >
        <span className="text-truncate">{etiqueta}</span>
        <FiChevronDown />
      </button>

      {abierto && (
        <div
          className="card border-0 shadow-lg rounded-3 p-2 position-absolute"
          style={{ top: "100%", left: 0, zIndex: 1060, minWidth: "8rem", maxHeight: "16rem", overflowY: "auto" }}
        >
          {[...anios].reverse().map((a) => {
            const checked = seleccionados.includes(a);
            return (
              <label key={a} className="d-flex align-items-center gap-2 px-1 py-1 rounded-2 opcion-fila" style={{ cursor: "pointer", fontSize: "0.8125rem" }}>
                <input type="checkbox" className="form-check-input m-0" checked={checked} onChange={() => toggle(a)} />
                <span className="flex-grow-1">{a}</span>
                {checked && <FiCheck className="text-success" />}
              </label>
            );
          })}
        </div>
      )}

      <style jsx>{`
        .opcion-fila:hover {
          background-color: #f1f5f9;
        }
      `}</style>
    </div>
  );
}
