"use client";

import { useEffect, useState } from "react";
import { FiPlus, FiEdit2, FiTrash2 } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import RequirePermission from "@/components/RequirePermission";
import ModalShell from "@/components/ModalShell";

const TIPOS = ["INSUMO", "REPUESTO", "ELABORADO", "GENERAL"];

function emptyForm() {
  return { nombre: "", descripcion: "", tipo: "GENERAL", estado: true };
}

export default function CategoriasInventarioPage() {
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
      const { items: rows } = await apiFetch(`/inventarios/categorias?${qs}`);
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

  function openEdit(categoria) {
    setEditing(categoria);
    setForm({
      nombre: categoria.nombre,
      descripcion: categoria.descripcion || "",
      tipo: categoria.tipo,
      estado: categoria.estado,
    });
    setFormError("");
    setModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      const body = { ...form, descripcion: form.descripcion || null };
      if (editing) {
        await apiFetch(`/inventarios/categorias/${editing.uuid}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await apiFetch("/inventarios/categorias", { method: "POST", body: JSON.stringify(body) });
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(categoria) {
    if (!confirm(`¿Eliminar la categoría "${categoria.nombre}"?`)) return;
    try {
      await apiFetch(`/inventarios/categorias/${categoria.uuid}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <RequirePermission code="menu.inventarios.categorias">
      <div className="p-4 p-md-5">
        <div className="mb-4 d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h1 className="fw-bold h3 mb-1">Categorías de Producto</h1>
            <p className="text-secondary mb-0">Agrupan insumos, repuestos y productos elaborados del inventario.</p>
          </div>
          {hasPermission("inventario.categorias.crear") && (
            <button type="button" className="btn btn-brand rounded-3 d-flex align-items-center gap-2" onClick={openCreate}>
              <FiPlus /> Nueva categoría
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
                  <th>Tipo</th>
                  <th>Descripción</th>
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
                      No hay categorías registradas todavía.
                    </td>
                  </tr>
                )}
                {!loading &&
                  items.map((c) => (
                    <tr key={c.uuid}>
                      <td className="fw-medium">{c.nombre}</td>
                      <td className="small text-secondary">{c.tipo}</td>
                      <td className="small text-secondary">{c.descripcion || "—"}</td>
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
                          {hasPermission("inventario.categorias.editar") && (
                            <button type="button" className="btn btn-sm btn-outline-warning" title="Editar" onClick={() => openEdit(c)}>
                              <FiEdit2 />
                            </button>
                          )}
                          {hasPermission("inventario.categorias.eliminar") && (
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
          <ModalShell title={editing ? "Editar categoría" : "Nueva categoría"} onClose={() => setModalOpen(false)}>
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
              <div className="mb-3">
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
              <div className="form-check mb-3">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="categoria-inv-estado"
                  checked={form.estado}
                  onChange={(e) => setForm((f) => ({ ...f, estado: e.target.checked }))}
                />
                <label className="form-check-label small" htmlFor="categoria-inv-estado">
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
