"use client";

import { useEffect, useState } from "react";
import { FiPlus, FiEdit2, FiTrash2 } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import RequirePermission from "@/components/RequirePermission";
import ModalShell from "@/components/ModalShell";

function emptyForm() {
  return { nombre: "", identificacion: "", telefono: "", email: "", direccion: "", observaciones: "", estado: true };
}

export default function ProveedoresInventarioPage() {
  const [items, setItems] = useState([]);
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
      const { items: rows } = await apiFetch(`/inventarios/proveedores?${qs}`);
      setItems(rows);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(proveedor) {
    setEditing(proveedor);
    setForm({
      nombre: proveedor.nombre,
      identificacion: proveedor.identificacion || "",
      telefono: proveedor.telefono || "",
      email: proveedor.email || "",
      direccion: proveedor.direccion || "",
      observaciones: proveedor.observaciones || "",
      estado: proveedor.estado,
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
        identificacion: form.identificacion || null,
        telefono: form.telefono || null,
        email: form.email || null,
        direccion: form.direccion || null,
        observaciones: form.observaciones || null,
      };
      if (editing) {
        await apiFetch(`/inventarios/proveedores/${editing.uuid}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await apiFetch("/inventarios/proveedores", { method: "POST", body: JSON.stringify(body) });
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(proveedor) {
    if (!confirm(`¿Eliminar el proveedor "${proveedor.nombre}"?`)) return;
    try {
      await apiFetch(`/inventarios/proveedores/${proveedor.uuid}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <RequirePermission code="menu.inventarios.proveedores">
      <div className="p-4 p-md-5">
        <div className="mb-4 d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h1 className="fw-bold h3 mb-1">Proveedores</h1>
            <p className="text-secondary mb-0">Proveedores de repuestos, insumos y servicios de mantenimiento.</p>
          </div>
          {hasPermission("inventario.proveedores.crear") && (
            <button type="button" className="btn btn-brand rounded-3 d-flex align-items-center gap-2" onClick={openCreate}>
              <FiPlus /> Nuevo proveedor
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
                  <th>Nombre</th>
                  <th>Identificación</th>
                  <th>Teléfono</th>
                  <th>Email</th>
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
                      No hay proveedores registrados todavía.
                    </td>
                  </tr>
                )}
                {!loading &&
                  items.map((p) => (
                    <tr key={p.uuid}>
                      <td className="fw-medium">{p.nombre}</td>
                      <td className="small text-secondary">{p.identificacion || "—"}</td>
                      <td className="small text-secondary">{p.telefono || "—"}</td>
                      <td className="small text-secondary">{p.email || "—"}</td>
                      <td>
                        {p.estado ? (
                          <span className="badge rounded-pill" style={{ backgroundColor: "#d1fae5", color: "#047857" }}>
                            Activo
                          </span>
                        ) : (
                          <span className="badge rounded-pill text-bg-secondary">Inactivo</span>
                        )}
                      </td>
                      <td>
                        <div className="d-flex justify-content-end gap-2 flex-nowrap">
                          {hasPermission("inventario.proveedores.editar") && (
                            <button type="button" className="btn btn-sm btn-outline-warning" title="Editar" onClick={() => openEdit(p)}>
                              <FiEdit2 />
                            </button>
                          )}
                          {hasPermission("inventario.proveedores.eliminar") && (
                            <button type="button" className="btn btn-sm btn-outline-danger" title="Eliminar" onClick={() => handleDelete(p)}>
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
          <ModalShell title={editing ? "Editar proveedor" : "Nuevo proveedor"} onClose={() => setModalOpen(false)}>
            <form onSubmit={handleSave}>
              <div className="mb-3">
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

              <div className="row g-3 mb-3">
                <div className="col-6">
                  <label className="form-label small fw-medium">Identificación</label>
                  <input
                    type="text"
                    className="form-control rounded-3"
                    maxLength={50}
                    value={form.identificacion}
                    onChange={(e) => setForm((f) => ({ ...f, identificacion: e.target.value }))}
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
              </div>

              <div className="mb-3">
                <label className="form-label small fw-medium">Email</label>
                <input
                  type="email"
                  className="form-control rounded-3"
                  maxLength={150}
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>

              <div className="mb-3">
                <label className="form-label small fw-medium">Dirección</label>
                <input
                  type="text"
                  className="form-control rounded-3"
                  maxLength={255}
                  value={form.direccion}
                  onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))}
                />
              </div>

              <div className="mb-3">
                <label className="form-label small fw-medium">Observaciones</label>
                <textarea
                  className="form-control rounded-3"
                  rows={2}
                  maxLength={1000}
                  value={form.observaciones}
                  onChange={(e) => setForm((f) => ({ ...f, observaciones: e.target.value }))}
                />
              </div>

              <div className="form-check mb-3">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="proveedor-estado"
                  checked={form.estado}
                  onChange={(e) => setForm((f) => ({ ...f, estado: e.target.checked }))}
                />
                <label className="form-check-label small" htmlFor="proveedor-estado">
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
