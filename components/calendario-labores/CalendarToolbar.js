"use client";

import { FiPlus, FiFilter } from "react-icons/fi";
import CalendarNavigation from "./CalendarNavigation";

// Fila superior del calendario: finca, año, "Nueva labor" y "Filtros". Sin
// fetch propio — todo llega por props, el padre decide qué hacer.
export default function CalendarToolbar({
  fincas,
  fincaUuid,
  onFincaChange,
  anio,
  onAnioChange,
  onNuevaLabor,
  puedeCrear,
  onAbrirFiltros,
  filtrosActivos,
}) {
  return (
    <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
      <div className="d-flex flex-wrap align-items-center gap-2">
        <select
          className="form-select rounded-3"
          style={{ minWidth: 220 }}
          value={fincaUuid}
          onChange={(e) => onFincaChange(e.target.value)}
        >
          {fincas.map((f) => (
            <option key={f.uuid} value={f.uuid}>
              {f.nombre}
            </option>
          ))}
        </select>
        <CalendarNavigation anio={anio} onPrev={() => onAnioChange(anio - 1)} onNext={() => onAnioChange(anio + 1)} />
      </div>

      <div className="d-flex align-items-center gap-2">
        <button type="button" className="btn btn-outline-secondary rounded-3 d-flex align-items-center gap-2" onClick={onAbrirFiltros}>
          <FiFilter /> Filtros
          {filtrosActivos > 0 && <span className="badge rounded-pill bg-brand">{filtrosActivos}</span>}
        </button>
        {puedeCrear && (
          <button type="button" className="btn btn-brand rounded-3 d-flex align-items-center gap-2" onClick={onNuevaLabor}>
            <FiPlus /> Nueva labor
          </button>
        )}
      </div>
    </div>
  );
}
