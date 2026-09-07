"use client";

// Tarjeta con un encabezado clicable que colapsa/expande su contenido —
// para gráficos, tablas o barras que ocupan mucho espacio vertical y no
// siempre hace falta tenerlos abiertos todos a la vez.
import { useState } from "react";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";

export default function CollapsibleCard({ titulo, subtitulo, defaultAbierto = true, className = "", children }) {
  const [abierto, setAbierto] = useState(defaultAbierto);

  return (
    <div className={`card border-0 shadow-sm rounded-4 p-3 ${className}`}>
      <button
        type="button"
        className="btn p-0 border-0 w-100 d-flex align-items-start justify-content-between text-start bg-transparent"
        onClick={() => setAbierto((v) => !v)}
      >
        <div>
          <h2 className="h6 fw-bold mb-1">{titulo}</h2>
          {subtitulo && <p className="text-secondary small mb-0">{subtitulo}</p>}
        </div>
        <span className="text-secondary flex-shrink-0 ms-2" style={{ marginTop: "0.1rem" }}>
          {abierto ? <FiChevronUp /> : <FiChevronDown />}
        </span>
      </button>
      {abierto && <div className={subtitulo || titulo ? "mt-3" : ""}>{children}</div>}
    </div>
  );
}
