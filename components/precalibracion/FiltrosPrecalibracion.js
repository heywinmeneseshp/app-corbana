"use client";

import { useState } from "react";
import { FiCheck, FiX } from "react-icons/fi";
import { getOpcionesFiltros } from "@/lib/precalibracion/api";

export const FILTROS_VACIOS = { semanaId: "", fincaId: "", valorId: "" };

// Barra de filtros con estado borrador: "Aplicar filtros" confirma,
// "Limpiar filtros" resetea. El padre pasa key={JSON.stringify(aplicados)}
// para reiniciar el borrador al limpiar (sin efectos de sincronización).
export default function FiltrosPrecalibracion({ aplicados, onAplicar, onLimpiar }) {
  const [borrador, setBorrador] = useState(aplicados);
  const opciones = getOpcionesFiltros();

  function cambiar(campo, valor) {
    setBorrador((prev) => ({ ...prev, [campo]: valor }));
  }

  const hayFiltros = Object.values(borrador).some((v) => v !== "");

  return (
    <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
      <div className="row g-2 align-items-end">
        <div className="col-6 col-md-3">
          <label className="form-label small fw-medium">Semana</label>
          <select className="form-select form-select-sm rounded-3" value={borrador.semanaId} onChange={(e) => cambiar("semanaId", e.target.value)}>
            <option value="">Todas</option>
            {opciones.semanas.map((s) => (
              <option key={s.id} value={s.id}>
                {s.numero}
              </option>
            ))}
          </select>
        </div>
        <div className="col-6 col-md-3">
          <label className="form-label small fw-medium">Finca</label>
          <select className="form-select form-select-sm rounded-3" value={borrador.fincaId} onChange={(e) => cambiar("fincaId", e.target.value)}>
            <option value="">Todas</option>
            {opciones.fincas.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="col-6 col-md-3">
          <label className="form-label small fw-medium">Valor de precalibración</label>
          <select className="form-select form-select-sm rounded-3" value={borrador.valorId} onChange={(e) => cambiar("valorId", e.target.value)}>
            <option value="">Todos</option>
            {opciones.valores.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="col-6 col-md-2 d-grid">
          <button type="button" className="btn btn-brand btn-sm rounded-3 d-flex align-items-center justify-content-center gap-1" onClick={() => onAplicar(borrador)}>
            <FiCheck /> Aplicar
          </button>
        </div>
        <div className="col-12 col-md-1 d-grid">
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm rounded-3 d-flex align-items-center justify-content-center gap-1"
            disabled={!hayFiltros}
            onClick={onLimpiar}
            title="Limpiar filtros"
          >
            <FiX /> Limpiar
          </button>
        </div>
      </div>
    </div>
  );
}
