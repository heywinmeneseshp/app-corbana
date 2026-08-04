"use client";

import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

// Navegación de año: <  2026  > — controlado por el padre.
export default function CalendarNavigation({ anio, onPrev, onNext }) {
  return (
    <div className="d-flex align-items-center gap-1">
      <button type="button" className="btn btn-outline-secondary rounded-3" aria-label="Año anterior" onClick={onPrev}>
        <FiChevronLeft />
      </button>
      <span className="fw-semibold px-2" style={{ minWidth: 48, textAlign: "center" }}>
        {anio}
      </span>
      <button type="button" className="btn btn-outline-secondary rounded-3" aria-label="Año siguiente" onClick={onNext}>
        <FiChevronRight />
      </button>
    </div>
  );
}
