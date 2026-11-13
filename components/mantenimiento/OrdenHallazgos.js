"use client";

import { useCallback, useEffect, useState } from "react";
import { FiCalendar, FiCheck, FiPlus, FiTrash2 } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import { CALIFICACIONES } from "@/components/mantenimiento/OrdenChecklist";

const ESTADOS = [
  { value: "ABIERTO", label: "Abierto" },
  { value: "EN_SEGUIMIENTO", label: "En seguimiento" },
  { value: "RESUELTO", label: "Resuelto" },
];
const PRIORIDADES = [
  { value: "BAJA", label: "Baja" },
  { value: "MEDIA", label: "Media" },
  { value: "ALTA", label: "Alta" },
  { value: "CRITICA", label: "Crítica" },
];
const hoy = () => new Date().toISOString().slice(0, 10);
const color = (cal) => CALIFICACIONES.find((c) => c.value === cal) || CALIFICACIONES[1];

// Hallazgos de una orden: lo encontrado, la acción ejecutada, el repuesto pendiente y la recomendación. Se crean solos al calificar un ítem como Observación o
// Insatisfactorio (pestaña Checklist) y siguen vivos aunque la orden se cierre, para darles seguimiento. «Programar corrección» los convierte en una programación.
export default function OrdenHallazgos({ ordenUuid, refrescar = 0 }) {
  const [hallazgos, setHallazgos] = useState(null);
  const [borradores, setBorradores] = useState({}); // uuid -> cambios sin guardar
  const [fechas, setFechas] = useState({}); // uuid -> fecha para programar
  const [nuevo, setNuevo] = useState(null);
  const [error, setError] = useState("");
  const puedeEditar = hasPermission("inventario.ordenes.editar");

  const cargar = useCallback(async () => {
    try {
      const r = await apiFetch(`/inventarios/ordenes-mantenimiento/${ordenUuid}/checklist`);
      setHallazgos(r.hallazgos || []);
    } catch (err) {
      setError(err.message);
    }
  }, [ordenUuid]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
  }, [cargar, refrescar]);

  const valor = (h, campo) => borradores[h.uuid]?.[campo] ?? h[campo] ?? "";
  const editar = (h, patch) => setBorradores((b) => ({ ...b, [h.uuid]: { ...b[h.uuid], ...patch } }));

  async function guardar(h) {
    setError("");
    try {
      const actualizado = await apiFetch(`/inventarios/ordenes-mantenimiento/hallazgos/${h.uuid}`, { method: "PUT", body: JSON.stringify(borradores[h.uuid]) });
      setHallazgos((lista) => lista.map((x) => (x.uuid === h.uuid ? { ...x, ...actualizado } : x)));
      setBorradores(({ [h.uuid]: _quitado, ...resto }) => resto);
    } catch (err) {
      setError(err.message);
    }
  }

  async function programar(h) {
    setError("");
    try {
      const actualizado = await apiFetch(`/inventarios/ordenes-mantenimiento/hallazgos/${h.uuid}/programar`, { method: "POST", body: JSON.stringify({ fecha: fechas[h.uuid] || hoy() }) });
      setHallazgos((lista) => lista.map((x) => (x.uuid === h.uuid ? { ...x, ...actualizado } : x)));
    } catch (err) {
      setError(err.message);
    }
  }

  async function eliminar(h) {
    if (!window.confirm("¿Eliminar este hallazgo?")) return;
    setError("");
    try {
      await apiFetch(`/inventarios/ordenes-mantenimiento/hallazgos/${h.uuid}`, { method: "DELETE" });
      setHallazgos((lista) => lista.filter((x) => x.uuid !== h.uuid));
    } catch (err) {
      setError(err.message);
    }
  }

  async function crear() {
    setError("");
    if (!nuevo.descripcion.trim()) return setError("Describe el hallazgo.");
    try {
      const creado = await apiFetch(`/inventarios/ordenes-mantenimiento/${ordenUuid}/hallazgos`, { method: "POST", body: JSON.stringify(nuevo) });
      setHallazgos((lista) => [...lista, creado]);
      setNuevo(null);
    } catch (err) {
      setError(err.message);
    }
  }

  if (!hallazgos) return error ? <div className="alert alert-danger py-2 small">{error}</div> : <p className="small text-secondary">Cargando...</p>;

  return (
    <div>
      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      <div className="d-flex align-items-center justify-content-between mb-2">
        <p className="small text-secondary mb-0">Se crean solos al calificar un ítem como Observación o Insatisfactorio. Siguen abiertos hasta que los marques como resueltos.</p>
        {puedeEditar && !nuevo && (
          <button type="button" className="btn btn-outline-secondary btn-sm rounded-1 d-inline-flex align-items-center gap-1 flex-shrink-0 ms-2" onClick={() => setNuevo({ descripcion: "", calificacion: "OBSERVACION", prioridad: "MEDIA" })}>
            <FiPlus /> Nuevo hallazgo
          </button>
        )}
      </div>

      {nuevo && (
        <div className="border rounded-1 p-2 mb-2" style={{ background: "#f8faf9" }}>
          <textarea className="form-control form-control-sm rounded-1 mb-2" rows={2} placeholder="¿Qué se encontró?" value={nuevo.descripcion} onChange={(e) => setNuevo({ ...nuevo, descripcion: e.target.value })} />
          <div className="d-flex flex-wrap gap-2">
            <select className="form-select form-select-sm rounded-1" style={{ width: "auto" }} value={nuevo.calificacion} onChange={(e) => setNuevo({ ...nuevo, calificacion: e.target.value })}>
              <option value="OBSERVACION">Observación</option>
              <option value="INSATISFACTORIO">Insatisfactorio</option>
            </select>
            <select className="form-select form-select-sm rounded-1" style={{ width: "auto" }} value={nuevo.prioridad} onChange={(e) => setNuevo({ ...nuevo, prioridad: e.target.value })}>
              {PRIORIDADES.map((p) => (
                <option key={p.value} value={p.value}>
                  Prioridad {p.label.toLowerCase()}
                </option>
              ))}
            </select>
            <button type="button" className="btn btn-brand btn-sm rounded-1" onClick={crear}>
              Agregar
            </button>
            <button type="button" className="btn btn-outline-secondary btn-sm rounded-1" onClick={() => setNuevo(null)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {hallazgos.length === 0 && !nuevo && <p className="small text-secondary">Esta orden no tiene hallazgos.</p>}

      {hallazgos.map((h) => {
        const c = color(h.calificacion);
        const sucio = Boolean(borradores[h.uuid]);
        return (
          <div key={h.uuid} className="border rounded-1 mb-2 p-2" style={{ borderLeft: `4px solid ${c.color}` }}>
            <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
              <span className="badge rounded-1 fw-normal" style={{ background: c.bg, color: c.color }}>
                {c.label}
              </span>
              {h.seccion && <span className="small text-secondary">{h.seccion}</span>}
              <select className="form-select form-select-sm rounded-1 ms-auto" style={{ width: "auto" }} disabled={!puedeEditar} value={valor(h, "estado")} onChange={(e) => editar(h, { estado: e.target.value })}>
                {ESTADOS.map((e) => (
                  <option key={e.value} value={e.value}>
                    {e.label}
                  </option>
                ))}
              </select>
              <select className="form-select form-select-sm rounded-1" style={{ width: "auto" }} disabled={!puedeEditar} value={valor(h, "prioridad")} onChange={(e) => editar(h, { prioridad: e.target.value })}>
                {PRIORIDADES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            {h.itemDescripcion && <div className="small text-secondary mb-1">Ítem: {h.itemDescripcion}</div>}
            <textarea className="form-control form-control-sm rounded-1 mb-1" rows={2} disabled={!puedeEditar} value={valor(h, "descripcion")} onChange={(e) => editar(h, { descripcion: e.target.value })} placeholder="Hallazgo" />
            <div className="row g-1">
              <div className="col-12 col-md-4">
                <textarea className="form-control form-control-sm rounded-1" rows={2} disabled={!puedeEditar} value={valor(h, "accionEjecutada")} onChange={(e) => editar(h, { accionEjecutada: e.target.value })} placeholder="Acción ejecutada" />
              </div>
              <div className="col-12 col-md-4">
                <textarea className="form-control form-control-sm rounded-1" rows={2} disabled={!puedeEditar} value={valor(h, "pendienteRepuesto")} onChange={(e) => editar(h, { pendienteRepuesto: e.target.value })} placeholder="Pendiente / repuesto" />
              </div>
              <div className="col-12 col-md-4">
                <textarea className="form-control form-control-sm rounded-1" rows={2} disabled={!puedeEditar} value={valor(h, "recomendacion")} onChange={(e) => editar(h, { recomendacion: e.target.value })} placeholder="Recomendación" />
              </div>
            </div>
            {puedeEditar && (
              <div className="d-flex flex-wrap align-items-center gap-2 mt-2">
                <button type="button" className="btn btn-brand btn-sm rounded-1 d-inline-flex align-items-center gap-1" disabled={!sucio} onClick={() => guardar(h)}>
                  <FiCheck /> Guardar
                </button>
                {h.programacionUuid ? (
                  <span className="small text-success d-inline-flex align-items-center gap-1">
                    <FiCalendar /> Programada en Programaciones
                  </span>
                ) : (
                  <>
                    <input type="date" className="form-control form-control-sm rounded-1" style={{ width: "auto" }} value={fechas[h.uuid] || hoy()} onChange={(e) => setFechas((f) => ({ ...f, [h.uuid]: e.target.value }))} />
                    <button type="button" className="btn btn-outline-secondary btn-sm rounded-1 d-inline-flex align-items-center gap-1" onClick={() => programar(h)} title="Crea una programación de mantenimiento con este hallazgo">
                      <FiCalendar /> Programar corrección
                    </button>
                  </>
                )}
                <button type="button" className="btn btn-link btn-sm text-danger p-1 ms-auto" title="Eliminar hallazgo" onClick={() => eliminar(h)}>
                  <FiTrash2 />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
