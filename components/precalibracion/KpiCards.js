"use client";

import { FiGrid, FiMap, FiCheckCircle, FiSliders } from "react-icons/fi";

function Kpi({ icono: Icono, titulo, valor, subtitulo }) {
  return (
    <div className="col-6 col-lg-3">
      <div className="card border-0 shadow-sm rounded-4 p-3 h-100">
        <div className="d-flex align-items-center gap-2 text-secondary small mb-1">
          <Icono size={16} className="text-primary" />
          <span className="fw-medium">{titulo}</span>
        </div>
        <div className="h3 fw-bold mb-0">{valor}</div>
        {subtitulo && <div className="small text-secondary mt-1">{subtitulo}</div>}
      </div>
    </div>
  );
}

// Tarjetas de resumen: se recalculan con los filtros aplicados.
export default function KpiCards({ kpis }) {
  return (
    <div className="row g-3 mb-3">
      <Kpi icono={FiCheckCircle} titulo="Racimos registrados" valor={kpis.racimos.toLocaleString("es")} subtitulo="Cumplen con el calibrador" />
      <Kpi icono={FiGrid} titulo="Lotes evaluados" valor={kpis.lotesEvaluados.toLocaleString("es")} />
      <Kpi
        icono={FiMap}
        titulo="Hectáreas evaluadas"
        valor={`${kpis.hectareas.toLocaleString("es", { minimumFractionDigits: 2 })} ha`}
      />
      <Kpi
        icono={FiSliders}
        titulo="Valor de precalibración"
        valor={kpis.valor ? kpis.valor.nombre : "—"}
        subtitulo={kpis.valor ? "Predominante en la selección" : "Sin registros"}
      />
    </div>
  );
}
