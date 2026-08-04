"use client";

import { LABOR_ICONS } from "@/lib/laborIcons";

// Grilla de selección de icono (14-16px) para el maestro de Labores y el
// modal rápido de creación de labor — una sola responsabilidad: mostrar la
// paleta y avisar cuál quedó elegido.
export default function IconPicker({ value, onChange }) {
  return (
    <div className="d-flex flex-wrap gap-2">
      {LABOR_ICONS.map(({ key, Icon, label }) => {
        const selected = value === key;
        return (
          <button
            key={key}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={selected}
            className={`btn btn-sm d-flex align-items-center justify-content-center rounded-3 ${
              selected ? "btn-brand" : "btn-outline-secondary"
            }`}
            style={{ width: 34, height: 34, padding: 0 }}
            onClick={() => onChange(key)}
          >
            <Icon size={16} />
          </button>
        );
      })}
    </div>
  );
}
