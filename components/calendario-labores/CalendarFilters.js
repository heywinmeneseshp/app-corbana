"use client";

import ModalShell from "@/components/ModalShell";

const ESTADOS = [
  { value: "TODAS", label: "Todas" },
  { value: "VENCIDA", label: "Vencidas" },
  { value: "PROGRAMADA", label: "Pendientes" },
  { value: "COMPLETADA", label: "Completadas" },
  { value: "CANCELADA", label: "Canceladas" },
];

function nombreCompleto(u) {
  return `${u.nombre} ${u.apellido}`.trim();
}

function toggleEnArreglo(arreglo, uuid) {
  return arreglo.includes(uuid) ? arreglo.filter((u) => u !== uuid) : [...arreglo, uuid];
}

function Checklist({ titulo, items, seleccionados, onToggle, getLabel = (i) => i.nombre }) {
  if (items.length === 0) return null;
  return (
    <div className="mb-3">
      <label className="form-label small fw-medium d-block">{titulo}</label>
      <div className="border rounded-3 p-2" style={{ maxHeight: 150, overflowY: "auto" }}>
        {items.map((item) => (
          <div className="form-check" key={item.uuid}>
            <input
              type="checkbox"
              className="form-check-input"
              id={`filtro-${titulo}-${item.uuid}`}
              checked={seleccionados.includes(item.uuid)}
              onChange={() => onToggle(item.uuid)}
            />
            <label className="form-check-label small" htmlFor={`filtro-${titulo}-${item.uuid}`}>
              {getLabel(item)}
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}

export const FILTROS_VACIOS = {
  loteUuids: [],
  categoriaUuids: [],
  laborUuids: [],
  responsableUuids: [],
  estado: "TODAS",
};

export function contarFiltrosActivos(filtros) {
  return (
    filtros.loteUuids.length +
    filtros.categoriaUuids.length +
    filtros.laborUuids.length +
    filtros.responsableUuids.length +
    (filtros.estado !== "TODAS" ? 1 : 0)
  );
}

export default function CalendarFilters({ lotes, categorias, labores, usuarios, filtros, onChange, onClose }) {
  return (
    <ModalShell title="Filtros" onClose={onClose}>
      <Checklist
        titulo="Lote"
        items={lotes}
        seleccionados={filtros.loteUuids}
        onToggle={(uuid) => onChange({ ...filtros, loteUuids: toggleEnArreglo(filtros.loteUuids, uuid) })}
      />
      <Checklist
        titulo="Categoría"
        items={categorias}
        seleccionados={filtros.categoriaUuids}
        onToggle={(uuid) => onChange({ ...filtros, categoriaUuids: toggleEnArreglo(filtros.categoriaUuids, uuid) })}
      />
      <Checklist
        titulo="Labor"
        items={labores}
        seleccionados={filtros.laborUuids}
        onToggle={(uuid) => onChange({ ...filtros, laborUuids: toggleEnArreglo(filtros.laborUuids, uuid) })}
      />
      {usuarios.length > 0 && (
        <Checklist
          titulo="Responsable"
          items={usuarios}
          seleccionados={filtros.responsableUuids}
          getLabel={nombreCompleto}
          onToggle={(uuid) => onChange({ ...filtros, responsableUuids: toggleEnArreglo(filtros.responsableUuids, uuid) })}
        />
      )}

      <div className="mb-3">
        <label className="form-label small fw-medium d-block">Estado</label>
        <div className="d-flex flex-column gap-1">
          {ESTADOS.map((e) => (
            <div className="form-check" key={e.value}>
              <input
                type="radio"
                className="form-check-input"
                id={`filtro-estado-${e.value}`}
                checked={filtros.estado === e.value}
                onChange={() => onChange({ ...filtros, estado: e.value })}
              />
              <label className="form-check-label small" htmlFor={`filtro-estado-${e.value}`}>
                {e.label}
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="d-flex justify-content-between gap-2">
        <button type="button" className="btn btn-outline-secondary rounded-3" onClick={() => onChange(FILTROS_VACIOS)}>
          Limpiar filtros
        </button>
        <button type="button" className="btn btn-brand rounded-3" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </ModalShell>
  );
}
