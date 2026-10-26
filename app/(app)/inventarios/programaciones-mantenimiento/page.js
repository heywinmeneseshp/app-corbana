"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FiPlus, FiEdit2, FiTrash2, FiTool } from "react-icons/fi";
import { apiFetch, apiFetchTodos } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import RequirePermission from "@/components/RequirePermission";
import ModalShell from "@/components/ModalShell";
import { PRIORIDADES, ESTADOS_PROGRAMACION, Insignia, TextoPrioridad, formatoFecha, hoyIso } from "@/lib/mantenimiento";

const vacio = () => ({ equipoUuid: "", planUuid: "", fechaProgramada: hoyIso(), responsableUuid: "", estado: "PROGRAMADA", prioridad: "MEDIA", observaciones: "" });
const ABIERTAS = ["PENDIENTE", "PROGRAMADA", "EN_CURSO"];

// Programaciones: el calendario de mantenimientos por equipo. Desde una programación se abre la orden de trabajo; al cerrar la orden la
// programación queda completada.
export default function ProgramacionesMantenimientoPage() {
  const [items, setItems] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [planes, setPlanes] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [filtros, setFiltros] = useState({ equipoUuid: "", estado: "", fechaDesde: "", fechaHasta: "" });
  const [soloAbiertas, setSoloAbiertas] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const hoy = hoyIso();

  async function load(f = filtros) {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ limit: "100" });
      Object.entries(f).forEach(([k, v]) => v && qs.set(k, v));
      const { items: rows } = await apiFetchTodos(`/inventarios/programaciones-mantenimiento?${qs}`);
      setItems([...rows].sort((a, b) => String(a.fechaProgramada).localeCompare(String(b.fechaProgramada))));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    Promise.all([
      apiFetchTodos("/inventarios/equipos?limit=100"),
      apiFetchTodos("/inventarios/planes-mantenimiento?limit=100&estado=true"),
      apiFetch("/users?limit=100").catch(() => ({ items: [] })),
    ])
      .then(([e, p, u]) => {
        setEquipos(e.items || []);
        setPlanes(p.items || []);
        setUsuarios(u.items || []);
        // Desde Planes: ?nueva=1&equipoUuid=...&planUuid=... abre el formulario ya lleno.
        const params = new URLSearchParams(window.location.search);
        if (params.get("nueva")) {
          setModal({ editing: null, form: { ...vacio(), equipoUuid: params.get("equipoUuid") || "", planUuid: params.get("planUuid") || "" } });
        }
      })
      .catch((err) => setError(err.message));
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cambiarFiltro(patch) {
    const f = { ...filtros, ...patch };
    setFiltros(f);
    load(f);
  }

  function abrir(prog) {
    setFormError("");
    setModal({
      editing: prog,
      form: prog
        ? {
            equipoUuid: prog.equipo?.uuid || "",
            planUuid: prog.plan?.uuid || "",
            fechaProgramada: String(prog.fechaProgramada).slice(0, 10),
            responsableUuid: prog.responsable?.uuid || "",
            estado: prog.estado,
            prioridad: prog.prioridad,
            observaciones: prog.observaciones || "",
          }
        : vacio(),
    });
  }

  const setForm = (patch) => setModal((m) => ({ ...m, form: { ...m.form, ...patch } }));

  async function guardar(e) {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const body = { ...modal.form, planUuid: modal.form.planUuid || null, responsableUuid: modal.form.responsableUuid || null, observaciones: modal.form.observaciones || null };
      if (modal.editing) await apiFetch(`/inventarios/programaciones-mantenimiento/${modal.editing.uuid}`, { method: "PUT", body: JSON.stringify(body) });
      else await apiFetch("/inventarios/programaciones-mantenimiento", { method: "POST", body: JSON.stringify(body) });
      setModal(null);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function eliminar(prog) {
    if (!confirm(`¿Eliminar la programación del ${formatoFecha(prog.fechaProgramada)} para ${prog.equipo?.nombre || "el equipo"}?`)) return;
    try {
      await apiFetch(`/inventarios/programaciones-mantenimiento/${prog.uuid}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const visibles = soloAbiertas && !filtros.estado ? items.filter((p) => ABIERTAS.includes(p.estado)) : items;
  const planesDelEquipo = modal ? planes.filter((p) => !modal.form.equipoUuid || p.equipo?.uuid === modal.form.equipoUuid) : [];

  return (
    <RequirePermission code="menu.inventarios.programaciones">
      <div className="p-4 p-md-5">
        <div className="mb-4 d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h1 className="fw-bold h3 mb-1">Programaciones de mantenimiento</h1>
            <p className="text-secondary mb-0">Calendario de mantenimientos por equipo. Desde cada una se abre la orden de trabajo.</p>
          </div>
          {hasPermission("inventario.programaciones.crear") && (
            <button type="button" className="btn btn-brand btn-sm rounded-3 d-flex align-items-center gap-2" onClick={() => abrir(null)}>
              <FiPlus /> Nueva programación
            </button>
          )}
        </div>

        <div className="card border-0 shadow-sm rounded-4 p-3 mb-3">
          <div className="row g-2 align-items-end">
            <div className="col-12 col-md-4">
              <label className="form-label small fw-medium mb-1">Equipo</label>
              <select className="form-select form-select-sm rounded-3" value={filtros.equipoUuid} onChange={(e) => cambiarFiltro({ equipoUuid: e.target.value })}>
                <option value="">Todos</option>
                {equipos.map((eq) => (
                  <option key={eq.uuid} value={eq.uuid}>
                    {eq.codigo} — {eq.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small fw-medium mb-1">Estado</label>
              <select className="form-select form-select-sm rounded-3" value={filtros.estado} onChange={(e) => cambiarFiltro({ estado: e.target.value })}>
                <option value="">Todos</option>
                {ESTADOS_PROGRAMACION.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small fw-medium mb-1">Desde</label>
              <input type="date" className="form-control form-control-sm rounded-3" value={filtros.fechaDesde} onChange={(e) => cambiarFiltro({ fechaDesde: e.target.value })} />
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small fw-medium mb-1">Hasta</label>
              <input type="date" className="form-control form-control-sm rounded-3" value={filtros.fechaHasta} onChange={(e) => cambiarFiltro({ fechaHasta: e.target.value })} />
            </div>
            <div className="col-6 col-md-2">
              <div className="form-check mb-1">
                <input type="checkbox" className="form-check-input" id="solo-abiertas" checked={soloAbiertas} disabled={Boolean(filtros.estado)} onChange={(e) => setSoloAbiertas(e.target.checked)} />
                <label className="form-check-label small" htmlFor="solo-abiertas">
                  Solo pendientes
                </label>
              </div>
            </div>
          </div>
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
          <div className="table-responsive">
            <table className="table table-sm table-hover mb-0 align-middle small">
              <thead className="table-light">
                <tr>
                  <th>Fecha</th>
                  <th>Equipo</th>
                  <th>Plan</th>
                  <th>Prioridad</th>
                  <th>Responsable</th>
                  <th>Estado</th>
                  <th className="text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={7} className="text-center text-secondary py-4">
                      Cargando...
                    </td>
                  </tr>
                )}
                {!loading && visibles.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-secondary py-4">
                      No hay programaciones para los filtros seleccionados.
                    </td>
                  </tr>
                )}
                {!loading &&
                  visibles.map((p) => {
                    const vencida = ABIERTAS.includes(p.estado) && String(p.fechaProgramada).slice(0, 10) < hoy;
                    return (
                      <tr key={p.uuid}>
                        <td className={`text-nowrap ${vencida ? "text-danger fw-medium" : ""}`}>{formatoFecha(p.fechaProgramada)}</td>
                        <td>
                          <span className="fw-medium">{p.equipo?.codigo}</span> <span className="text-secondary">{p.equipo?.nombre}</span>
                        </td>
                        <td>{p.plan?.nombre || <span className="text-secondary">Sin plan</span>}</td>
                        <td>
                          <TextoPrioridad value={p.prioridad} />
                        </td>
                        <td>{p.responsable?.nombre || p.responsable?.usuario || "—"}</td>
                        <td>
                          <Insignia lista={ESTADOS_PROGRAMACION} value={vencida ? "VENCIDA" : p.estado} />
                        </td>
                        <td className="text-end text-nowrap">
                          {ABIERTAS.includes(p.estado) && hasPermission("inventario.ordenes.crear") && (
                            <Link
                              href={`/inventarios/ordenes-mantenimiento?nueva=1&programacionUuid=${p.uuid}&equipoUuid=${p.equipo?.uuid || ""}&planUuid=${p.plan?.uuid || ""}`}
                              className="btn btn-sm btn-link p-1 text-success"
                              title="Abrir orden de trabajo"
                            >
                              <FiTool />
                            </Link>
                          )}
                          {hasPermission("inventario.programaciones.editar") && (
                            <button type="button" className="btn btn-sm btn-link p-1 text-secondary" title="Editar" onClick={() => abrir(p)}>
                              <FiEdit2 />
                            </button>
                          )}
                          {hasPermission("inventario.programaciones.eliminar") && (
                            <button type="button" className="btn btn-sm btn-link p-1 text-danger" title="Eliminar" onClick={() => eliminar(p)}>
                              <FiTrash2 />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>

        {modal && (
          <ModalShell title={modal.editing ? "Editar programación" : "Nueva programación"} onClose={() => setModal(null)}>
            <form onSubmit={guardar}>
              <div className="mb-2">
                <label className="form-label small fw-medium mb-1">
                  Equipo <span className="text-danger">*</span>
                </label>
                <select
                  className="form-select form-select-sm rounded-3"
                  required
                  value={modal.form.equipoUuid}
                  onChange={(e) => setForm({ equipoUuid: e.target.value, planUuid: "" })}
                >
                  <option value="">Selecciona...</option>
                  {equipos.map((eq) => (
                    <option key={eq.uuid} value={eq.uuid}>
                      {eq.codigo} — {eq.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-2">
                <label className="form-label small fw-medium mb-1">Plan</label>
                <select className="form-select form-select-sm rounded-3" value={modal.form.planUuid} onChange={(e) => setForm({ planUuid: e.target.value })}>
                  <option value="">Sin plan (mantenimiento puntual)</option>
                  {planesDelEquipo.map((p) => (
                    <option key={p.uuid} value={p.uuid}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="row g-2 mb-2">
                <div className="col-6">
                  <label className="form-label small fw-medium mb-1">
                    Fecha <span className="text-danger">*</span>
                  </label>
                  <input type="date" required className="form-control form-control-sm rounded-3" value={modal.form.fechaProgramada} onChange={(e) => setForm({ fechaProgramada: e.target.value })} />
                </div>
                <div className="col-6">
                  <label className="form-label small fw-medium mb-1">Prioridad</label>
                  <select className="form-select form-select-sm rounded-3" value={modal.form.prioridad} onChange={(e) => setForm({ prioridad: e.target.value })}>
                    {PRIORIDADES.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-6">
                  <label className="form-label small fw-medium mb-1">Estado</label>
                  <select className="form-select form-select-sm rounded-3" value={modal.form.estado} onChange={(e) => setForm({ estado: e.target.value })}>
                    {ESTADOS_PROGRAMACION.filter((s) => s.value !== "VENCIDA").map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-6">
                  <label className="form-label small fw-medium mb-1">Responsable</label>
                  <select className="form-select form-select-sm rounded-3" value={modal.form.responsableUuid} onChange={(e) => setForm({ responsableUuid: e.target.value })}>
                    <option value="">Sin asignar</option>
                    {usuarios.map((u) => (
                      <option key={u.uuid} value={u.uuid}>
                        {u.nombre || u.usuario}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mb-3">
                <label className="form-label small fw-medium mb-1">Observaciones</label>
                <textarea className="form-control form-control-sm rounded-3" rows={2} maxLength={1000} value={modal.form.observaciones} onChange={(e) => setForm({ observaciones: e.target.value })} />
              </div>
              {formError && <div className="alert alert-danger py-2 small">{formError}</div>}
              <div className="d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-outline-secondary btn-sm rounded-3" onClick={() => setModal(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-brand btn-sm rounded-3" disabled={saving}>
                  {saving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </form>
          </ModalShell>
        )}
      </div>
    </RequirePermission>
  );
}
