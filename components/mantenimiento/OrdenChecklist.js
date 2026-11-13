"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FiCheck, FiCheckCircle } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import { hasPermission } from "@/lib/auth";

export const CALIFICACIONES = [
  { value: "SATISFACTORIO", label: "Satisfactorio", color: "#15803d", bg: "#dcfce7" },
  { value: "OBSERVACION", label: "Observación", color: "#b45309", bg: "#fef3c7" },
  { value: "INSATISFACTORIO", label: "Insatisfactorio", color: "#b91c1c", bg: "#fee2e2" },
  { value: "NA", label: "N/A", color: "#64748b", bg: "#f1f5f9" },
  { value: "PENDIENTE", label: "Pendiente", color: "#475569", bg: "#f8fafc" },
];
const porValor = Object.fromEntries(CALIFICACIONES.map((c) => [c.value, c]));

// Checklist de una orden de mantenimiento: cada ítem se califica (Satisfactorio, Observación, Insatisfactorio, N/A, Pendiente) con su observación. Lo que
// queda en Observación o Insatisfactorio genera un hallazgo (pestaña Hallazgos). Si la orden no tiene checklist, se copia de la plantilla del plan o de la
// que se elija.
export default function OrdenChecklist({ ordenUuid, cerrada, onCambio }) {
  const [datos, setDatos] = useState(null);
  const [cambios, setCambios] = useState({}); // uuid -> { calificacion?, observaciones? }
  const [plantillas, setPlantillas] = useState([]);
  const [plantillaUuid, setPlantillaUuid] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const puedeEditar = hasPermission("inventario.ordenes.editar") && !cerrada;

  const cargar = useCallback(async () => {
    try {
      setDatos(await apiFetch(`/inventarios/ordenes-mantenimiento/${ordenUuid}/checklist`));
    } catch (err) {
      setError(err.message);
    }
  }, [ordenUuid]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
  }, [cargar]);

  useEffect(() => {
    if (datos && datos.total === 0) apiFetch("/inventarios/checklist-plantillas").then((l) => setPlantillas((l || []).filter((p) => p.estado))).catch(() => {});
  }, [datos]);

  const secciones = useMemo(() => {
    const mapa = new Map();
    for (const it of datos?.items || []) {
      if (!mapa.has(it.seccion)) mapa.set(it.seccion, []);
      mapa.get(it.seccion).push(it);
    }
    return [...mapa.entries()];
  }, [datos]);

  const valorDe = (it) => ({ calificacion: cambios[it.uuid]?.calificacion ?? it.calificacion, observaciones: cambios[it.uuid]?.observaciones ?? it.observaciones ?? "" });
  const cambiar = (it, patch) => setCambios((c) => ({ ...c, [it.uuid]: { ...c[it.uuid], ...patch } }));
  const pendientesDeGuardar = Object.keys(cambios).length;

  async function generar() {
    setError("");
    try {
      setDatos(await apiFetch(`/inventarios/ordenes-mantenimiento/${ordenUuid}/checklist/generar`, { method: "POST", body: JSON.stringify(plantillaUuid ? { plantillaUuid } : {}) }));
      onCambio?.();
    } catch (err) {
      setError(err.message);
    }
  }

  async function guardar() {
    setError("");
    setGuardando(true);
    try {
      const items = Object.entries(cambios).map(([uuid, c]) => ({ uuid, ...c }));
      setDatos(await apiFetch(`/inventarios/ordenes-mantenimiento/${ordenUuid}/checklist`, { method: "PUT", body: JSON.stringify({ items }) }));
      setCambios({});
      onCambio?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  // Marca como Satisfactorio todo lo que siga Pendiente en una sección.
  const sectionSatisfactoria = (lista) => lista.filter((it) => valorDe(it).calificacion === "PENDIENTE").forEach((it) => cambiar(it, { calificacion: "SATISFACTORIO" }));

  if (!datos) return error ? <div className="alert alert-danger py-2 small">{error}</div> : <p className="small text-secondary">Cargando...</p>;

  if (datos.total === 0) {
    return (
      <div className="border rounded-1 p-3" style={{ background: "#f8faf9" }}>
        {error && <div className="alert alert-danger py-2 small">{error}</div>}
        <p className="small mb-2">Esta orden no tiene checklist. Se copia de una plantilla (la del plan de la orden o la que elijas) y después se califica ítem por ítem.</p>
        {puedeEditar ? (
          <div className="d-flex flex-wrap gap-2 align-items-center">
            <select className="form-select form-select-sm rounded-1" style={{ maxWidth: "26rem" }} value={plantillaUuid} onChange={(e) => setPlantillaUuid(e.target.value)}>
              <option value="">La plantilla del plan de la orden</option>
              {plantillas.map((p) => (
                <option key={p.uuid} value={p.uuid}>
                  {p.nombre} ({p.totalItems} ítems)
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-brand btn-sm rounded-1" onClick={generar}>
              Generar checklist
            </button>
          </div>
        ) : (
          <p className="small text-secondary mb-0">No hay checklist en esta orden.</p>
        )}
      </div>
    );
  }

  return (
    <div>
      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
        {CALIFICACIONES.map((c) => (
          <span key={c.value} className="badge rounded-1 fw-normal" style={{ background: c.bg, color: c.color }}>
            {c.label}: {datos.resumen[c.value] || 0}
          </span>
        ))}
        <span className="small text-secondary">de {datos.total} ítems</span>
        {puedeEditar && (
          <button type="button" className="btn btn-brand btn-sm rounded-1 ms-auto d-inline-flex align-items-center gap-1" disabled={pendientesDeGuardar === 0 || guardando} onClick={guardar}>
            <FiCheck /> {guardando ? "Guardando..." : `Guardar checklist${pendientesDeGuardar ? ` (${pendientesDeGuardar})` : ""}`}
          </button>
        )}
      </div>
      {cerrada && <div className="alert alert-secondary py-1 small">La orden está cerrada: el checklist es de solo lectura.</div>}

      {secciones.map(([seccion, lista], si) => (
        <div key={seccion} className="border rounded-1 mb-2">
          <div className="d-flex align-items-center justify-content-between px-2 py-1" style={{ background: "#166534", color: "#fff" }}>
            <span className="fw-semibold small">
              {si + 1}. {seccion}
            </span>
            {puedeEditar && (
              <button type="button" className="btn btn-link btn-sm p-0 text-white" style={{ fontSize: "0.75rem" }} onClick={() => sectionSatisfactoria(lista)} title="Marca como Satisfactorio lo que siga Pendiente en esta sección">
                <FiCheckCircle /> Pendientes → satisfactorio
              </button>
            )}
          </div>
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0 small">
              <tbody>
                {lista.map((it) => {
                  const v = valorDe(it);
                  const c = porValor[v.calificacion];
                  return (
                    <tr key={it.uuid} style={cambios[it.uuid] ? { background: "#fffbeb" } : undefined}>
                      <td style={{ width: "42%" }}>{it.descripcion}</td>
                      <td style={{ width: "11rem" }}>
                        <select
                          className="form-select form-select-sm rounded-1"
                          style={{ background: c.bg, color: c.color, fontWeight: 600 }}
                          disabled={!puedeEditar}
                          value={v.calificacion}
                          onChange={(e) => cambiar(it, { calificacion: e.target.value })}
                        >
                          {CALIFICACIONES.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          className="form-control form-control-sm rounded-1"
                          disabled={!puedeEditar}
                          maxLength={3000}
                          placeholder={["OBSERVACION", "INSATISFACTORIO"].includes(v.calificacion) ? "Describe lo encontrado" : "Observaciones / evidencia"}
                          value={v.observaciones}
                          onChange={(e) => cambiar(it, { observaciones: e.target.value })}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
