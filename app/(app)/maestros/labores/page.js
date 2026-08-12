"use client";

import { useEffect, useState } from "react";
import { FiPlus, FiEdit2, FiTrash2 } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import RequirePermission from "@/components/RequirePermission";
import ModalShell from "@/components/ModalShell";
import IconPicker from "@/components/calendario-labores/IconPicker";
import LaborIconBadge from "@/components/calendario-labores/LaborIconBadge";
import { DEFAULT_LABOR_ICON_KEY } from "@/lib/laborIcons";

function emptyForm(categorias) {
  return {
    nombre: "",
    categoriaLaborUuid: categorias[0]?.uuid || "",
    color: "#16a34a",
    icono: DEFAULT_LABOR_ICON_KEY,
    duracionDefaultMinutos: "",
    estado: true,
  };
}

export default function LaboresPage() {
  const [items, setItems] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    nombre: "",
    categoriaLaborUuid: "",
    color: "#16a34a",
    icono: DEFAULT_LABOR_ICON_KEY,
    duracionDefaultMinutos: "",
    estado: true,
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [{ items: labores }, { items: categoriasLabor }] = await Promise.all([
        apiFetch("/labores?limit=100"),
        apiFetch("/categorias-labor?limit=100"),
      ]);
      setItems(labores);
      setCategorias(categoriasLabor);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm(categorias));
    setFormError("");
    setModalOpen(true);
  }

  function openEdit(labor) {
    setEditing(labor);
    setForm({
      nombre: labor.nombre,
      categoriaLaborUuid: labor.categoria?.uuid || "",
      color: labor.color,
      icono: labor.icono || DEFAULT_LABOR_ICON_KEY,
      duracionDefaultMinutos: labor.duracionDefaultMinutos ?? "",
      estado: labor.estado,
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
        categoriaLaborUuid: form.categoriaLaborUuid,
        color: form.color,
        icono: form.icono,
        duracionDefaultMinutos: form.duracionDefaultMinutos === "" ? null : Number(form.duracionDefaultMinutos),
        estado: form.estado,
      };
      if (editing) {
        await apiFetch(`/labores/${editing.uuid}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await apiFetch("/labores", { method: "POST", body: JSON.stringify(body) });
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(labor) {
    if (!confirm(`¿Eliminar la labor "${labor.nombre}"?`)) return;
    try {
      await apiFetch(`/labores/${labor.uuid}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <RequirePermission code="menu.maestros.labores">
      <div className="p-4 p-md-5">
        <div className="mb-4 d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h1 className="fw-bold h3 mb-1">Labores</h1>
            <p className="text-secondary mb-0">
              Maestro de labores agrícolas (Desmache, Deshoje, Fertilización, etc.) que se pueden programar en el calendario.
            </p>
          </div>
          {hasPermission("labor.crear") && categorias.length > 0 && (
            <button type="button" className="btn btn-brand rounded-3 d-flex align-items-center gap-2" onClick={openCreate}>
              <FiPlus /> Nueva labor
            </button>
          )}
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}
        {!loading && categorias.length === 0 && (
          <div className="alert alert-warning py-2 small">
            Todavía no hay categorías de labor creadas. Ve primero a{" "}
            <a href="/maestros/categorias-labor" className="alert-link">
              Categorías de Labor
            </a>{" "}
            para crear al menos una.
          </div>
        )}

        <div className="card border-0 shadow-sm rounded-4 overflow-hidden">
          <div className="table-responsive">
            <table className="table table-hover mb-0 align-middle">
              <thead className="table-light">
                <tr>
                  <th>Icono</th>
                  <th>Nombre</th>
                  <th>Categoría</th>
                  <th>Color</th>
                  <th>Duración por defecto</th>
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
                      No hay labores registradas todavía.
                    </td>
                  </tr>
                )}
                {!loading &&
                  items.map((l) => (
                    <tr key={l.uuid}>
                      <td>
                        <LaborIconBadge icono={l.icono} color={l.color} size={24} />
                      </td>
                      <td className="fw-medium">{l.nombre}</td>
                      <td>{l.categoria && <span className="badge rounded-pill text-bg-secondary">{l.categoria.nombre}</span>}</td>
                      <td>
                        <span
                          className="d-inline-block rounded-circle me-2 align-middle"
                          style={{ width: 14, height: 14, backgroundColor: l.color }}
                        />
                        <span className="small text-secondary align-middle">{l.color}</span>
                      </td>
                      <td className="small text-secondary">
                        {l.duracionDefaultMinutos ? `${l.duracionDefaultMinutos} min` : "—"}
                      </td>
                      <td>
                        {l.estado ? (
                          <span className="badge rounded-pill" style={{ backgroundColor: "#d1fae5", color: "#047857" }}>
                            Activo
                          </span>
                        ) : (
                          <span className="badge rounded-pill text-bg-secondary">Inactivo</span>
                        )}
                      </td>
                      <td>
                        <div className="d-flex justify-content-end gap-2 flex-nowrap">
                          {hasPermission("labor.editar") && (
                            <button type="button" className="btn btn-sm btn-outline-warning" title="Editar" onClick={() => openEdit(l)}>
                              <FiEdit2 />
                            </button>
                          )}
                          {hasPermission("labor.eliminar") && (
                            <button type="button" className="btn btn-sm btn-outline-danger" title="Eliminar" onClick={() => handleDelete(l)}>
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
          <ModalShell title={editing ? "Editar labor" : "Nueva labor"} onClose={() => setModalOpen(false)}>
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
                <label className="form-label small fw-medium">
                  Categoría <span className="text-danger">*</span>
                </label>
                <select
                  className="form-select rounded-3"
                  required
                  value={form.categoriaLaborUuid}
                  onChange={(e) => setForm((f) => ({ ...f, categoriaLaborUuid: e.target.value }))}
                >
                  {categorias.map((c) => (
                    <option key={c.uuid} value={c.uuid}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-3">
                <label className="form-label small fw-medium">Color</label>
                <div className="d-flex align-items-center gap-2">
                  <input
                    type="color"
                    className="form-control form-control-color"
                    value={form.color}
                    onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  />
                  <span className="small text-secondary">{form.color}</span>
                </div>
              </div>
              <div className="mb-3">
                <label className="form-label small fw-medium d-block">Icono</label>
                <IconPicker value={form.icono} onChange={(icono) => setForm((f) => ({ ...f, icono }))} />
              </div>
              <div className="mb-3">
                <label className="form-label small fw-medium">Duración por defecto (minutos)</label>
                <input
                  type="number"
                  min={1}
                  className="form-control rounded-3"
                  placeholder="Opcional"
                  value={form.duracionDefaultMinutos}
                  onChange={(e) => setForm((f) => ({ ...f, duracionDefaultMinutos: e.target.value }))}
                />
              </div>
              <div className="form-check mb-3">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="labor-estado"
                  checked={form.estado}
                  onChange={(e) => setForm((f) => ({ ...f, estado: e.target.checked }))}
                />
                <label className="form-check-label small" htmlFor="labor-estado">
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
