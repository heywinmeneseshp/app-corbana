"use client";

import { useEffect, useState } from "react";
import { FiPlus, FiEdit2, FiTrash2, FiDownload } from "react-icons/fi";
import { apiFetch, apiFetchBlob } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import RequirePermission from "@/components/RequirePermission";
import ModalShell from "@/components/ModalShell";

function emptyForm() {
  return { nombre: "", descripcion: "", codigoExterno: "", estado: true };
}

export default function MotivoCatalogPage({ title, description, endpoint, permVer, permCrear, permEditar, permEliminar }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [descargando, setDescargando] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { items: rows } = await apiFetch(`${endpoint}?limit=100`);
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

  function openEdit(motivo) {
    setEditing(motivo);
    setForm({
      nombre: motivo.nombre,
      descripcion: motivo.descripcion || "",
      codigoExterno: motivo.codigoExterno || "",
      estado: motivo.estado,
    });
    setFormError("");
    setModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      if (editing) {
        await apiFetch(`${endpoint}/${editing.uuid}`, { method: "PUT", body: JSON.stringify(form) });
      } else {
        await apiFetch(endpoint, { method: "POST", body: JSON.stringify(form) });
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleExportar() {
    setDescargando(true);
    try {
      const blob = await apiFetchBlob(`${endpoint}/exportar`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setDescargando(false);
    }
  }

  async function handleDelete(motivo) {
    if (!confirm(`¿Eliminar el motivo "${motivo.nombre}"?`)) return;
    try {
      await apiFetch(`${endpoint}/${motivo.uuid}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <RequirePermission code={permVer}>
      <div className="p-4 p-md-5">
        <div className="mb-4 d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h1 className="fw-bold h3 mb-1">{title}</h1>
            <p className="text-secondary mb-0">{description}</p>
          </div>
          <div className="d-flex gap-2">
            <button
              type="button"
              className="btn btn-outline-success rounded-3 d-flex align-items-center gap-2"
              onClick={handleExportar}
              disabled={descargando}
            >
              <FiDownload /> {descargando ? "Descargando..." : "Descargar Excel"}
            </button>
            {hasPermission(permCrear) && (
              <button type="button" className="btn btn-brand rounded-3 d-flex align-items-center gap-2" onClick={openCreate}>
                <FiPlus /> Nuevo motivo
              </button>
            )}
          </div>
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
          <div className="table-responsive">
            <table className="table table-hover mb-0 align-middle">
              <thead className="table-light">
                <tr>
                  <th>Nombre</th>
                  <th>Descripción</th>
                  <th>Código externo</th>
                  <th>Estado</th>
                  <th className="text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={5} className="text-center text-secondary py-4">
                      Cargando...
                    </td>
                  </tr>
                )}
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-secondary py-4">
                      No hay motivos registrados todavía.
                    </td>
                  </tr>
                )}
                {!loading &&
                  items.map((m) => (
                    <tr key={m.uuid}>
                      <td className="fw-medium">{m.nombre}</td>
                      <td className="small text-secondary">{m.descripcion || "—"}</td>
                      <td className="small text-secondary">{m.codigoExterno || "—"}</td>
                      <td>
                        {m.estado ? (
                          <span className="badge rounded-pill" style={{ backgroundColor: "#d1fae5", color: "#047857" }}>
                            Activo
                          </span>
                        ) : (
                          <span className="badge rounded-pill text-bg-secondary">Inactivo</span>
                        )}
                      </td>
                      <td>
                        <div className="d-flex justify-content-end gap-2 flex-nowrap">
                          {hasPermission(permEditar) && (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-warning"
                              title="Editar"
                              onClick={() => openEdit(m)}
                            >
                              <FiEdit2 />
                            </button>
                          )}
                          {hasPermission(permEliminar) && (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              title="Eliminar"
                              onClick={() => handleDelete(m)}
                            >
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
          <ModalShell title={editing ? "Editar motivo" : "Nuevo motivo"} onClose={() => setModalOpen(false)}>
            <form onSubmit={handleSave}>
              <div className="mb-3">
                <label className="form-label small fw-medium">
                  Nombre <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className="form-control rounded-3"
                  required
                  maxLength={100}
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                />
              </div>
              <div className="mb-3">
                <label className="form-label small fw-medium">Descripción</label>
                <textarea
                  className="form-control rounded-3"
                  rows={2}
                  maxLength={255}
                  value={form.descripcion}
                  onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
                />
              </div>
              <div className="mb-3">
                <label className="form-label small fw-medium">Código externo</label>
                <input
                  type="text"
                  className="form-control rounded-3"
                  maxLength={50}
                  placeholder="Código que usa el sistema externo para esta novedad"
                  value={form.codigoExterno}
                  onChange={(e) => setForm((f) => ({ ...f, codigoExterno: e.target.value }))}
                />
              </div>
              <div className="form-check mb-3">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="motivo-estado"
                  checked={form.estado}
                  onChange={(e) => setForm((f) => ({ ...f, estado: e.target.checked }))}
                />
                <label className="form-check-label small" htmlFor="motivo-estado">
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
