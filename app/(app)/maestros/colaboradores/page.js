"use client";

import { useEffect, useState } from "react";
import { FiPlus, FiEdit2, FiTrash2, FiStar } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import RequirePermission from "@/components/RequirePermission";
import ModalShell from "@/components/ModalShell";

function emptyForm() {
  return { nombre: "", documento: "", telefono: "", fincaUuid: "", estado: true, labores: [] };
}

// Fila del picker "labor + calificación": se agrega una labor a la vez con
// su calificación (1-5), igual que un SelectAddPicker pero con un atributo
// numérico extra por selección — no había precedente de eso en el proyecto,
// así que queda como un picker chico propio de esta pantalla.
function LaboresCalificacionPicker({ labores, seleccion, onChange }) {
  const [laborUuid, setLaborUuid] = useState("");
  const [calificacion, setCalificacion] = useState(3);

  const disponibles = labores.filter((l) => !seleccion.some((s) => s.laborUuid === l.uuid));

  const agregar = () => {
    if (!laborUuid) return;
    const labor = labores.find((l) => l.uuid === laborUuid);
    if (!labor) return;
    onChange([...seleccion, { laborUuid, laborNombre: labor.nombre, calificacion: Number(calificacion) }]);
    setLaborUuid("");
    setCalificacion(3);
  };

  const quitar = (uuid) => onChange(seleccion.filter((s) => s.laborUuid !== uuid));

  return (
    <div>
      <div className="d-flex gap-2 mb-2">
        <select className="form-select form-select-sm rounded-3" value={laborUuid} onChange={(e) => setLaborUuid(e.target.value)}>
          <option value="">Selecciona una labor...</option>
          {disponibles.map((l) => (
            <option key={l.uuid} value={l.uuid}>
              {l.nombre}
            </option>
          ))}
        </select>
        <select
          className="form-select form-select-sm rounded-3"
          style={{ width: "6rem" }}
          value={calificacion}
          onChange={(e) => setCalificacion(e.target.value)}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {n} ★
            </option>
          ))}
        </select>
        <button type="button" className="btn btn-sm btn-outline-secondary rounded-3 text-nowrap" disabled={!laborUuid} onClick={agregar}>
          <FiPlus /> Agregar
        </button>
      </div>

      {seleccion.length > 0 && (
        <div className="d-flex flex-column gap-1">
          {seleccion.map((s) => (
            <div key={s.laborUuid} className="d-flex align-items-center justify-content-between rounded-3 px-3 py-2 small" style={{ backgroundColor: "#f8fafc" }}>
              <span>{s.laborNombre}</span>
              <span className="d-flex align-items-center gap-2">
                <span className="d-flex align-items-center gap-1 text-warning fw-semibold">
                  {s.calificacion} <FiStar />
                </span>
                <button type="button" className="btn-close" style={{ fontSize: "0.6rem" }} onClick={() => quitar(s.laborUuid)} aria-label="Quitar"></button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ColaboradoresPage() {
  const [items, setItems] = useState([]);
  const [fincas, setFincas] = useState([]);
  const [labores, setLabores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { items: rows } = await apiFetch("/colaboradores?limit=100");
      setItems(rows);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    apiFetch("/fincas?limit=100").then(({ items }) => setFincas(items)).catch(() => {});
    apiFetch("/labores?limit=100").then(({ items }) => setLabores(items)).catch(() => {});
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(colaborador) {
    setEditing(colaborador);
    setForm({
      nombre: colaborador.nombre,
      documento: colaborador.documento || "",
      telefono: colaborador.telefono || "",
      fincaUuid: colaborador.finca?.uuid || "",
      estado: colaborador.estado,
      labores: (colaborador.labores || []).map((l) => ({
        laborUuid: l.labor.uuid,
        laborNombre: l.labor.nombre,
        calificacion: l.calificacion,
      })),
    });
    setFormError("");
    setModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      const body = {
        nombre: form.nombre,
        documento: form.documento || null,
        telefono: form.telefono || null,
        fincaUuid: form.fincaUuid || null,
        estado: form.estado,
        labores: form.labores.map((l) => ({ laborUuid: l.laborUuid, calificacion: l.calificacion })),
      };
      if (editing) {
        await apiFetch(`/colaboradores/${editing.uuid}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await apiFetch("/colaboradores", { method: "POST", body: JSON.stringify(body) });
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(colaborador) {
    if (!confirm(`¿Eliminar al colaborador "${colaborador.nombre}"?`)) return;
    try {
      await apiFetch(`/colaboradores/${colaborador.uuid}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <RequirePermission code="menu.maestros.colaboradores">
      <div className="p-4 p-md-5">
        <div className="mb-4 d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h1 className="fw-bold h3 mb-1">Colaboradores</h1>
            <p className="text-secondary mb-0">
              Trabajadores de campo, con las labores que saben hacer y su calificación (1 a 5) — con esto se hace el
              pre-reparto de colaboradores según sus habilidades cuando se programa una labor.
            </p>
          </div>
          {hasPermission("colaborador.crear") && (
            <button type="button" className="btn btn-brand rounded-3 d-flex align-items-center gap-2" onClick={openCreate}>
              <FiPlus /> Nuevo colaborador
            </button>
          )}
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
          <div className="table-responsive">
            <table className="table table-hover mb-0 align-middle">
              <thead className="table-light">
                <tr>
                  <th>Nombre</th>
                  <th>Documento</th>
                  <th>Teléfono</th>
                  <th>Finca</th>
                  <th>Labores</th>
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
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-secondary py-4">
                      No hay colaboradores registrados todavía.
                    </td>
                  </tr>
                )}
                {!loading &&
                  items.map((c) => (
                    <tr key={c.uuid}>
                      <td className="fw-medium">{c.nombre}</td>
                      <td className="small text-secondary">{c.documento || "—"}</td>
                      <td className="small text-secondary">{c.telefono || "—"}</td>
                      <td className="small text-secondary">{c.finca?.nombre || "—"}</td>
                      <td>
                        <div className="d-flex flex-wrap gap-1">
                          {(c.labores || []).length === 0 && <span className="text-secondary small">—</span>}
                          {(c.labores || []).map((l) => (
                            <span key={l.uuid} className="badge rounded-pill bg-light text-dark border small">
                              {l.labor.nombre} · {l.calificacion}★
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        {c.estado ? (
                          <span className="badge rounded-pill" style={{ backgroundColor: "#d1fae5", color: "#047857" }}>
                            Activo
                          </span>
                        ) : (
                          <span className="badge rounded-pill text-bg-secondary">Inactivo</span>
                        )}
                      </td>
                      <td>
                        <div className="d-flex justify-content-end gap-2 flex-nowrap">
                          {hasPermission("colaborador.editar") && (
                            <button type="button" className="btn btn-sm btn-outline-warning" title="Editar" onClick={() => openEdit(c)}>
                              <FiEdit2 />
                            </button>
                          )}
                          {hasPermission("colaborador.eliminar") && (
                            <button type="button" className="btn btn-sm btn-outline-danger" title="Eliminar" onClick={() => handleDelete(c)}>
                              <FiTrash2 />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {modalOpen && (
          <ModalShell title={editing ? "Editar colaborador" : "Nuevo colaborador"} onClose={() => setModalOpen(false)} size="lg">
            <form onSubmit={handleSave}>
              <div className="row g-3 mb-3">
                <div className="col-12">
                  <label className="form-label small fw-medium">
                    Nombre <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control rounded-3"
                    required
                    maxLength={150}
                    value={form.nombre}
                    onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  />
                </div>
                <div className="col-6">
                  <label className="form-label small fw-medium">Documento</label>
                  <input
                    type="text"
                    className="form-control rounded-3"
                    maxLength={30}
                    value={form.documento}
                    onChange={(e) => setForm((f) => ({ ...f, documento: e.target.value }))}
                  />
                </div>
                <div className="col-6">
                  <label className="form-label small fw-medium">Teléfono</label>
                  <input
                    type="text"
                    className="form-control rounded-3"
                    maxLength={30}
                    value={form.telefono}
                    onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                  />
                </div>
                <div className="col-12">
                  <label className="form-label small fw-medium">Finca</label>
                  <select
                    className="form-select rounded-3"
                    value={form.fincaUuid}
                    onChange={(e) => setForm((f) => ({ ...f, fincaUuid: e.target.value }))}
                  >
                    <option value="">Sin asignar</option>
                    {fincas.map((f) => (
                      <option key={f.uuid} value={f.uuid}>
                        {f.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label small fw-medium">Labores y calificación (1 a 5)</label>
                <LaboresCalificacionPicker
                  labores={labores}
                  seleccion={form.labores}
                  onChange={(labores) => setForm((f) => ({ ...f, labores }))}
                />
              </div>

              <div className="form-check mb-3">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="colaborador-estado"
                  checked={form.estado}
                  onChange={(e) => setForm((f) => ({ ...f, estado: e.target.checked }))}
                />
                <label className="form-check-label small" htmlFor="colaborador-estado">
                  Activo
                </label>
              </div>

              {formError && <div className="alert alert-danger py-2 small">{formError}</div>}

              <div className="d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-outline-secondary rounded-3" onClick={() => setModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-brand rounded-3" disabled={saving}>
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
