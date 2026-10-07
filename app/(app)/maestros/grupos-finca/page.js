"use client";

import { useEffect, useState } from "react";
import { FiPlus, FiEdit2, FiTrash2, FiRotateCcw } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import RequirePermission from "@/components/RequirePermission";
import ModalShell from "@/components/ModalShell";

function emptyForm() {
  return { nombre: "", estado: true };
}

export default function GruposFincaPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mostrarEliminados, setMostrarEliminados] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { items: rows } = await apiFetch(`/grupos-finca?limit=100${mostrarEliminados ? "&incluirEliminados=true" : ""}`);
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
  }, [mostrarEliminados]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(grupo) {
    setEditing(grupo);
    setForm({ nombre: grupo.nombre, estado: grupo.estado });
    setFormError("");
    setModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      if (editing) {
        await apiFetch(`/grupos-finca/${editing.uuid}`, { method: "PUT", body: JSON.stringify(form) });
      } else {
        await apiFetch("/grupos-finca", { method: "POST", body: JSON.stringify(form) });
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(grupo) {
    if (!confirm(`¿Eliminar el grupo "${grupo.nombre}"? Sus fincas dejan de estar agrupadas; puedes restaurar el grupo después y se vuelven a agrupar.`)) return;
    try {
      await apiFetch(`/grupos-finca/${grupo.uuid}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRestore(grupo) {
    if (!confirm(`¿Restaurar el grupo "${grupo.nombre}"? Sus fincas (${grupo.totalFincas ?? 0}) vuelven a estar agrupadas.`)) return;
    try {
      await apiFetch(`/grupos-finca/${grupo.uuid}/restore`, { method: "POST" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <RequirePermission code="menu.maestros.grupos_finca">
      <div className="p-4 p-md-5">
        <div className="mb-4 d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h1 className="fw-bold h3 mb-1">Grupos de Finca</h1>
            <p className="text-secondary mb-0">
              Para fincas registradas por separado que en realidad son una sola operación (ej. divididas en dos
              códigos). Al agruparlas, seleccionar cualquiera de ellas trae los lotes y datos de todas las del grupo.
              Asigná el grupo desde el formulario de cada Finca.
            </p>
          </div>
          {hasPermission("grupo_finca.crear") && (
            <button type="button" className="btn btn-brand btn-sm rounded-3 d-flex align-items-center gap-2" onClick={openCreate}>
              <FiPlus /> Nuevo grupo
            </button>
          )}
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        {hasPermission("grupo_finca.eliminar") && (
          <label className="form-check small text-secondary mb-2">
            <input type="checkbox" className="form-check-input" checked={mostrarEliminados} onChange={(e) => setMostrarEliminados(e.target.checked)} />{" "}
            <span className="form-check-label">Mostrar grupos eliminados</span>
          </label>
        )}

        <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
          <div className="table-responsive">
            <table className="table table-hover mb-0 align-middle">
              <thead className="table-light">
                <tr>
                  <th>Nombre</th>
                  <th className="text-center">Fincas</th>
                  <th>Estado</th>
                  <th className="text-end">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={4} className="text-center text-secondary py-4">
                      Cargando...
                    </td>
                  </tr>
                )}
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center text-secondary py-4">
                      No hay grupos de finca registrados todavía.
                    </td>
                  </tr>
                )}
                {!loading &&
                  items.map((g) => (
                    <tr key={g.uuid} className={g.deletedAt ? "opacity-50" : undefined}>
                      <td className="fw-medium">{g.nombre}</td>
                      <td className="text-center small">{g.totalFincas ?? 0}</td>
                      <td>
                        {g.deletedAt ? (
                          <span className="badge rounded-pill text-bg-danger">Eliminado</span>
                        ) : g.estado ? (
                          <span className="badge rounded-pill" style={{ backgroundColor: "#d1fae5", color: "#047857" }}>
                            Activo
                          </span>
                        ) : (
                          <span className="badge rounded-pill text-bg-secondary">Inactivo</span>
                        )}
                      </td>
                      <td>
                        <div className="d-flex justify-content-end gap-2 flex-nowrap">
                          {g.deletedAt ? (
                            hasPermission("grupo_finca.eliminar") && (
                              <button type="button" className="btn btn-sm btn-link text-success text-decoration-none d-inline-flex align-items-center gap-1" title="Restaurar grupo" onClick={() => handleRestore(g)}>
                                <FiRotateCcw size={14} /> Restaurar
                              </button>
                            )
                          ) : (
                            <>
                              {hasPermission("grupo_finca.editar") && (
                                <button type="button" className="btn btn-sm btn-link text-secondary p-1" title="Editar" onClick={() => openEdit(g)}>
                                  <FiEdit2 />
                                </button>
                              )}
                              {hasPermission("grupo_finca.eliminar") && (
                                <button type="button" className="btn btn-sm btn-link text-danger p-1" title="Eliminar" onClick={() => handleDelete(g)}>
                                  <FiTrash2 />
                                </button>
                              )}
                            </>
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
          <ModalShell title={editing ? "Editar grupo de finca" : "Nuevo grupo de finca"} onClose={() => setModalOpen(false)}>
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
                  placeholder="Ej: María Margarita / Marbella"
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                />
              </div>
              <div className="form-check mb-3">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="grupo-finca-estado"
                  checked={form.estado}
                  onChange={(e) => setForm((f) => ({ ...f, estado: e.target.checked }))}
                />
                <label className="form-check-label small" htmlFor="grupo-finca-estado">
                  Activo
                </label>
              </div>

              {formError && <div className="alert alert-danger py-2 small">{formError}</div>}

              <div className="d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-outline-secondary btn-sm rounded-3" onClick={() => setModalOpen(false)}>
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
