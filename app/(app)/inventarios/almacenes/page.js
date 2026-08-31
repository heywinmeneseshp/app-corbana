"use client";

import { useEffect, useState } from "react";
import { FiPlus, FiEdit2, FiTrash2 } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import RequirePermission from "@/components/RequirePermission";
import ModalShell from "@/components/ModalShell";

const TIPOS = ["ALMACEN", "CENTRO_COSTO"];

function emptyForm() {
  return {
    codigo: "",
    nombre: "",
    descripcion: "",
    tipo: "ALMACEN",
    parentUuid: "",
    ubicacionFincaUuid: "",
    responsableUuid: "",
    estado: true,
  };
}

export default function AlmacenesInventarioPage() {
  const [items, setItems] = useState([]);
  const [fincas, setFincas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({ limit: "100", ...(search ? { search } : {}) });
      const { items: rows } = await apiFetch(`/inventarios/almacenes?${qs}`);
      setItems(rows);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadCombos() {
    try {
      const [f, u] = await Promise.all([apiFetch("/fincas?limit=100"), apiFetch("/users?limit=100")]);
      setFincas(f.items || []);
      setUsuarios(u.items || []);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
    loadCombos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(almacen) {
    setEditing(almacen);
    setForm({
      codigo: almacen.codigo || "",
      nombre: almacen.nombre,
      descripcion: almacen.descripcion || "",
      tipo: almacen.tipo,
      parentUuid: almacen.padre?.uuid || "",
      ubicacionFincaUuid: almacen.finca?.uuid || "",
      responsableUuid: almacen.responsable?.uuid || "",
      estado: almacen.estado,
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
        ...form,
        codigo: form.codigo || null,
        descripcion: form.descripcion || null,
        parentUuid: form.parentUuid || null,
        ubicacionFincaUuid: form.ubicacionFincaUuid || null,
        responsableUuid: form.responsableUuid || null,
      };
      if (editing) {
        await apiFetch(`/inventarios/almacenes/${editing.uuid}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await apiFetch("/inventarios/almacenes", { method: "POST", body: JSON.stringify(body) });
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(almacen) {
    if (!confirm(`¿Eliminar el almacén "${almacen.nombre}"?`)) return;
    try {
      await apiFetch(`/inventarios/almacenes/${almacen.uuid}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <RequirePermission code="menu.inventarios.almacenes">
      <div className="p-4 p-md-5">
        <div className="mb-4 d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h1 className="fw-bold h3 mb-1">Almacenes y Centros de Costo</h1>
            <p className="text-secondary mb-0">Ubicaciones físicas y centros de costo donde se controla el inventario.</p>
          </div>
          {hasPermission("inventario.almacenes.crear") && (
            <button type="button" className="btn btn-brand rounded-3 d-flex align-items-center gap-2" onClick={openCreate}>
              <FiPlus /> Nuevo almacén
            </button>
          )}
        </div>

        <div className="mb-3">
          <input
            type="text"
            className="form-control rounded-3"
            style={{ maxWidth: 320 }}
            placeholder="Buscar por nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
          <div className="table-responsive">
            <table className="table table-hover mb-0 align-middle">
              <thead className="table-light">
                <tr>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Tipo</th>
                  <th>Almacén padre</th>
                  <th>Finca</th>
                  <th>Responsable</th>
                  <th>Estado</th>
                  <th className="text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={8} className="text-center text-secondary py-4">
                      Cargando...
                    </td>
                  </tr>
                )}
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center text-secondary py-4">
                      No hay almacenes registrados todavía.
                    </td>
                  </tr>
                )}
                {!loading &&
                  items.map((a) => (
                    <tr key={a.uuid}>
                      <td className="small text-secondary">{a.codigo || "—"}</td>
                      <td className="fw-medium">{a.nombre}</td>
                      <td className="small text-secondary">{a.tipo}</td>
                      <td className="small text-secondary">{a.padre?.nombre || "—"}</td>
                      <td className="small text-secondary">{a.finca?.nombre || "—"}</td>
                      <td className="small text-secondary">
                        {a.responsable ? `${a.responsable.nombre} ${a.responsable.apellido}` : "—"}
                      </td>
                      <td>
                        {a.estado ? (
                          <span className="badge rounded-pill" style={{ backgroundColor: "#d1fae5", color: "#047857" }}>
                            Activo
                          </span>
                        ) : (
                          <span className="badge rounded-pill text-bg-secondary">Inactivo</span>
                        )}
                      </td>
                      <td>
                        <div className="d-flex justify-content-end gap-2 flex-nowrap">
                          {hasPermission("inventario.almacenes.editar") && (
                            <button type="button" className="btn btn-sm btn-outline-warning" title="Editar" onClick={() => openEdit(a)}>
                              <FiEdit2 />
                            </button>
                          )}
                          {hasPermission("inventario.almacenes.eliminar") && (
                            <button type="button" className="btn btn-sm btn-outline-danger" title="Eliminar" onClick={() => handleDelete(a)}>
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
          <ModalShell title={editing ? "Editar almacén" : "Nuevo almacén"} onClose={() => setModalOpen(false)}>
            <form onSubmit={handleSave}>
              <div className="row g-3 mb-3">
                <div className="col-4">
                  <label className="form-label small fw-medium">Código</label>
                  <input
                    type="text"
                    className="form-control rounded-3"
                    maxLength={20}
                    value={form.codigo}
                    onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
                  />
                </div>
                <div className="col-8">
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
              </div>

              <div className="mb-3">
                <label className="form-label small fw-medium">Descripción</label>
                <textarea
                  className="form-control rounded-3"
                  rows={2}
                  maxLength={500}
                  value={form.descripcion}
                  onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                />
              </div>

              <div className="row g-3 mb-3">
                <div className="col-6">
                  <label className="form-label small fw-medium">Tipo</label>
                  <select
                    className="form-select rounded-3"
                    value={form.tipo}
                    onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
                  >
                    {TIPOS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-6">
                  <label className="form-label small fw-medium">Almacén padre</label>
                  <select
                    className="form-select rounded-3"
                    value={form.parentUuid}
                    onChange={(e) => setForm((f) => ({ ...f, parentUuid: e.target.value }))}
                  >
                    <option value="">Ninguno (raíz)</option>
                    {items
                      .filter((a) => !editing || a.uuid !== editing.uuid)
                      .map((a) => (
                        <option key={a.uuid} value={a.uuid}>
                          {a.nombre}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-6">
                  <label className="form-label small fw-medium">Finca</label>
                  <select
                    className="form-select rounded-3"
                    value={form.ubicacionFincaUuid}
                    onChange={(e) => setForm((f) => ({ ...f, ubicacionFincaUuid: e.target.value }))}
                  >
                    <option value="">Sin finca asociada</option>
                    {fincas.map((f) => (
                      <option key={f.uuid} value={f.uuid}>
                        {f.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-6">
                  <label className="form-label small fw-medium">Responsable</label>
                  <select
                    className="form-select rounded-3"
                    value={form.responsableUuid}
                    onChange={(e) => setForm((f) => ({ ...f, responsableUuid: e.target.value }))}
                  >
                    <option value="">Sin responsable</option>
                    {usuarios.map((u) => (
                      <option key={u.uuid} value={u.uuid}>
                        {u.nombre} {u.apellido}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-check mb-3">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="almacen-estado"
                  checked={form.estado}
                  onChange={(e) => setForm((f) => ({ ...f, estado: e.target.checked }))}
                />
                <label className="form-check-label small" htmlFor="almacen-estado">
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
