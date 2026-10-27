"use client";

import { useEffect, useRef, useState } from "react";
import { FiInfo } from "react-icons/fi";

// Icono de información al lado de un título de gráfico — al hacer clic
// muestra un popover con la fórmula/criterio de cálculo. Se cierra al
// hacer clic afuera. `fijo`: el popover flota sobre la página (para usarlo dentro de tablas, que recortan lo que se sale).
export default function InfoTooltip({ texto, fijo = false, titulo = "Cómo se calcula" }) {
  const [abierto, setAbierto] = useState(false);
  const [pos, setPos] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    function onClickFuera(e) {
      if (ref.current && !ref.current.contains(e.target)) setAbierto(false);
    }
    const cerrar = () => setAbierto(false);
    document.addEventListener("mousedown", onClickFuera);
    if (fijo) window.addEventListener("scroll", cerrar, true);
    return () => {
      document.removeEventListener("mousedown", onClickFuera);
      window.removeEventListener("scroll", cerrar, true);
    };
  }, [fijo]);

  return (
    <span className="position-relative d-inline-block" ref={ref}>
      <button
        type="button"
        className="btn btn-sm p-0 border-0 text-secondary d-inline-flex align-items-center"
        style={{ fontSize: "0.85rem", lineHeight: 1 }}
        onClick={(e) => {
          if (fijo) {
            const r = e.currentTarget.getBoundingClientRect();
            setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left - 160, window.innerWidth - 360)) });
          }
          setAbierto((v) => !v);
        }}
        title={titulo}
      >
        <FiInfo />
      </button>
      {abierto && (
        <div
          className={`card border-0 shadow-lg rounded-3 p-3 text-secondary fw-normal text-start ${fijo ? "position-fixed" : "position-absolute"}`}
          style={{
            ...(fijo && pos ? { top: pos.top, left: pos.left } : { top: "1.5rem", left: 0 }),
            width: "22rem",
            maxWidth: "80vw",
            zIndex: 1050,
            fontSize: "0.8rem",
            whiteSpace: "normal",
          }}
        >
          {texto}
        </div>
      )}
    </span>
  );
}
