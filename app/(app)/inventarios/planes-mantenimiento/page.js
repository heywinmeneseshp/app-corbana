"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FiPlus, FiEdit2, FiTrash2, FiCalendar } from "react-icons/fi";
import { apiFetch, apiFetchTodos } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import RequirePermission from "@/components/RequirePermission";
import ModalShell from "@/components/ModalShell";
import { TIPOS_MANTENIMIENTO, UNIDADES_PERIODICIDAD, etiqueta } from "@/lib/mantenimiento";

const vacio = () => ({ equipoUuid: "", nombre: "", descripcion: "", tipo: "PREVENTIVO", periodicidadValor: "30", periodicidadUnidad: "DIAS", estado: true });

// Planes de mantenimiento: qué se le hace a cada equipo y cada cuánto. Al cerrar una orden de un plan por días/meses se agenda sola la
// siguiente programación.
export default function PlanesMantenimientoPage() {
  const [items, setItems] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [filtros, setFiltros] = useState({ equipoUuid: "", tipo: "", search: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null); // null | { editing, form }
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function load(f = filtros) {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ limit: "100" });
      Object.entries(f).forEach(([k, v]) => v && qs.set(k, v));
      const { items: rows } = await apiFetchTodos(`/inventarios/planes-mantenimiento?${qs}`);
      setItems(rows);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    apiFetchTodos("/inventarios/equipos?limit=100")
      .then((r) => setEquipos(r.items || []))
      .catch((err) => setError(err.message));
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cambiarFiltro(patch) {
    const f = { ...filtros, ...patch };
    setFiltros(f);
    load(f);
  }

  function abrir(plan) {
    setFormError("");
    setModal({
      editing: plan,
      form: plan
        ? {
            equipoUuid: plan.equipo?.uuid || "",
            nombre: plan.nombre,
            descripcion: plan.descripcion || "",
            tipo: plan.tipo,
            periodicidadValor: String(plan.periodicidadValor),
            periodicidadUnidad: plan.periodicidadUnidad,
            estado: plan.estado,
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
      const body = { ...modal.form, periodicidadValor: Number(modal.form.periodicidadValor), descripcion: modal.form.descripcion || null };
      if (modal.editing) await apiFetch(`/inventarios/planes-mantenimiento/${modal.editing.uuid}`, { method: "PUT", body: JSON.stringify(body) });
      else await apiFetch("/inventarios/planes-mantenimiento", { method: "POST", body: JSON.stringify(body) });
      setModal(null);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function eliminar(plan) {
    if (!confirm(`¿Eliminar el plan "${plan.nombre}"?`)) return;
    try {
      await apiFetch(`/inventarios/planes-mantenimiento/${plan.uuid}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <RequirePermission code="menu.inventarios.planes">
      <div className="p-4 p-md-5">
        <div className="mb-4 d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h1 className="fw-bold h3 mb-1">Planes de mantenimiento</h1>
            <p className="text-secondary mb-0">Qué mantenimiento se le hace a cada equipo y cada cuánto.</p>
          </div>
          {hasPermission("inventario.planes.crear") && (
            <button type="button" className="btn btn-brand btn-sm rounded-3 d-flex align-items-center gap-2" onClick={() => abrir(null)}>
              <FiPlus /> Nuevo plan
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
            <div className="col-6 col-md-3">
              <label className="form-label small fw-medium mb-1">Tipo</label>
              <select className="form-select form-select-sm rounded-3" value={filtros.tipo} onChange={(e) => cambiarFiltro({ tipo: e.target.value })}>
                <option value="">Todos</option>
                {TIPOS_MANTENIMIENTO.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-6 col-md-3">
              <label className="form-label small fw-medium mb-1">Buscar</label>
              <input
                type="text"
                className="form-control form-control-sm rounded-3"
                placeholder="Nombre del plan..."
                value={filtros.search}
                onChange={(e) => setFiltros((f) => ({ ...f, search: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && load()}
              />
            </div>
          </div>
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
          <div className="table-responsive">
            <table className="table table-sm table-hover mb-0 align-middle small">
              <thead className="table-light">
                <tr>
                  <th>Equipo</th>
                  <th>Plan</th>
                  <th>Tipo</th>
                  <th>Cada</th>
                  <th>Estado</th>
                  <th className="text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6} className="text-center text-secondary py-4">
                      Cargando...
                    </td>
                  </tr>
                )}
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-secondary py-4">
                      No hay planes. Crea el primero con «Nuevo plan».
                    </td>
                  </tr>
                )}
                {!loading &&
                  items.map((p) => (
                    <tr key={p.uuid}>
                      <td>
                        <span className="fw-medium">{p.equipo?.codigo}</span> <span className="text-secondary">{p.equipo?.nombre}</span>
                      </td>
                      <td>
                        <div className="fw-medium">{p.nombre}</div>
                        {p.descripcion && <div className="text-secondary">{p.descripcion}</div>}
                      </td>
                      <td>{etiqueta(TIPOS_MANTENIMIENTO, p.tipo)}</td>
                      <td className="text-nowrap">
                        {p.periodicidadValor} {etiqueta(UNIDADES_PERIODICIDAD, p.periodicidadUnidad)}
                      </td>
                      <td>{p.estado ? <span className="text-success">Activo</span> : <span className="text-secondary">Inactivo</span>}</td>
                      <td className="text-end text-nowrap">
                        <Link
                          href={`/inventarios/programaciones-mantenimiento?nueva=1&equipoUuid=${p.equipo?.uuid || ""}&planUuid=${p.uuid}`}
                          className="btn btn-sm btn-link p-1 text-secondary"
                          title="Programar este mantenimiento"
                        >
                          <FiCalendar />
                        </Link>
                        {hasPermission("inventario.planes.editar") && (
                          <button type="button" className="btn btn-sm btn-link p-1 text-secondary" title="Editar" onClick={() => abrir(p)}>
                            <FiEdit2 />
                          </button>
                        )}
                        {hasPermission("inventario.planes.eliminar") && (
                          <button type="button" className="btn btn-sm btn-link p-1 text-danger" title="Eliminar" onClick={() => eliminar(p)}>
                            <FiTrash2 />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {modal && (
          <ModalShell title={modal.editing ? "Editar plan" : "Nuevo plan"} onClose={() => setModal(null)}>
            <form onSubmit={guardar}>
              <div className="mb-2">
                <label className="form-label small fw-medium mb-1">
                  Equipo <span className="text-danger">*</span>
                </label>
                <select className="form-select form-select-sm rounded-3" required value={modal.form.equipoUuid} onChange={(e) => setForm({ equipoUuid: e.target.value })}>
                  <option value="">Selecciona...</option>
                  {equipos.map((eq) => (
                    <option key={eq.uuid} value={eq.uuid}>
                      {eq.codigo} — {eq.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-2">
                <label className="form-label small fw-medium mb-1">
                  Nombre <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className="form-control form-control-sm rounded-3"
                  required
                  maxLength={150}
                  placeholder="Ej. Cambio de aceite y filtros"
                  value={modal.form.nombre}
                  onChange={(e) => setForm({ nombre: e.target.value })}
                />
              </div>
              <div className="mb-2">
                <label className="form-label small fw-medium mb-1">Descripción</label>
                <textarea className="form-control form-control-sm rounded-3" rows={2} maxLength={1000} value={modal.form.descripcion} onChange={(e) => setForm({ descripcion: e.target.value })} />
              </div>
              <div className="row g-2 mb-2">
                <div className="col-12 col-sm-4">
                  <label className="form-label small fw-medium mb-1">Tipo</label>
                  <select className="form-select form-select-sm rounded-3" value={modal.form.tipo} onChange={(e) => setForm({ tipo: e.target.value })}>
                    {TIPOS_MANTENIMIENTO.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-5 col-sm-3">
                  <label className="form-label small fw-medium mb-1">Cada</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    className="form-control form-control-sm rounded-3"
                    value={modal.form.periodicidadValor}
                    onChange={(e) => setForm({ periodicidadValor: e.target.value })}
                  />
                </div>
                <div className="col-7 col-sm-5">
                  <label className="form-label small fw-medium mb-1">Unidad</label>
                  <select className="form-select form-select-sm rounded-3" value={modal.form.periodicidadUnidad} onChange={(e) => setForm({ periodicidadUnidad: e.target.value })}>
                    {UNIDADES_PERIODICIDAD.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="form-text small">
                Con días o meses, al cerrar una orden de este plan se agenda sola la siguiente. Con horas o kilómetros la programación es manual.
              </p>
              <div className="form-check mb-3">
                <input type="checkbox" className="form-check-input" id="plan-estado" checked={modal.form.estado} onChange={(e) => setForm({ estado: e.target.checked })} />
                <label className="form-check-label small" htmlFor="plan-estado">
                  Activo
                </label>
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
