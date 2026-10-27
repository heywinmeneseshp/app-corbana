"use client";

// Tarjeta con un encabezado clicable que colapsa/expande su contenido —
// para gráficos, tablas o barras que ocupan mucho espacio vertical y no
// siempre hace falta tenerlos abiertos todos a la vez.
// Con `expandible`, además muestra un botón para ver el contenido a pantalla
// completa (Esc o el botón de cerrar lo devuelven a su lugar); las gráficas
// de recharts dentro de la tarjeta crecen hasta ocupar el alto de la pantalla
// (ver .grafico-expandido en globals.css).
import { useEffect, useState } from "react";
import { FiChevronDown, FiChevronUp, FiMaximize2, FiMinimize2 } from "react-icons/fi";

export default function CollapsibleCard({ titulo, subtitulo, defaultAbierto = true, expandible = false, colapsable = true, info = null, acciones = null, filtrosExpandido = null, className = "", children }) {
  const [abierto, setAbierto] = useState(defaultAbierto);
  const [pantallaCompleta, setPantallaCompleta] = useState(false);

  useEffect(() => {
    if (!pantallaCompleta) return;
    const onKey = (e) => e.key === "Escape" && setPantallaCompleta(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pantallaCompleta]);

  if (pantallaCompleta) {
    return (
      <div className="position-fixed top-0 start-0 w-100 h-100 bg-white p-4 overflow-auto grafico-expandido" style={{ zIndex: 1060 }}>
        <div className="d-flex align-items-start justify-content-between mb-3">
          <div>
            <span className="d-flex align-items-center gap-2">
              <h2 className="h6 fw-bold mb-1">{titulo}</h2>
              {info}
            </span>
            {subtitulo && <p className="text-secondary small mb-0">{subtitulo}</p>}
          </div>
          <button type="button" className="btn btn-light btn-sm border-0 rounded-3" onClick={() => setPantallaCompleta(false)} title="Salir de pantalla completa (Esc)">
            <FiMinimize2 />
          </button>
        </div>
        {filtrosExpandido}
        {children}
      </div>
    );
  }

  // Variante sin colapsar: encabezado fijo con título, info, acciones y el
  // botón de pantalla completa.
  if (!colapsable) {
    return (
      <div className={`card border-0 shadow-sm rounded-4 p-3 ${className}`}>
        <div className="d-flex align-items-start justify-content-between gap-2">
          <div>
            <span className="d-flex align-items-center gap-2">
              <h2 className="h6 fw-bold mb-1">{titulo}</h2>
              {info}
            </span>
            {subtitulo && <p className="text-secondary small mb-0">{subtitulo}</p>}
          </div>
          <div className="d-flex align-items-center gap-2 flex-shrink-0">
            {acciones}
            {expandible && (
              <button type="button" className="btn btn-link btn-sm p-0 text-secondary" onClick={() => setPantallaCompleta(true)} title="Ver en pantalla completa">
                <FiMaximize2 />
              </button>
            )}
          </div>
        </div>
        <div className="mt-2">{children}</div>
      </div>
    );
  }

  return (
    <div className={`card border-0 shadow-sm rounded-4 p-3 position-relative ${className}`}>
      <button
        type="button"
        className="btn p-0 border-0 w-100 d-flex align-items-start justify-content-between text-start bg-transparent"
        style={{ paddingRight: acciones ? "6rem" : "4rem" }}
        onClick={() => setAbierto((v) => !v)}
      >
        <div>
          <h2 className="h6 fw-bold mb-1">{titulo}</h2>
          {subtitulo && <p className="text-secondary small mb-0">{subtitulo}</p>}
        </div>
      </button>
      {/* Acciones, pantalla completa y la flecha de plegar en una sola fila, alineadas entre sí. */}
      <div className="position-absolute d-flex align-items-center gap-3" style={{ top: "1rem", right: "1rem", lineHeight: 1 }}>
        {abierto && acciones}
        {abierto && expandible && (
          <button type="button" className="btn btn-link btn-sm p-0 text-secondary d-flex" onClick={() => setPantallaCompleta(true)} title="Ver en pantalla completa">
            <FiMaximize2 />
          </button>
        )}
        <button type="button" className="btn btn-link btn-sm p-0 text-secondary d-flex" onClick={() => setAbierto((v) => !v)} title={abierto ? "Plegar" : "Desplegar"}>
          {abierto ? <FiChevronUp /> : <FiChevronDown />}
        </button>
      </div>
      {abierto && <div className={subtitulo || titulo ? "mt-3" : ""}>{children}</div>}
    </div>
  );
}
