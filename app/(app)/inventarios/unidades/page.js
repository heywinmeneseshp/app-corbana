"use client";

import { useEffect, useState } from "react";
import { FiPlus, FiEdit2, FiTrash2 } from "react-icons/fi";
import { apiFetch } from "@/lib/api";
import { hasPermission } from "@/lib/auth";
import RequirePermission from "@/components/RequirePermission";
import ModalShell from "@/components/ModalShell";

const TIPOS = ["MASA", "VOLUMEN", "UNIDAD", "LONGITUD", "SUPERFICIE", "TIEMPO", "OTRO"];

function emptyForm() {
  return { codigo: "", nombre: "", simbolo: "", tipo: "OTRO", estado: true };
}

export default function UnidadesInventarioPage() {
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
      const { items: rows } = await apiFetch(`/inventarios/unidades?${qs}`);
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

  function openEdit(unidad) {
    setEditing(unidad);
    setForm({ codigo: unidad.codigo, nombre: unidad.nombre, simbolo: unidad.simbolo, tipo: unidad.tipo, estado: unidad.estado });
    setFormError("");
    setModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      if (editing) {
        await apiFetch(`/inventarios/unidades/${editing.uuid}`, { method: "PUT", body: JSON.stringify(form) });
      } else {
        await apiFetch("/inventarios/unidades", { method: "POST", body: JSON.stringify(form) });
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(unidad) {
    if (!confirm(`¿Eliminar la unidad "${unidad.nombre}"?`)) return;
    try {
      await apiFetch(`/inventarios/unidades/${unidad.uuid}`, { method: "DELETE" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <RequirePermission code="menu.inventarios.unidades">
      <div className="p-4 p-md-5">
        <div className="mb-4 d-flex flex-wrap align-items-center justify-content-between gap-3">
          <div>
            <h1 className="fw-bold h3 mb-1">Unidades de Medida</h1>
            <p className="text-secondary mb-0">Unidades usadas en artículos y movimientos, con sus conversiones.</p>
          </div>
          {hasPermission("inventario.unidades.crear") && (
            <button type="button" className="btn btn-brand rounded-3 d-flex align-items-center gap-2" onClick={openCreate}>
              <FiPlus /> Nueva unidad
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

        <div className="card border-0 shadow-sm rounded-4 overflow-hidden mb-4">
          <div className="table-responsive">
            <table className="table table-hover mb-0 align-middle">
              <thead className="table-light">
                <tr>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Símbolo</th>
                  <th>Tipo</th>
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
                      No hay unidades registradas todavía.
                    </td>
                  </tr>
                )}
                {!loading &&
                  items.map((u) => (
                    <tr key={u.uuid}>
                      <td className="fw-medium">{u.codigo}</td>
                      <td>{u.nombre}</td>
                      <td className="small text-secondary">{u.simbolo}</td>
                      <td className="small text-secondary">{u.tipo}</td>
                      <td>
                        {u.estado ? (
                          <span className="badge rounded-pill" style={{ backgroundColor: "#d1fae5", color: "#047857" }}>
                            Activo
                          </span>
                        ) : (
                          <span className="badge rounded-pill text-bg-secondary">Inactivo</span>
                        )}
                      </td>
                      <td>
                        <div className="d-flex justify-content-end gap-2 flex-nowrap">
                          {hasPermission("inventario.unidades.editar") && (
                            <button type="button" className="btn btn-sm btn-outline-warning" title="Editar" onClick={() => openEdit(u)}>
                              <FiEdit2 />
                            </button>
                          )}
                          {hasPermission("inventario.unidades.eliminar") && (
                            <button type="button" className="btn btn-sm btn-outline-danger" title="Eliminar" onClick={() => handleDelete(u)}>
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

        <ConversionesCard unidades={items} />

        {modalOpen && (
          <ModalShell title={editing ? "Editar unidad" : "Nueva unidad"} onClose={() => setModalOpen(false)}>
            <form onSubmit={handleSave}>
              <div className="mb-3">
                <label className="form-label small fw-medium">
                  Código <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className="form-control rounded-3"
                  required
                  maxLength={20}
                  value={form.codigo}
                  onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
                />
              </div>
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
                <label className="form-label small fw-medium">
                  Símbolo <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className="form-control rounded-3"
                  required
                  maxLength={20}
                  value={form.simbolo}
                  onChange={(e) => setForm((f) => ({ ...f, simbolo: e.target.value }))}
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
              <div className="form-check mb-3">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="unidad-estado"
                  checked={form.estado}
                  onChange={(e) => setForm((f) => ({ ...f, estado: e.target.checked }))}
                />
                <label className="form-check-label small" htmlFor="unidad-estado">
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

// Conversiones entre unidades — sección secundaria debajo del catálogo
// principal, mismo criterio que las secciones anidadas de fincas/page.js.
function ConversionesCard({ unidades }) {
  const [conversiones, setConversiones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ unidadOrigenUuid: "", unidadDestinoUuid: "", factor: "" });
  const [saving, setSaving] = useState(false);

  async function loadConversiones() {
    setLoading(true);
    try {
      const data = await apiFetch("/inventarios/unidades/conversiones");
      setConversiones(Array.isArray(data) ? data : data.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadConversiones();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await apiFetch("/inventarios/unidades/conversiones", {
        method: "POST",
        body: JSON.stringify({ ...form, factor: Number(form.factor) }),
      });
      setForm({ unidadOrigenUuid: "", unidadDestinoUuid: "", factor: "" });
      loadConversiones();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(conv) {
    if (!confirm("¿Eliminar esta conversión?")) return;
    try {
      await apiFetch(`/inventarios/unidades/conversiones/${conv.uuid}`, { method: "DELETE" });
      loadConversiones();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="card border-0 shadow-sm rounded-4 p-4">
      <h2 className="h6 fw-bold mb-3">Conversiones entre unidades</h2>

      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      <form className="row g-2 align-items-end mb-3" onSubmit={handleCreate}>
        <div className="col-auto">
          <label className="form-label small fw-medium mb-1">Origen</label>
          <select
            className="form-select rounded-3 form-select-sm"
            required
            value={form.unidadOrigenUuid}
            onChange={(e) => setForm((f) => ({ ...f, unidadOrigenUuid: e.target.value }))}
          >
            <option value="">Seleccionar...</option>
            {unidades.map((u) => (
              <option key={u.uuid} value={u.uuid}>
                {u.codigo} — {u.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="col-auto">
          <label className="form-label small fw-medium mb-1">Destino</label>
          <select
            className="form-select rounded-3 form-select-sm"
            required
            value={form.unidadDestinoUuid}
            onChange={(e) => setForm((f) => ({ ...f, unidadDestinoUuid: e.target.value }))}
          >
            <option value="">Seleccionar...</option>
            {unidades.map((u) => (
              <option key={u.uuid} value={u.uuid}>
                {u.codigo} — {u.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="col-auto">
          <label className="form-label small fw-medium mb-1">Factor (1 origen = factor × destino)</label>
          <input
            type="number"
            step="any"
            required
            className="form-control rounded-3 form-control-sm"
            style={{ width: 140 }}
            value={form.factor}
            onChange={(e) => setForm((f) => ({ ...f, factor: e.target.value }))}
          />
        </div>
        <div className="col-auto">
          <button type="submit" className="btn btn-brand btn-sm rounded-3" disabled={saving}>
            {saving ? "Agregando..." : "Agregar"}
          </button>
        </div>
      </form>

      <div className="table-responsive">
        <table className="table table-sm table-hover mb-0 align-middle">
          <thead className="table-light">
            <tr>
              <th>Origen</th>
              <th>Destino</th>
              <th>Factor</th>
              <th className="text-end">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={4} className="text-center text-secondary py-3">
                  Cargando...
                </td>
              </tr>
            )}
            {!loading && conversiones.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-secondary py-3">
                  No hay conversiones registradas.
                </td>
              </tr>
            )}
            {!loading &&
              conversiones.map((c) => (
                <tr key={c.uuid}>
                  <td className="small">{c.unidadOrigen?.nombre}</td>
                  <td className="small">{c.unidadDestino?.nombre}</td>
                  <td className="small text-secondary">{c.factor}</td>
                  <td>
                    <div className="d-flex justify-content-end">
                      <button type="button" className="btn btn-sm btn-outline-danger" title="Eliminar" onClick={() => handleDelete(c)}>
                        <FiTrash2 />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
