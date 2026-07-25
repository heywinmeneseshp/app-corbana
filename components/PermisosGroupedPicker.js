"use client";

import { useMemo, useState } from "react";

// Agrupa los permisos por módulo conceptual (no por el prefijo literal del
// código) — así "Racimos" incluye motivo_repique/motivo_recuse aunque su
// código no contenga la palabra "racimo". Evita el error típico de asignar
// racimo_movimiento.* y olvidarse de los motivos, que son del mismo módulo
// mental pero un código distinto.
const GRUPOS = [
  { titulo: "Seguridad", prefijos: ["usuarios.", "roles.", "permisos.", "menu."] },
  { titulo: "Fincas y Lotes", prefijos: ["finca.", "lote.", "planta.", "categoria_planta."] },
  {
    titulo: "Evaluaciones",
    prefijos: ["tipo_evaluacion.", "semana.", "evaluacion.", "infeccion.", "conteo_hojas.", "suma_bruta."],
  },
  { titulo: "Racimos", prefijos: ["motivo_repique.", "motivo_recuse.", "racimo_movimiento."] },
  { titulo: "Producción", prefijos: ["produccion."] },
  { titulo: "Sistema", prefijos: ["sistema."] },
];

const grupoDe = (codigo) => GRUPOS.find((g) => g.prefijos.some((p) => codigo?.startsWith(p)))?.titulo || "Otros";

/**
 * Selector de permisos agrupado por módulo, con un checkbox "Seleccionar
 * todo" por grupo — pensado específicamente para la pantalla de Roles.
 * `items` / `selected`: arreglos de { uuid, label, sublabel }, igual que
 * TagPicker (mismo contrato), para no tocar la lógica de guardado.
 */
export default function PermisosGroupedPicker({ items, selected, onChange }) {
  const [query, setQuery] = useState("");

  const selectedUuids = useMemo(() => new Set(selected.map((s) => s.uuid)), [selected]);

  const grupos = useMemo(() => {
    const q = query.trim().toLowerCase();
    const porGrupo = new Map();
    for (const item of items) {
      if (q && !item.label.toLowerCase().includes(q) && !item.sublabel?.toLowerCase().includes(q)) continue;
      const titulo = grupoDe(item.sublabel);
      if (!porGrupo.has(titulo)) porGrupo.set(titulo, []);
      porGrupo.get(titulo).push(item);
    }
    const orden = [...GRUPOS.map((g) => g.titulo), "Otros"];
    return orden.filter((t) => porGrupo.has(t)).map((titulo) => ({ titulo, items: porGrupo.get(titulo) }));
  }, [items, query]);

  const toggleUno = (item) => {
    if (selectedUuids.has(item.uuid)) {
      onChange(selected.filter((s) => s.uuid !== item.uuid));
    } else {
      onChange([...selected, item]);
    }
  };

  const toggleGrupo = (itemsDelGrupo, marcarTodos) => {
    if (marcarTodos) {
      const nuevos = itemsDelGrupo.filter((i) => !selectedUuids.has(i.uuid));
      onChange([...selected, ...nuevos]);
    } else {
      const idsDelGrupo = new Set(itemsDelGrupo.map((i) => i.uuid));
      onChange(selected.filter((s) => !idsDelGrupo.has(s.uuid)));
    }
  };

  return (
    <div>
      <input
        type="text"
        className="form-control rounded-3 mb-2"
        placeholder="Filtrar por nombre o código (ej: finca, ver, crear...)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="border rounded-3 p-2" style={{ maxHeight: "22rem", overflowY: "auto" }}>
        {grupos.length === 0 && <p className="text-secondary small text-center py-3 mb-0">Sin resultados.</p>}
        {grupos.map(({ titulo, items: itemsDelGrupo }) => {
          const todosSeleccionados = itemsDelGrupo.every((i) => selectedUuids.has(i.uuid));
          const algunoSeleccionado = itemsDelGrupo.some((i) => selectedUuids.has(i.uuid));
          return (
            <div key={titulo} className="mb-3">
              <div className="d-flex align-items-center justify-content-between border-bottom pb-1 mb-2">
                <span className="fw-semibold small">{titulo}</span>
                <label className="small d-flex align-items-center gap-2 text-secondary" style={{ cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    className="form-check-input m-0"
                    checked={todosSeleccionados}
                    ref={(el) => el && (el.indeterminate = !todosSeleccionados && algunoSeleccionado)}
                    onChange={(e) => toggleGrupo(itemsDelGrupo, e.target.checked)}
                  />
                  Seleccionar todo
                </label>
              </div>
              <div className="row g-1">
                {itemsDelGrupo.map((item) => (
                  <div className="col-6" key={item.uuid}>
                    <label className="d-flex align-items-start gap-2 small py-1" style={{ cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        className="form-check-input m-0 mt-1"
                        checked={selectedUuids.has(item.uuid)}
                        onChange={() => toggleUno(item)}
                      />
                      <span>
                        {item.label}
                        <br />
                        <span className="text-secondary" style={{ fontSize: "0.7rem" }}>
                          {item.sublabel}
                        </span>
                      </span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="small text-secondary mt-2 mb-0">{selected.length} permiso(s) seleccionado(s) en total.</p>
    </div>
  );
}
