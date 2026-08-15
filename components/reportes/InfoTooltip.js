"use client";

import { useEffect, useRef, useState } from "react";
import { FiInfo } from "react-icons/fi";

// Icono de información al lado de un título de gráfico — al hacer clic
// muestra un popover con la fórmula/criterio de cálculo. Se cierra al
// hacer clic afuera.
export default function InfoTooltip({ texto }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onClickFuera(e) {
      if (ref.current && !ref.current.contains(e.target)) setAbierto(false);
    }
    document.addEventListener("mousedown", onClickFuera);
    return () => document.removeEventListener("mousedown", onClickFuera);
  }, []);

  return (
    <span className="position-relative d-inline-block" ref={ref}>
      <button
        type="button"
        className="btn btn-sm p-0 border-0 text-secondary d-inline-flex align-items-center"
        style={{ fontSize: "0.85rem", lineHeight: 1 }}
        onClick={() => setAbierto((v) => !v)}
        title="Cómo se calcula"
      >
        <FiInfo />
      </button>
      {abierto && (
        <div
          className="card border-0 shadow-lg rounded-3 p-3 position-absolute text-secondary"
          style={{ top: "1.5rem", left: 0, width: "22rem", maxWidth: "80vw", zIndex: 20, fontSize: "0.8rem" }}
        >
          {texto}
        </div>
      )}
    </span>
  );
}
